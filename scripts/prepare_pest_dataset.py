# -*- coding: utf-8 -*-
"""
prepare_pest_dataset.py
------------------------
Downloads the simranvolunesia/pest-dataset from Kaggle via kagglehub,
then converts it into YOLO object-detection format (full-image bounding boxes)
ready for fine-tuning YOLOv8.

Usage:
    python scripts/prepare_pest_dataset.py

Prerequisites:
    pip install kagglehub
    Kaggle API credentials configured (~/.kaggle/kaggle.json)
"""

import os
import shutil
import random
import json
import kagglehub
from pathlib import Path

ROOT       = Path(__file__).parent.parent
OUTPUT_DIR = ROOT / "pest_data"
MODELS_DIR = ROOT / "public" / "models"

# ── Severity / treatment overrides per class name (case-insensitive) ──────────
# Extend this dict to give specific advice for known pest species.
PEST_META: dict[str, dict] = {
    "aphids": {
        "severity": "medium",
        "treatment": "Apply insecticidal soap or neem oil spray. Introduce ladybugs as natural predators.",
        "prevention": "Encourage beneficial insects; avoid nitrogen over-fertilisation.",
    },
    "armyworm": {
        "severity": "high",
        "treatment": "Apply Bacillus thuringiensis (Bt) or spinosad-based insecticides at dusk.",
        "prevention": "Use pheromone traps and practice crop rotation.",
    },
    "beetle": {
        "severity": "medium",
        "treatment": "Hand-pick adults; apply pyrethrin if infestation is severe.",
        "prevention": "Row covers and sticky traps help break the cycle.",
    },
    "bollworm": {
        "severity": "high",
        "treatment": "Apply chlorantraniliprole or Bt. Remove infested plant parts immediately.",
        "prevention": "Plant early-maturing varieties; use pheromone traps.",
    },
    "grasshopper": {
        "severity": "high",
        "treatment": "Apply carbaryl or malathion in early morning when pests are sluggish.",
        "prevention": "Till soil in late summer to expose egg pods; encourage natural predators.",
    },
    "mites": {
        "severity": "medium",
        "treatment": "Apply miticide or neem oil; ensure adequate soil moisture.",
        "prevention": "Avoid dusty conditions; maintain proper irrigation.",
    },
    "mosquito": {
        "severity": "low",
        "treatment": "Eliminate standing water; use Bti granules in water bodies.",
        "prevention": "Improve drainage; use physical barriers.",
    },
    "sawfly": {
        "severity": "medium",
        "treatment": "Hand-pick larvae; apply spinosad or pyrethrin sprays.",
        "prevention": "Monitor early in the season; encourage parasitic wasps.",
    },
    "stem_borer": {
        "severity": "high",
        "treatment": "Apply carbofuran or chlorpyrifos at the recommended rate; remove affected tillers.",
        "prevention": "Use resistant varieties; avoid late planting.",
    },
    "thrips": {
        "severity": "medium",
        "treatment": "Apply spinosad or imidacloprid; remove heavily infested flowers.",
        "prevention": "Use reflective mulches; release minute pirate bugs.",
    },
    "whitefly": {
        "severity": "medium",
        "treatment": "Apply insecticidal soap or neem oil. Yellow sticky traps are effective.",
        "prevention": "Introduce Encarsia formosa; avoid over-fertilising with nitrogen.",
    },
}


def meta_for(name: str) -> dict:
    """Return severity/treatment/prevention for a pest class name."""
    key = name.lower().replace(" ", "_")
    for pattern, vals in PEST_META.items():
        if pattern in key:
            return vals
    return {
        "severity": "high",
        "treatment": (
            f"Apply appropriate pesticide specific to {name.replace('_', ' ').title()}. "
            "Consult a local agronomist for correct dosage."
        ),
        "prevention": "Implement crop rotation, regular scouting, and integrated pest management (IPM).",
    }


def main() -> None:
    # ── 1. Download from Kaggle ──────────────────────────────────────────────
    print("Downloading kaggle dataset simranvolunesia/pest-dataset …")
    path = kagglehub.dataset_download("simranvolunesia/pest-dataset")
    print("Path to dataset files:", path)
    SOURCE_DIR = Path(path)

    # ── 2. Create output directory structure ────────────────────────────────
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)

    dirs = {
        "images_train": OUTPUT_DIR / "images" / "train",
        "images_val":   OUTPUT_DIR / "images" / "val",
        "labels_train": OUTPUT_DIR / "labels" / "train",
        "labels_val":   OUTPUT_DIR / "labels" / "val",
    }
    for d in dirs.values():
        d.mkdir(parents=True, exist_ok=True)

    # ── 3. Discover leaf-level class directories ─────────────────────────────
    #   Walk the dataset and collect directories that contain only images.
    class_dirs: list[str] = []
    for root, dnames, fnames in os.walk(SOURCE_DIR):
        img_files = [f for f in fnames if f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".webp"))]
        if not dnames and img_files:
            class_dirs.append(root)

    if not class_dirs:
        raise RuntimeError(
            f"No leaf image directories found under {SOURCE_DIR}. "
            "Check that the dataset downloaded correctly."
        )

    # Build sorted unique class name → directory map
    class_map: dict[str, str] = {}
    for cd in class_dirs:
        name = os.path.basename(cd)
        if name not in class_map:
            class_map[name] = cd

    class_names = sorted(class_map.keys())
    print(f"Discovered {len(class_names)} pest classes: {class_names}")

    # ── 4. Build frontend class list (pest-classes.json) ────────────────────
    frontend_classes = []
    for idx, name in enumerate(class_names):
        display_name = name.replace("_", " ").title()
        m = meta_for(name)
        frontend_classes.append({
            "id":          idx,
            "name":        name,
            "displayName": display_name,
            "crop":        "N/A",
            "severity":    m["severity"],
            "treatment":   m["treatment"],
            "prevention":  m["prevention"],
            "isHealthy":   False,
        })

    # ── 5. Copy images + create YOLO labels ──────────────────────────────────
    total_train = total_val = 0
    for idx, name in enumerate(class_names):
        class_dir = Path(class_map[name])
        images = sorted(
            f for f in os.listdir(class_dir)
            if f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".webp"))
        )
        random.shuffle(images)

        split_idx  = max(1, int(len(images) * 0.8))
        train_imgs = images[:split_idx]
        val_imgs   = images[split_idx:] or images[:1]  # ensure at least 1 val image

        for split, imgs in [("train", train_imgs), ("val", val_imgs)]:
            img_dir = dirs[f"images_{split}"]
            lbl_dir = dirs[f"labels_{split}"]

            for img in imgs:
                src  = class_dir / img
                stem = Path(img).stem
                # Prefix with class name to guarantee uniqueness across classes
                dst_name = f"{name}_{stem}"
                shutil.copy(src, img_dir / f"{dst_name}{Path(img).suffix}")

                # Full-image bounding box: class cx cy w h (normalised)
                with open(lbl_dir / f"{dst_name}.txt", "w") as f:
                    f.write(f"{idx} 0.5 0.5 1.0 1.0\n")

        total_train += len(train_imgs)
        total_val   += len(val_imgs)

    print(f"Dataset split — train: {total_train} images, val: {total_val} images")

    # ── 6. Write data.yaml ───────────────────────────────────────────────────
    yaml_lines = [
        f"path: {OUTPUT_DIR.resolve().as_posix()}",
        "train: images/train",
        "val:   images/val",
        f"nc: {len(class_names)}",
        "names:",
    ]
    for idx, name in enumerate(class_names):
        yaml_lines.append(f"  {idx}: {name}")

    with open(OUTPUT_DIR / "data.yaml", "w") as f:
        f.write("\n".join(yaml_lines) + "\n")

    # ── 7. Export pest-classes.json to public/models ─────────────────────────
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    out_json = MODELS_DIR / "pest-classes.json"
    with open(out_json, "w") as f:
        json.dump(frontend_classes, f, indent=2)

    print("\n[OK] Pest dataset converted to YOLO Object Detection format!")
    print(f"     Data  → {OUTPUT_DIR}")
    print(f"     JSON  → {out_json}")
    print(f"     Classes: {class_names}")


if __name__ == "__main__":
    main()
