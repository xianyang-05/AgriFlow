import kagglehub
import os

path = kagglehub.dataset_download("simranvolunesia/pest-dataset")
print("Path to dataset files:", path)

for root, dirs, files in os.walk(path):
    rel_path = os.path.relpath(root, path)
    depth = rel_path.count(os.sep)
    if depth < 3:
        print(f"{'  ' * depth}{os.path.basename(root)}/ ({len(dirs)} dirs, {len(files)} files)")
