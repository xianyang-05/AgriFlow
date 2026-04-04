# -*- coding: utf-8 -*-
"""
Export a YOLOv8n model to ONNX format for browser inference.
The base yolov8n.pt is automatically downloaded from Ultralytics GitHub releases.
"""
import os
import sys
from pathlib import Path

output_dir = Path("public/models")
output_dir.mkdir(parents=True, exist_ok=True)
output_path = output_dir / "yolov8-plant.onnx"

if output_path.exists() and output_path.stat().st_size > 100_000:
    print(f"[OK] Model already exists: {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f} MB)")
    sys.exit(0)

print("[INFO] Exporting YOLOv8n to ONNX for browser inference...")
print("   (This downloads yolov8n.pt from Ultralytics and converts it)\n")

try:
    from ultralytics import YOLO

    # Load the nano model (auto-downloads ~6MB .pt from GitHub releases)
    model = YOLO("yolov8n.pt")

    # Export to ONNX with opset 12 for broad compatibility
    export_path = model.export(
        format="onnx",
        imgsz=640,
        opset=12,
        simplify=True,
        dynamic=False,
    )

    import shutil
    shutil.copy(export_path, output_path)
    print(f"\n[OK] ONNX model saved to: {output_path}")
    print(f"     Size: {output_path.stat().st_size / 1024 / 1024:.1f} MB")
    print("\n[NOTE] This is the base YOLOv8n (COCO 80-class) model.")
    print("       For 38-class plant disease detection, replace public/models/yolov8-plant.onnx")
    print("       with a model fine-tuned on PlantVillage dataset.")

except Exception as e:
    print(f"\n[ERROR] Export failed: {e}")
    sys.exit(1)
