import pandas as pd
import numpy as np
import os
import logging
import joblib
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import matplotlib.pyplot as plt

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ModelTraining")

def train_model(input_path, model_path, importance_path):
    logger.info(f"Loading engineered features from {input_path}")
    
    if not os.path.exists(input_path):
        logger.error(f"Input file not found: {input_path}")
        raise FileNotFoundError(f"Input file not found: {input_path}. Please run feature_engineering_daily_win.py first.")
        
    df = pd.read_csv(input_path)
    
    # Define features and target
    # We want to predict retail_price_rm
    target_col = 'retail_price_rm'
    
    # Select features
    feature_cols = [
        'state_encoded', 'crop_name_encoded', 'category_encoded',
        'day_of_week', 'day_of_month', 'month', 'is_weekend',
        'retail_price_rm_lag_1d', 'retail_price_rm_lag_3d', 'retail_price_rm_lag_7d',
        'temperature_c', 'humidity_pct', 'rainfall_mm',
        'temperature_c_3d_avg', 'humidity_pct_3d_avg', 'rainfall_mm_3d_avg',
        'temperature_c_7d_avg', 'humidity_pct_7d_avg', 'rainfall_mm_7d_avg'
    ]
    
    # Filter out any columns that might not exist
    feature_cols = [col for col in feature_cols if col in df.columns]
    
    logger.info(f"Using {len(feature_cols)} features: {feature_cols}")
    
    # Drop rows with NaN in target or features
    df_clean = df.dropna(subset=[target_col] + feature_cols)
    logger.info(f"Dropped {len(df) - len(df_clean)} rows with NaN values. Remaining: {len(df_clean)}")
    
    X = df_clean[feature_cols]
    y = df_clean[target_col]
    
    # Split data chronologically (train on past, test on future)
    # Sort by date first
    df_clean = df_clean.sort_values('date')
    
    # 80% train, 20% test
    split_idx = int(len(df_clean) * 0.8)
    
    X_train = X.iloc[:split_idx]
    y_train = y.iloc[:split_idx]
    X_test = X.iloc[split_idx:]
    y_test = y.iloc[split_idx:]
    
    logger.info(f"Training set: {len(X_train)} samples")
    logger.info(f"Testing set: {len(X_test)} samples")
    
    # Initialize and train XGBoost model
    logger.info("Training XGBoost model...")
    model = xgb.XGBRegressor(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=7,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1  # Use all available cores
    )
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_train, y_train), (X_test, y_test)],
        verbose=10
    )
    
    # Evaluate model
    logger.info("Evaluating model...")
    y_pred = model.predict(X_test)
    
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    logger.info(f"Model Performance:")
    logger.info(f"RMSE: {rmse:.4f} RM")
    logger.info(f"MAE: {mae:.4f} RM")
    logger.info(f"R2 Score: {r2:.4f}")
    
    # Save model
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(model, model_path)
    logger.info(f"Saved model to {model_path}")
    
    # Plot feature importance
    logger.info("Generating feature importance plot...")
    importance = model.feature_importances_
    indices = np.argsort(importance)[::-1]
    
    plt.figure(figsize=(12, 8))
    plt.title("Feature Importance for Crop Price Prediction")
    plt.bar(range(len(indices)), importance[indices], align="center")
    plt.xticks(range(len(indices)), [feature_cols[i] for i in indices], rotation=90)
    plt.tight_layout()
    
    os.makedirs(os.path.dirname(importance_path), exist_ok=True)
    plt.savefig(importance_path)
    logger.info(f"Saved feature importance plot to {importance_path}")
    
    return model

if __name__ == "__main__":
    # Get the directory of the current script
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Define paths using os.path.join for Windows compatibility
    INPUT_FILE = os.path.join(BASE_DIR, "data", "processed", "model_ready_daily_features.csv")
    MODEL_FILE = os.path.join(BASE_DIR, "models", "saved_models", "xgboost_daily_price_model.pkl")
    IMPORTANCE_FILE = os.path.join(BASE_DIR, "models", "saved_models", "feature_importance.png")
    
    logger.info(f"Base directory: {BASE_DIR}")
    
    train_model(INPUT_FILE, MODEL_FILE, IMPORTANCE_FILE)
