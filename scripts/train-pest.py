# -*- coding: utf-8 -*-
"""
Fine-tune YOLOv8n on the Pest dataset and export to ONNX.
"""
import os
import shutil
from pathlib import Path
from ultralytics import YOLO

ROOT        = Path(__file__).parent.parent
DATA_DIR    = ROOT / "pest_data"
MODELS_DIR  = ROOT / "public" / "models"
OUTPUT_ONNX = MODELS_DIR / "yolov8-pest.onnx"

def main():
    yaml_path = DATA_DIR / "data.yaml"
    
    if not yaml_path.exists():
        print(f"[ERROR] No data.yaml found at {yaml_path}. Run prepare_pest_dataset.py first.")
        return

    print(f"[INFO] Training with dataset: {yaml_path}")
    model = YOLO("yolov8n.pt")

    # Fine-tune for 30 epochs
    model.train(
        data=str(yaml_path),
        epochs=30,
        imgsz=640,
        batch=16,
        project=str(ROOT / "runs"),
        name="pest-detection",
        device=0,  # attempt to use CUDA if available
        verbose=False,
    )
    print("[OK] Training complete!\\n")

    # Load best weights
    best_weights = ROOT / "runs" / "pest-detection" / "weights" / "best.pt"
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
    print(f"[OK] Pest Model exported to: {OUTPUT_ONNX} ({size_mb:.1f} MB)")

if __name__ == "__main__":
    main()
