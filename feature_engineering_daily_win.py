import pandas as pd
import numpy as np
import os
import logging
import joblib
from sklearn.preprocessing import LabelEncoder

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("FeatureEngineering")

def create_features(input_path, output_path, encoders_path):
    logger.info(f"Loading aligned daily data from {input_path}")
    
    if not os.path.exists(input_path):
        logger.error(f"Input file not found: {input_path}")
        raise FileNotFoundError(f"Input file not found: {input_path}. Please run align_daily_data_win.py first.")
        
    df = pd.read_csv(input_path)
    
    # Ensure date is datetime
    df['date'] = pd.to_datetime(df['date'])
    
    # Sort by state, crop and date to ensure correct lag calculations
    df = df.sort_values(['state', 'crop_name', 'date'])
    
    logger.info("Creating time-based features...")
    df['day_of_week'] = df['date'].dt.dayofweek
    df['day_of_month'] = df['date'].dt.day
    df['month'] = df['date'].dt.month
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
    
    logger.info("Creating lag features for price...")
    # We will predict retail_price_rm, but we can use lags of all prices
    # 1 day, 3 days, 7 days lag
    for col in ['retail_price_rm', 'wholesale_price_rm', 'farm_price_rm']:
        if col in df.columns:
            df[f'{col}_lag_1d'] = df.groupby(['state', 'crop_name'])[col].shift(1)
            df[f'{col}_lag_3d'] = df.groupby(['state', 'crop_name'])[col].shift(3)
            df[f'{col}_lag_7d'] = df.groupby(['state', 'crop_name'])[col].shift(7)
    
    logger.info("Creating rolling weather features...")
    # 3-day and 7-day rolling averages for weather
    for col in ['temperature_c', 'humidity_pct', 'rainfall_mm']:
        if col in df.columns:
            df[f'{col}_3d_avg'] = df.groupby(['state', 'crop_name'])[col].transform(lambda x: x.rolling(3, min_periods=1).mean())
            df[f'{col}_7d_avg'] = df.groupby(['state', 'crop_name'])[col].transform(lambda x: x.rolling(7, min_periods=1).mean())
    
    logger.info("Handling missing values from lags...")
    # Backfill missing values created by lagging
    lag_cols = [col for col in df.columns if 'lag' in col]
    for col in lag_cols:
        # Using bfill() instead of fillna(method='bfill') to avoid pandas deprecation warning
        df[col] = df.groupby(['state', 'crop_name'])[col].bfill()
        # If still NaN, fill with the current price
        base_col = col.split('_lag')[0]
        df[col] = df[col].fillna(df[base_col])
        
    logger.info("Encoding categorical variables...")
    categorical_cols = ['state', 'crop_name', 'category']
    label_encoders = {}
    
    for col in categorical_cols:
        if col in df.columns:
            le = LabelEncoder()
            df[f'{col}_encoded'] = le.fit_transform(df[col].astype(str))
            label_encoders[col] = le
        
    # Save encoders for inference
    os.makedirs(os.path.dirname(encoders_path), exist_ok=True)
    joblib.dump(label_encoders, encoders_path)
    logger.info(f"Saved label encoders to {encoders_path}")
    
    # Save engineered features
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    
    logger.info(f"Engineered data saved to {output_path}")
    logger.info(f"Final shape: {df.shape}")
    
    return df

if __name__ == "__main__":
    # Get the directory of the current script
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Define paths using os.path.join for Windows compatibility
    INPUT_FILE = os.path.join(BASE_DIR, "data", "processed", "aligned_daily_dataset.csv")
    OUTPUT_FILE = os.path.join(BASE_DIR, "data", "processed", "model_ready_daily_features.csv")
    ENCODERS_FILE = os.path.join(BASE_DIR, "models", "saved_models", "daily_data_encoders.pkl")
    
    logger.info(f"Base directory: {BASE_DIR}")
    
    create_features(INPUT_FILE, OUTPUT_FILE, ENCODERS_FILE)
