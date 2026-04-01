import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Pillow not installed")
    sys.exit(1)

import glob

files = ["public/cursor.png", "public/preparation.png", "public/planting.png", "public/vegetative.png", "public/harvest.png"]

for f in files:
    if os.path.exists(f):
        print(f"Processing {f}...")
        img = Image.open(f).convert("RGBA")
        datas = img.getdata()
        newData = []
        for item in datas:
            # remove white bg by checking RGB thresholds (near white)
            if item[0] > 230 and item[1] > 230 and item[2] > 230:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)
        img.putdata(newData)
        img.save(f, "PNG")
        print(f"Saved {f}")

print("Done")
