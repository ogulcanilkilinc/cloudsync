import os
import shutil
import hashlib
import mimetypes
import io
import zipfile
from pathlib import Path
from datetime import datetime
from server.config import config
from sqlalchemy.orm import Session
from server.models import FileRecord

def get_user_storage_path(user_id: int) -> Path:
    storage_path = Path(config.STORAGE_DIR) / str(user_id)
    storage_path.mkdir(parents=True, exist_ok=True)
    return storage_path

def _safe_path(base_path: Path, relative_path: str) -> Path:
    target = base_path / relative_path.lstrip("/")
    try:
        target.resolve().relative_to(base_path.resolve())
    except ValueError:
        raise ValueError("Invalid path: directory traversal attempt")
    return target

def calculate_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def get_file_record(db: Session, user_id: int, relative_path: str) -> FileRecord:
    return db.query(FileRecord).filter(
        FileRecord.user_id == user_id, 
        FileRecord.relative_path == relative_path
    ).first()

def update_file_record(db: Session, user_id: int, relative_path: str, file_hash: str, size: int, mime_type: str):
    record = get_file_record(db, user_id, relative_path)
    if not record:
        record = FileRecord(
            user_id=user_id,
            filename=os.path.basename(relative_path),
            relative_path=relative_path,
            is_directory=False
        )
        db.add(record)
    record.file_hash = file_hash
    record.size = size
    record.mime_type = mime_type
    db.commit()
    db.refresh(record)
    return record

def save_file(db: Session, user_id: int, relative_path: str, file_content: bytes) -> FileRecord:
    base_path = get_user_storage_path(user_id)
    target_path = _safe_path(base_path, relative_path)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(target_path, "wb") as f:
        f.write(file_content)
    
    f_hash = calculate_hash(file_content)
    size = len(file_content)
    mime_type, _ = mimetypes.guess_type(target_path.name)
    
    return update_file_record(db, user_id, relative_path, f_hash, size, mime_type or "application/octet-stream")

def read_file(user_id: int, relative_path: str) -> tuple[bytes, str]:
    base_path = get_user_storage_path(user_id)
    target_path = _safe_path(base_path, relative_path)
    if not target_path.exists() or not target_path.is_file():
        raise FileNotFoundError()
    
    with open(target_path, "rb") as f:
        content = f.read()
    
    mime_type, _ = mimetypes.guess_type(target_path.name)
    return content, mime_type or "application/octet-stream"

def create_zip_of_path(user_id: int, relative_path: str) -> io.BytesIO:
    base_path = get_user_storage_path(user_id)
    target_path = _safe_path(base_path, relative_path)
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        if target_path.is_dir():
            for root, dirs, files in os.walk(target_path):
                for file in files:
                    file_full = Path(root) / file
                    arcname = file_full.relative_to(target_path if relative_path else base_path)
                    zip_file.write(file_full, str(arcname).replace("\\", "/"))
        elif target_path.is_file():
            zip_file.write(target_path, target_path.name)
    zip_buffer.seek(0)
    return zip_buffer

def delete_item(db: Session, user_id: int, relative_path: str) -> bool:
    base_path = get_user_storage_path(user_id)
    target_path = _safe_path(base_path, relative_path)
    if not target_path.exists():
        return False
    
    if target_path.is_dir():
        shutil.rmtree(target_path)
        # Delete DB records
        records = db.query(FileRecord).filter(
            FileRecord.user_id == user_id,
            FileRecord.relative_path.startswith(relative_path)
        ).all()
        for r in records:
            db.delete(r)
    else:
        target_path.unlink()
        r = get_file_record(db, user_id, relative_path)
        if r:
            db.delete(r)
    db.commit()
    return True

def create_directory(db: Session, user_id: int, relative_path: str) -> bool:
    base_path = get_user_storage_path(user_id)
    target_path = _safe_path(base_path, relative_path)
    target_path.mkdir(parents=True, exist_ok=True)
    
    record = get_file_record(db, user_id, relative_path)
    if not record:
        record = FileRecord(
            user_id=user_id,
            filename=os.path.basename(relative_path),
            relative_path=relative_path,
            is_directory=True
        )
        db.add(record)
        db.commit()
    return True

def rename_item(db: Session, user_id: int, old_path: str, new_name: str) -> bool:
    base_path = get_user_storage_path(user_id)
    old_target = _safe_path(base_path, old_path)
    if not old_target.exists():
        return False
    
    new_path = str(Path(old_path).parent / new_name).replace("\\", "/")
    if new_path.startswith("./"):
        new_path = new_path[2:]
    
    new_target = _safe_path(base_path, new_path)
    old_target.rename(new_target)
    
    # Update DB
    record = get_file_record(db, user_id, old_path)
    if record:
        record.relative_path = new_path
        record.filename = new_name
        db.commit()
        
    return True

def move_item(db: Session, user_id: int, old_path: str, new_path: str) -> bool:
    base_path = get_user_storage_path(user_id)
    old_target = _safe_path(base_path, old_path)
    if not old_target.exists():
        return False
        
    new_target = _safe_path(base_path, new_path)
    new_target.parent.mkdir(parents=True, exist_ok=True)
    
    old_target.rename(new_target)
    
    record = get_file_record(db, user_id, old_path)
    if record:
        record.relative_path = new_path
        record.filename = os.path.basename(new_path)
        db.commit()
    return True

def list_directory(user_id: int, relative_path: str) -> list:
    base_path = get_user_storage_path(user_id)
    target_path = _safe_path(base_path, relative_path)
    
    results = []
    if target_path.exists() and target_path.is_dir():
        for item in target_path.iterdir():
            stat = item.stat()
            mime, _ = mimetypes.guess_type(item.name)
            results.append({
                "name": item.name,
                "path": str(item.relative_to(base_path)).replace("\\", "/"),
                "is_directory": item.is_dir(),
                "size": stat.st_size if not item.is_dir() else 0,
                "mime_type": mime if not item.is_dir() else None,
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "file_hash": None
            })
    return results
