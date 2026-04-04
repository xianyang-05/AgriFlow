# -*- coding: utf-8 -*-
"""
Download a plant-disease YOLOv8 ONNX model from HuggingFace.
Tries multiple public repos until one works.
Run: python scripts/download-plant-model.py
"""
import sys
import shutil
import os
from pathlib import Path

ROOT       = Path(__file__).parent.parent
OUTPUT_DIR = ROOT / "public" / "models"
OUTPUT     = OUTPUT_DIR / "yolov8-plant.onnx"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

if OUTPUT.exists() and OUTPUT.stat().st_size > 5_000_000:
    print(f"[OK] Model already present: {OUTPUT} ({OUTPUT.stat().st_size/1024/1024:.1f} MB)")
    sys.exit(0)

CANDIDATES = [
    # repo_id, filename
    ("foduucom/plant-disease-detection-using-yolov8", "best.onnx"),
    ("MatthewSo/plant-disease-yolov8",                "best.onnx"),
    ("keremberke/yolov8n-plant-disease",               "yolov8n-plant-disease.onnx"),
]

try:
    from huggingface_hub import hf_hub_download, HfApi
    print("[INFO] huggingface_hub available – attempting download...\n")
except ImportError:
    print("[INFO] Installing huggingface_hub...")
    os.system(f"{sys.executable} -m pip install huggingface_hub -q")
    from huggingface_hub import hf_hub_download, HfApi

for repo_id, filename in CANDIDATES:
    print(f"[TRY] {repo_id}/{filename}")
    try:
        path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            token=os.environ.get("HF_TOKEN"),   # optional auth token
        )
        shutil.copy(path, OUTPUT)
        size = OUTPUT.stat().st_size / 1024 / 1024
        print(f"[OK]  Saved to {OUTPUT} ({size:.1f} MB)")
        sys.exit(0)
    except Exception as e:
        print(f"[SKIP] {e}\n")

print("\n[WARN] All HuggingFace sources failed (repos may be gated).")
print("       Falling back to base YOLOv8n (COCO 80-class).")
print("       To use plant-disease detection, provide HF_TOKEN or train your own:")
print("       python scripts/train-plant-disease.py\n")

# Last resort: copy existing base model if present
base = ROOT / "yolov8n.onnx"
if base.exists():
    shutil.copy(base, OUTPUT)
    print(f"[OK] Copied base yolov8n.onnx -> {OUTPUT}")
else:
    print("[INFO] Running export-model.py to generate base ONNX...")
    os.system(f"{sys.executable} {ROOT / 'scripts' / 'export-model.py'}")
