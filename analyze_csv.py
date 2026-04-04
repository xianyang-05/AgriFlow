import pandas as pd
import json

def analyze_data(file_path):
    print(f"Reading {file_path}...")
    
    # Read the CSV file
    # The columns are: date, state, crop_name, category, farm_price_rm, wholesale_price_rm, retail_price_rm
    # Wait, the first line in the file was:
    # 2025-10-02,Johor,Cili Merah,Sayur,7.6,9.97,12.21
    # It seems there is no header in the file, or the header was skipped. Let's read with no header and assign names.
    
    # Let's check if the first row is a header
    with open(file_path, 'r') as f:
        first_line = f.readline().strip()
        
    if 'date' in first_line.lower():
        df = pd.read_csv(file_path)
    else:
        df = pd.read_csv(file_path, names=['date', 'state', 'crop_name', 'category', 'farm_price_rm', 'wholesale_price_rm', 'retail_price_rm'])
        
    print(f"Total records: {len(df)}")
    
    # Get unique dates
    dates = df['date'].unique().tolist()
    dates.sort()
    print(f"Date range: {dates[0]} to {dates[-1]}")
    print(f"Number of unique dates: {len(dates)}")
    
    # Get unique states
    states = df['state'].unique().tolist()
    print(f"Number of unique states: {len(states)}")
    print(f"States: {states}")
    
    # Get unique crops
    crops = df['crop_name'].unique().tolist()
    print(f"Number of unique crops: {len(crops)}")
    
    # Save the unique dates and states to a JSON file for the weather fetcher
    metadata = {
        'start_date': dates[0],
        'end_date': dates[-1],
        'states': states
    }
    
    with open('/home/ubuntu/data_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
        
    print("Metadata saved to /home/ubuntu/data_metadata.json")

if __name__ == "__main__":
    analyze_data("/home/ubuntu/upload/malaysia_crop_prices.csv")
