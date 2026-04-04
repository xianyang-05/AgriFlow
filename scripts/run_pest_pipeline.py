# -*- coding: utf-8 -*-
"""
run_pest_pipeline.py
---------------------
One-shot pipeline:
  1. Download simranvolunesia/pest-dataset via kagglehub
  2. Prepare YOLO dataset (images + labels + data.yaml + pest-classes.json)
  3. Fine-tune YOLOv8n
  4. Export best weights → public/models/yolov8-pest.onnx

Usage:
    python scripts/run_pest_pipeline.py [--epochs 30] [--batch 16] [--device 0]

Prerequisites:
    pip install kagglehub ultralytics
    Kaggle API credentials: ~/.kaggle/kaggle.json
"""

import argparse
import shutil
import sys
from pathlib import Path

# ── ensure the scripts folder is importable ──────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))

ROOT       = Path(__file__).parent.parent
DATA_DIR   = ROOT / "pest_data"
MODELS_DIR = ROOT / "public" / "models"
OUTPUT_ONNX = MODELS_DIR / "yolov8-pest.onnx"


def step1_prepare() -> None:
    """Download dataset and convert to YOLO format."""
    print("\n" + "=" * 60)
    print("STEP 1 — Download & prepare pest dataset")
    print("=" * 60)
    from prepare_pest_dataset import main as prepare_main
    prepare_main()


def step2_train(epochs: int, batch: int, device: str) -> Path:
    """Fine-tune YOLOv8n. Returns path to best weights."""
    print("\n" + "=" * 60)
    print(f"STEP 2 — Fine-tune YOLOv8n  (epochs={epochs}, batch={batch}, device={device})")
    print("=" * 60)

    from ultralytics import YOLO

    yaml_path = DATA_DIR / "data.yaml"
    if not yaml_path.exists():
        raise FileNotFoundError(f"data.yaml not found at {yaml_path}. Run step 1 first.")

    model = YOLO("yolov8n.pt")
    model.train(
        data=str(yaml_path),
        epochs=epochs,
        imgsz=640,
        batch=batch,
        project=str(ROOT / "runs"),
        name="pest-detection",
        device=device,
        exist_ok=True,
        verbose=True,
    )

    best = ROOT / "runs" / "pest-detection" / "weights" / "best.pt"
    if not best.exists():
        raise FileNotFoundError(f"Training finished but best.pt not found at {best}")
    print(f"\n[OK] Best weights saved to {best}")
    return best


def step3_export(weights: Path) -> None:
    """Export .pt → ONNX and copy to public/models/."""
    print("\n" + "=" * 60)
    print("STEP 3 — Export to ONNX")
    print("=" * 60)

    from ultralytics import YOLO

    model = YOLO(str(weights))
    exported = model.export(
        format="onnx",
        imgsz=640,
        opset=12,
        simplify=True,
        dynamic=False,
    )

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy(exported, OUTPUT_ONNX)
    size_mb = OUTPUT_ONNX.stat().st_size / 1024 / 1024
    print(f"[OK] ONNX model → {OUTPUT_ONNX}  ({size_mb:.1f} MB)")


def main() -> None:
    parser = argparse.ArgumentParser(description="AgriFlow pest detection training pipeline")
    parser.add_argument("--epochs", type=int, default=30,  help="Training epochs (default 30)")
    parser.add_argument("--batch",  type=int, default=16,  help="Batch size (default 16)")
    parser.add_argument("--device", type=str, default="0", help="Device: 0 (GPU) or cpu")
    parser.add_argument("--skip-prepare", action="store_true", help="Skip download/prepare if already done")
    parser.add_argument("--skip-train",   action="store_true", help="Skip training (export existing weights)")
    args = parser.parse_args()

    if not args.skip_prepare:
        step1_prepare()

    if not args.skip_train:
        best_weights = step2_train(args.epochs, args.batch, args.device)
    else:
        best_weights = ROOT / "runs" / "pest-detection" / "weights" / "best.pt"
        if not best_weights.exists():
            raise FileNotFoundError(
                f"--skip-train set but no weights found at {best_weights}. "
                "Run without --skip-train first."
            )

    step3_export(best_weights)

    print("\n" + "=" * 60)
    print("ALL DONE — Pest model is ready for the browser!")
    print(f"  ONNX   → {OUTPUT_ONNX}")
    print(f"  JSON   → {MODELS_DIR / 'pest-classes.json'}")
    print("  Toggle Disease ↔ Pest in the AgriFlow dashboard.")
    print("=" * 60)


if __name__ == "__main__":
    main()
