import os
import secrets

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "cloudsync_persistent_secret_key_prod_2026_jwt_token_secure")
    STORAGE_DIR = os.environ.get("STORAGE_DIR", "storage")
    DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///cloudsync.db")
    TOKEN_EXPIRE_MINUTES = int(os.environ.get("TOKEN_EXPIRE_MINUTES", 1440))

config = Config()
