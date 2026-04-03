"""
AgriFlow - Crop Price Prediction API Backend (Windows Version)
FastAPI application providing crop price prediction endpoints
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from production_pipeline_win import PricePredictionPipeline
from datetime import datetime, timedelta
import uvicorn
import logging
import os
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title="AgriFlow - Price Prediction API",
    description="Weather-based crop price prediction system",
    version="1.0.0"
)

# Enable CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to store the model
pipeline = None

# ============================================
# Windows Path Configuration
# ============================================

# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Define all paths (Windows compatible)
MODEL_PATH = os.path.join(BASE_DIR, "models", "saved_models", "xgboost_daily_price_model.pkl")
ENCODERS_PATH = os.path.join(BASE_DIR, "models", "saved_models", "daily_data_encoders.pkl")
HISTORY_PATH = os.path.join(BASE_DIR, "data", "processed", "aligned_daily_dataset.csv")

logger.info(f"Base directory: {BASE_DIR}")
logger.info(f"Model path: {MODEL_PATH}")
logger.info(f"Encoders path: {ENCODERS_PATH}")
logger.info(f"History path: {HISTORY_PATH}")

# ============================================
# Application Startup and Shutdown Events
# ============================================

@app.on_event("startup")
async def startup_event():
    """Load model when application starts"""
    global pipeline
    logger.info("🚀 Starting application...")
    logger.info("📦 Loading XGBoost model...")
    
    # Check if files exist
    if not os.path.exists(MODEL_PATH):
        logger.error(f"❌ Model file not found: {MODEL_PATH}")
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")
    
    if not os.path.exists(ENCODERS_PATH):
        logger.error(f"❌ Encoders file not found: {ENCODERS_PATH}")
        raise FileNotFoundError(f"Encoders file not found: {ENCODERS_PATH}")
    
    if not os.path.exists(HISTORY_PATH):
        logger.error(f"❌ History file not found: {HISTORY_PATH}")
        raise FileNotFoundError(f"History file not found: {HISTORY_PATH}")
    
    try:
        pipeline = PricePredictionPipeline(
            model_path=MODEL_PATH,
            encoders_path=ENCODERS_PATH,
            history_path=HISTORY_PATH
        )
        logger.info("✅ Model loaded successfully!")
    except Exception as e:
        logger.error(f"❌ Model loading failed: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources when application shuts down"""
    logger.info("🛑 Application shutting down...")

# ============================================
# Health Check Endpoint
# ============================================

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "model_loaded": pipeline is not None,
        "timestamp": datetime.now().isoformat()
    }

# ============================================
# Price Prediction Endpoints
# ============================================

@app.get("/api/predict_price")
def predict_price(
    state: str,
    crop: str,
    target_date: str = None
):
    """
    Predict the price of a single crop
    
    Parameters:
    - state: State name (e.g., "Selangor", "Johor")
    - crop: Crop name (e.g., "Tomato", "Cili Merah")
    - target_date: Target date (format: YYYY-MM-DD, default: tomorrow)
    """
    
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if target_date is None:
        target_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    
    try:
        result = pipeline.predict_future_price(state, crop, target_date)
        if result is None:
            raise HTTPException(
                status_code=404,
                detail=f"Data not found for {crop} in {state}"
            )
        return result
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Batch Prediction Endpoints
# ============================================

@app.get("/api/predict_state")
def predict_state(state: str, target_date: str = None):
    """Predict prices for all major crops in a state"""
    
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if target_date is None:
        target_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    
    crops = [
        'Cili Merah', 'Cili Akar', 'Tomato', 'Kobis Bulat', 'Sawi',
        'Kangkung', 'Bayam', 'Timun', 'Terung', 'Pisang Cavendish',
        'Betik', 'Tembikai', 'Nanas', 'Kacang Panjang'
    ]
    
    results = []
    for crop in crops:
        try:
            result = pipeline.predict_future_price(state, crop, target_date)
            if result:
                results.append(result)
        except Exception as e:
            logger.warning(f"Prediction failed for {crop}: {str(e)}")
            continue
    
    return {
        "state": state,
        "target_date": target_date,
        "predictions": results,
        "count": len(results)
    }

# ============================================
# Weekly Forecast Endpoint
# ============================================

@app.get("/api/predict_week")
def predict_week(state: str, crop: str):
    """Predict price trends for the next 7 days"""
    
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    results = []
    for i in range(1, 8):
        target_date = (datetime.now() + timedelta(days=i)).strftime('%Y-%m-%d')
        try:
            result = pipeline.predict_future_price(state, crop, target_date)
            if result:
                results.append(result)
        except Exception as e:
            logger.warning(f"Prediction failed for day {i}: {str(e)}")
            continue
    
    return {
        "state": state,
        "crop": crop,
        "week_forecast": results,
        "days_count": len(results)
    }

# ============================================
# Price Comparison Endpoint
# ============================================

@app.get("/api/compare_states")
def compare_states(crop: str, target_date: str = None):
    """Compare prices of the same crop across different states"""
    
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if target_date is None:
        target_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    
    states = [
        'Johor', 'Kedah', 'Kelantan', 'Malacca', 'Negeri Sembilan',
        'Pahang', 'Penang', 'Perak', 'Perlis', 'Sabah',
        'Sarawak', 'Selangor', 'Terengganu', 'Wilayah Persekutuan'
    ]
    
    comparisons = []
    for state in states:
        try:
            result = pipeline.predict_future_price(state, crop, target_date)
            if result:
                comparisons.append({
                    "state": result['state'],
                    "predicted_price_rm": result['predicted_price_rm'],
                    "trend": result['trend'],
                    "pct_change": result['pct_change']
                })
        except Exception as e:
            logger.warning(f"Prediction failed for {state}: {str(e)}")
            continue
    
    comparisons.sort(key=lambda x: x['predicted_price_rm'])
    
    return {
        "crop": crop,
        "target_date": target_date,
        "comparisons": comparisons,
        "lowest_price_state": comparisons[0]['state'] if comparisons else None,
        "highest_price_state": comparisons[-1]['state'] if comparisons else None
    }

# ============================================
# Root Endpoint
# ============================================

@app.get("/")
def root():
    """Root endpoint - displays API information"""
    return {
        "message": "Welcome to AgriFlow Price Prediction API",
        "version": "1.0.0",
        "docs": "http://localhost:8000/docs",
        "endpoints": {
            "health": "GET /health",
            "predict_price": "GET /api/predict_price?state=Selangor&crop=Tomato",
            "predict_state": "GET /api/predict_state?state=Johor",
            "predict_week": "GET /api/predict_week?state=Selangor&crop=Tomato",
            "compare_states": "GET /api/compare_states?crop=Tomato"
        }
    }

# ============================================
# Run Application
# ============================================

if __name__ == "__main__":
    print("""
    ╔════════════════════════════════════════╗
    ║   AgriFlow - Price Prediction API      ║
    ║   Farming Assistant Backend            ║
    ║   Windows Version                      ║
    ╚════════════════════════════════════════╝
    """)
    
    print("🚀 Starting FastAPI server...")
    print("📖 API Documentation: http://localhost:8000/docs")
    print("🏥 Health Check: http://localhost:8000/health")
    print("\nPress Ctrl+C to stop the server\n")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
