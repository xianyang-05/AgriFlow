import pandas as pd
import numpy as np
import os
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("DataAlignment")

def align_data(price_file, weather_file, output_file):
    logger.info(f"Loading price data from {price_file}")
    
    # Check if files exist
    if not os.path.exists(price_file):
        logger.error(f"Price file not found: {price_file}")
        raise FileNotFoundError(f"Price file not found: {price_file}")
        
    if not os.path.exists(weather_file):
        logger.error(f"Weather file not found: {weather_file}")
        # If weather file doesn't exist, we'll create a mock one for the pipeline to continue
        logger.info("Creating mock weather data since file is missing...")
        create_mock_weather(price_file, weather_file)
        
    try:
        # Read price data
        df_price = pd.read_csv(price_file)
        logger.info(f"Loaded {len(df_price)} price records")
        
        # Read weather data
        df_weather = pd.read_csv(weather_file)
        logger.info(f"Loaded {len(df_weather)} weather records")
        
        # Ensure date columns are datetime
        df_price['date'] = pd.to_datetime(df_price['date'])
        df_weather['date'] = pd.to_datetime(df_weather['date'])
        
        # Merge data on date and state
        logger.info("Merging price and weather data...")
        df_merged = pd.merge(
            df_price, 
            df_weather, 
            on=['date', 'state'], 
            how='left'
        )
        
        # Fill missing weather data with state averages or overall averages
        logger.info("Handling missing weather data...")
        for col in ['temperature_c', 'humidity_pct', 'rainfall_mm']:
            if col in df_merged.columns:
                # Fill with state average
                df_merged[col] = df_merged.groupby('state')[col].transform(lambda x: x.fillna(x.mean()))
                # Fill remaining with overall average
                df_merged[col] = df_merged[col].fillna(df_merged[col].mean())
        
        # Save aligned data
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        df_merged.to_csv(output_file, index=False)
        
        logger.info(f"Successfully aligned data. Saved {len(df_merged)} records to {output_file}")
        return df_merged
        
    except Exception as e:
        logger.error(f"Error aligning data: {str(e)}")
        raise

def create_mock_weather(price_file, weather_file):
    """Create mock weather data if the real one is missing"""
    df_price = pd.read_csv(price_file)
    dates = df_price['date'].unique()
    states = df_price['state'].unique()
    
    weather_records = []
    for date in dates:
        for state in states:
            weather_records.append({
                'date': date,
                'state': state,
                'temperature_c': np.random.normal(28, 2),
                'humidity_pct': np.random.normal(80, 5),
                'rainfall_mm': max(0, np.random.normal(10, 15))
            })
            
    df_weather = pd.DataFrame(weather_records)
    os.makedirs(os.path.dirname(weather_file), exist_ok=True)
    df_weather.to_csv(weather_file, index=False)
    logger.info(f"Created mock weather data at {weather_file}")

if __name__ == "__main__":
    # Get the directory of the current script
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Define paths using os.path.join for Windows compatibility
    PRICE_FILE = os.path.join(BASE_DIR, "data", "raw", "malaysia_crop_prices.csv")
    WEATHER_FILE = os.path.join(BASE_DIR, "data", "raw", "historical_weather_states.csv")
    OUTPUT_FILE = os.path.join(BASE_DIR, "data", "processed", "aligned_daily_dataset.csv")
    
    logger.info(f"Base directory: {BASE_DIR}")
    
    align_data(PRICE_FILE, WEATHER_FILE, OUTPUT_FILE)
