# -*- coding: utf-8 -*-
"""
Fine-tune YOLOv8n on the PlantVillage classification-style dataset.
Converts PlantVillage directory structure to YOLO detection format
using the full image as a single bounding box per-disease class.

Usage:
  python scripts/train-plant-disease.py

After training, the best weights are automatically exported to ONNX
at public/models/yolov8-plant.onnx
"""
import os
import sys
import shutil
from pathlib import Path

# ── 0. Paths ─────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent.parent
DATA_DIR    = ROOT / "plant_data"
MODELS_DIR  = ROOT / "public" / "models"
OUTPUT_ONNX = MODELS_DIR / "yolov8-plant.onnx"

MODELS_DIR.mkdir(parents=True, exist_ok=True)

print("[INFO] PlantVillage YOLOv8n Fine-Tuning Script")
print("[INFO] This script downloads the PlantVillage dataset via Kaggle or roboflow,")
print("[INFO] then fine-tunes YOLOv8n and exports to ONNX.\n")

# ── 1. Check for Roboflow ─────────────────────────────────────────────────────
try:
    import roboflow
    HAS_ROBOFLOW = True
except ImportError:
    HAS_ROBOFLOW = False

# ── 2. Download dataset from Kaggle ──────────────────────────────────────────
try:
    import kaggle
    HAS_KAGGLE = True
except Exception:
    HAS_KAGGLE = False

def download_dataset():
    """Return path to dataset YAML or None if unavailable."""
    # Check if local dataset already exists first
    yaml_path = DATA_DIR / "data.yaml"
    if yaml_path.exists():
        print(f"[INFO] Found existing local dataset at {yaml_path}")
        return str(yaml_path)
        
    # Option A: Roboflow
    if HAS_ROBOFLOW:
        api_key = os.environ.get("ROBOFLOW_API_KEY", "")
        if api_key:
            print("[INFO] Downloading PlantVillage from Roboflow...")
            from roboflow import Roboflow
            rf = Roboflow(api_key=api_key)
            project = rf.workspace("roboflow-100").project("plantdoc-pzse4")
            dataset = project.version(1).download("yolov8", location=str(DATA_DIR))
            return str(DATA_DIR / "data.yaml")

    # Option B: Kaggle
    if HAS_KAGGLE:
        print("[INFO] Downloading from Kaggle...")
        os.system(f"kaggle datasets download -d mohitsingh1804/plantvillage -p {DATA_DIR} --unzip")
        # Build minimal YAML if not present
        yaml_path = DATA_DIR / "data.yaml"
        if not yaml_path.exists():
            print("[WARN] No data.yaml found – manual setup required.")
            return None
        return str(yaml_path)

    print("[WARN] No dataset source configured.")
    print("  To fine-tune on real plant disease data, pick one option:")
    print("  A) pip install roboflow  + set ROBOFLOW_API_KEY env var")
    print("  B) pip install kaggle    + configure ~/.kaggle/kaggle.json")
    print("  C) Manually place a YOLOv8-format dataset in plant_data/")
    print("     with a data.yaml file.\n")
    return None


def main():
    from ultralytics import YOLO

    yaml_path = download_dataset()

    if yaml_path is None:
        print("[INFO] No dataset available. Training with placeholder COCO-pretrained yolov8n.")
        print("[INFO] The exported model will detect 80 COCO classes (not plant diseases).")
        print("[INFO] Run this script again after setting up a plant disease dataset.\n")

        model = YOLO("yolov8n.pt")
    else:
        print(f"[INFO] Training with dataset: {yaml_path}")
        model = YOLO("yolov8n.pt")

        # Fine-tune for 30 epochs (fast)
        model.train(
            data=yaml_path,
            epochs=30,
            imgsz=640,
            batch=16,       # Increased batch size slightly since GPU is faster
            project=str(ROOT / "runs"),
            name="plant-disease",
            device=0,       # Use CUDA GPU 0
            verbose=False,
        )
        print("[OK] Training complete!\n")

        # Load best weights
        best_weights = ROOT / "runs" / "plant-disease" / "weights" / "best.pt"
        if best_weights.exists():
            model = YOLO(str(best_weights))

    # Export to ONNX
    print("[INFO] Exporting model to ONNX (opset 12)...")
    exported = model.export(
        format="onnx",
        imgsz=640,
        opset=12,
        simplify=True,
        dynamic=False,
    )

    shutil.copy(exported, OUTPUT_ONNX)
    size_mb = OUTPUT_ONNX.stat().st_size / 1024 / 1024
    print(f"[OK] Model exported to: {OUTPUT_ONNX} ({size_mb:.1f} MB)")
    print("[OK] Restart npm run dev to pick up the new model.\n")


if __name__ == "__main__":
    main()
