import os
import secrets

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", secrets.token_hex(32))
    STORAGE_DIR = os.environ.get("STORAGE_DIR", "storage")
    DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///cloudsync.db")
    TOKEN_EXPIRE_MINUTES = int(os.environ.get("TOKEN_EXPIRE_MINUTES", 1440))

config = Config()
