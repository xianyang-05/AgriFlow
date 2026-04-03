from app.database import SessionLocal
from app.repositories.crop_repository import CropRepository
from app.seed.crops import SEED_CROPS


def run_seed() -> None:
    repository = CropRepository()
    with SessionLocal() as db:
        repository.upsert_crops(db, SEED_CROPS)


if __name__ == "__main__":
    run_seed()
