import os
import shutil
import random
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
SOURCE_DIR = Path(r"C:\Users\IceBear\.cache\kagglehub\datasets\emmarex\plantdisease\versions\1\PlantVillage")
OUTPUT_DIR = ROOT / "plant_data"
MODELS_DIR = ROOT / "public" / "models"

# 1. Clean output directory
if OUTPUT_DIR.exists():
    shutil.rmtree(OUTPUT_DIR)

dirs = {
    "images_train": OUTPUT_DIR / "images" / "train",
    "images_val": OUTPUT_DIR / "images" / "val",
    "labels_train": OUTPUT_DIR / "labels" / "train",
    "labels_val": OUTPUT_DIR / "labels" / "val",
}
for d in dirs.values():
    d.mkdir(parents=True, exist_ok=True)

# 2. Discover classes
class_names = []
for entry in os.listdir(SOURCE_DIR):
    path = SOURCE_DIR / entry
    if path.is_dir() and entry != "PlantVillage":
        class_names.append(entry)

class_names.sort()

# Create class map
frontend_classes = []
for idx, name in enumerate(class_names):
    # Try to extract crop name
    parts = name.split('_')
    crop = parts[0]
    
    is_healthy = "healthy" in name.lower()
    severity = "none" if is_healthy else "medium"
    
    display_name = name.replace("_", " ").replace("  ", " ").strip()
    
    frontend_classes.append({
        "id": idx,
        "name": name,
        "displayName": display_name,
        "crop": crop,
        "severity": severity,
        "treatment": "N/A" if is_healthy else "Apply specific fungicide/bactericide.",
        "prevention": "Ensure good airflow and watering." if is_healthy else "Remove infected leaves.",
        "isHealthy": is_healthy
    })

# 3. Create dataset
print(f"Discovered {len(class_names)} classes. Processing images...")

for idx, name in enumerate(class_names):
    class_dir = SOURCE_DIR / name
    images = [f for f in os.listdir(class_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    random.shuffle(images)
    
    # 80/20 split
    split_idx = int(len(images) * 0.8)
    train_imgs = images[:split_idx]
    val_imgs = images[split_idx:]
    
    for split, imgs in [("train", train_imgs), ("val", val_imgs)]:
        img_dir = dirs[f"images_{split}"]
        lbl_dir = dirs[f"labels_{split}"]
        
        for img in imgs:
            src_img = class_dir / img
            # Avoid name collisions if image names are generic (e.g. image (1).jpg)
            dst_name = f"{name}_{img}"
            dst_img = img_dir / dst_name
            
            shutil.copy(src_img, dst_img)
            
            # Create full bounding box: <class_index> 0.5 0.5 1.0 1.0
            lbl_file = lbl_dir / f"{Path(dst_name).stem}.txt"
            with open(lbl_file, "w") as f:
                f.write(f"{idx} 0.5 0.5 1.0 1.0\n")

# 4. Generate data.yaml
yaml_content = f"""path: {OUTPUT_DIR.resolve().as_posix()}
train: images/train
val: images/val
nc: {len(class_names)}
names:
"""
for idx, name in enumerate(class_names):
    yaml_content += f"  {idx}: {name}\n"

with open(OUTPUT_DIR / "data.yaml", "w") as f:
    f.write(yaml_content)

# 5. Overwrite plant-classes.json
with open(MODELS_DIR / "plant-classes.json", "w") as f:
    json.dump(frontend_classes, f, indent=2)

print("\n[OK] Dataset converted to YOLO Object Detection format!")
print(f"Data ready in {OUTPUT_DIR}")
print("[OK] UI class map updated. Note: The frontend model needs to be retrained on this data.")
