import pandas as pd
import numpy as np
import os
import logging
import joblib
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ProductionPipeline")

class PricePredictionPipeline:
    def __init__(self, model_path, encoders_path, history_path):
        self.model_path = model_path
        self.encoders_path = encoders_path
        self.history_path = history_path
        
        self.model = None
        self.encoders = None
        self.history_df = None
        
        self.load_resources()
        
    def load_resources(self):
        """Load model, encoders, and historical data"""
        logger.info("Loading resources...")
        
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model not found at {self.model_path}")
        if not os.path.exists(self.encoders_path):
            raise FileNotFoundError(f"Encoders not found at {self.encoders_path}")
        if not os.path.exists(self.history_path):
            raise FileNotFoundError(f"History data not found at {self.history_path}")
            
        self.model = joblib.load(self.model_path)
        self.encoders = joblib.load(self.encoders_path)
        
        # Load history and ensure date is datetime
        self.history_df = pd.read_csv(self.history_path)
        self.history_df['date'] = pd.to_datetime(self.history_df['date'])
        
        logger.info("Resources loaded successfully")
        
    def get_latest_data(self, state, crop_name):
        """Get the most recent data for a specific state and crop"""
        mask = (self.history_df['state'] == state) & (self.history_df['crop_name'] == crop_name)
        crop_data = self.history_df[mask].sort_values('date')
        
        if len(crop_data) == 0:
            return None
            
        return crop_data.iloc[-1]
        
    def get_historical_lags(self, state, crop_name, target_date):
        """Get historical price lags relative to target date"""
        mask = (self.history_df['state'] == state) & (self.history_df['crop_name'] == crop_name)
        crop_data = self.history_df[mask].sort_values('date')
        
        if len(crop_data) == 0:
            return None
            
        # Find closest date before target
        past_data = crop_data[crop_data['date'] < pd.to_datetime(target_date)]
        
        if len(past_data) == 0:
            # If no past data, use the earliest available
            past_data = crop_data
            
        latest = past_data.iloc[-1]
        
        # In a real scenario, we would look exactly 1, 3, 7 days back
        # For simplicity here, we just use the latest available as 1d lag, etc.
        lags = {
            'retail_price_rm_lag_1d': latest['retail_price_rm'],
            'retail_price_rm_lag_3d': past_data.iloc[-3]['retail_price_rm'] if len(past_data) >= 3 else latest['retail_price_rm'],
            'retail_price_rm_lag_7d': past_data.iloc[-7]['retail_price_rm'] if len(past_data) >= 7 else latest['retail_price_rm']
        }
        
        return lags
        
    def get_weather_forecast(self, state, target_date):
        """Mock weather forecast for future dates"""
        # In production, this would call OpenWeather API forecast endpoint
        # Here we generate realistic mock data based on historical averages
        
        state_data = self.history_df[self.history_df['state'] == state]
        if len(state_data) == 0:
            avg_temp, avg_hum, avg_rain = 28.0, 80.0, 10.0
        else:
            avg_temp = state_data['temperature_c'].mean()
            avg_hum = state_data['humidity_pct'].mean()
            avg_rain = state_data['rainfall_mm'].mean()
            
        # Add some random variation
        return {
            'temperature_c': np.random.normal(avg_temp, 1.5),
            'humidity_pct': np.clip(np.random.normal(avg_hum, 5.0), 60, 100),
            'rainfall_mm': max(0, np.random.normal(avg_rain, 8.0)),
            'temperature_c_3d_avg': np.random.normal(avg_temp, 1.0),
            'humidity_pct_3d_avg': np.clip(np.random.normal(avg_hum, 3.0), 60, 100),
            'rainfall_mm_3d_avg': max(0, np.random.normal(avg_rain, 5.0)),
            'temperature_c_7d_avg': np.random.normal(avg_temp, 0.5),
            'humidity_pct_7d_avg': np.clip(np.random.normal(avg_hum, 2.0), 60, 100),
            'rainfall_mm_7d_avg': max(0, np.random.normal(avg_rain, 3.0))
        }
        
    def predict_future_price(self, state, crop_name, target_date_str=None):
        """Predict price for a specific date"""
        if target_date_str is None:
            # Default to tomorrow
            target_date = datetime.now() + timedelta(days=1)
        else:
            target_date = pd.to_datetime(target_date_str)
            
        # Get latest actual data to know current price
        latest_data = self.get_latest_data(state, crop_name)
        if latest_data is None:
            logger.warning(f"No historical data found for {crop_name} in {state}")
            return None
            
        # Prepare features
        features = {}
        
        # 1. Categorical features
        try:
            features['state_encoded'] = self.encoders['state'].transform([state])[0]
            features['crop_name_encoded'] = self.encoders['crop_name'].transform([crop_name])[0]
            features['category_encoded'] = self.encoders['category'].transform([latest_data['category']])[0]
        except ValueError as e:
            logger.error(f"Encoding error: {str(e)}")
            return None
            
        # 2. Time features
        features['day_of_week'] = target_date.dayofweek
        features['day_of_month'] = target_date.day
        features['month'] = target_date.month
        features['is_weekend'] = 1 if target_date.dayofweek in [5, 6] else 0
        
        # 3. Lag features
        lags = self.get_historical_lags(state, crop_name, target_date)
        features.update(lags)
        
        # 4. Weather features
        weather = self.get_weather_forecast(state, target_date)
        features.update(weather)
        
        # Create DataFrame for prediction
        # Ensure columns match training exactly
        feature_cols = [
            'state_encoded', 'crop_name_encoded', 'category_encoded',
            'day_of_week', 'day_of_month', 'month', 'is_weekend',
            'retail_price_rm_lag_1d', 'retail_price_rm_lag_3d', 'retail_price_rm_lag_7d',
            'temperature_c', 'humidity_pct', 'rainfall_mm',
            'temperature_c_3d_avg', 'humidity_pct_3d_avg', 'rainfall_mm_3d_avg',
            'temperature_c_7d_avg', 'humidity_pct_7d_avg', 'rainfall_mm_7d_avg'
        ]
        
        X_pred = pd.DataFrame([features])[feature_cols]
        
        # Predict
        predicted_price = self.model.predict(X_pred)[0]
        
        # Calculate trend
        current_price = latest_data['retail_price_rm']
        pct_change = ((predicted_price - current_price) / current_price) * 100
        
        if pct_change > 2.0:
            trend = "UP"
        elif pct_change < -2.0:
            trend = "DOWN"
        else:
            trend = "STABLE"
            
        return {
            'state': state,
            'crop_name': crop_name,
            'target_date': target_date.strftime('%Y-%m-%d'),
            'current_price_rm': float(current_price),
            'predicted_price_rm': float(predicted_price),
            'trend': trend,
            'pct_change': float(pct_change),
            'weather_forecast': {
                'temperature_c': float(weather['temperature_c']),
                'humidity_pct': float(weather['humidity_pct']),
                'rainfall_mm': float(weather['rainfall_mm'])
            }
        }

if __name__ == "__main__":
    # Get the directory of the current script
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Define paths using os.path.join for Windows compatibility
    MODEL_PATH = os.path.join(BASE_DIR, "models", "saved_models", "xgboost_daily_price_model.pkl")
    ENCODERS_PATH = os.path.join(BASE_DIR, "models", "saved_models", "daily_data_encoders.pkl")
    HISTORY_PATH = os.path.join(BASE_DIR, "data", "processed", "aligned_daily_dataset.csv")
    
    logger.info(f"Base directory: {BASE_DIR}")
    
    try:
        pipeline = PricePredictionPipeline(
            model_path=MODEL_PATH,
            encoders_path=ENCODERS_PATH,
            history_path=HISTORY_PATH
        )
        
        # Test predictions
        test_cases = [
            ("Selangor", "Tomato"),
            ("Johor", "Cili Merah"),
            ("Pahang", "Kobis Bulat"),
            ("Kedah", "Pisang Cavendish")
        ]
        
        target_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        print("\n" + "="*50)
        print(f"PRICE PREDICTIONS FOR {target_date}")
        print("="*50)
        
        for state, crop in test_cases:
            result = pipeline.predict_future_price(state, crop, target_date)
            if result:
                trend_icon = "↗️" if result['trend'] == "UP" else "↘️" if result['trend'] == "DOWN" else "➡️"
                print(f"\nLocation: {result['state']}")
                print(f"Crop:     {result['crop_name']}")
                print(f"Current:  RM {result['current_price_rm']:.2f}/kg")
                print(f"Forecast: RM {result['predicted_price_rm']:.2f}/kg")
                print(f"Trend:    {trend_icon} {result['trend']} ({result['pct_change']:+.1f}%)")
                print(f"Weather:  {result['weather_forecast']['temperature_c']:.1f}°C, "
                      f"{result['weather_forecast']['humidity_pct']:.1f}% humidity, "
                      f"{result['weather_forecast']['rainfall_mm']:.1f}mm rain")
            else:
                print(f"\nCould not predict for {crop} in {state}")
                
        print("\n" + "="*50)
        
    except Exception as e:
        logger.error(f"Pipeline error: {str(e)}")
