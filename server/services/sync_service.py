from sqlalchemy.orm import Session
from datetime import datetime
import os
from server.models import FileRecord, SyncLog
from server.services.file_service import save_file

def get_file_manifest(db: Session, user_id: int):
    records = db.query(FileRecord).filter(FileRecord.user_id == user_id, FileRecord.is_directory == False).all()
    return [{"path": r.relative_path, "hash": r.file_hash, "size": r.size, "updated_at": r.updated_at.isoformat()} for r in records]

def compare_manifests(server_manifest: list, client_manifest: list) -> dict:
    server_dict = {f["path"]: f for f in server_manifest}
    client_dict = {f["path"]: f for f in client_manifest}
    
    to_upload = []
    to_download = []
    conflicts = []
    to_delete_server = []
    to_delete_client = []
    
    all_paths = set(server_dict.keys()).union(client_dict.keys())
    for path in all_paths:
        s_file = server_dict.get(path)
        c_file = client_dict.get(path)
        
        if s_file and not c_file:
            to_download.append(path)
        elif c_file and not s_file:
            to_upload.append(path)
        elif s_file and c_file:
            if s_file["hash"] != c_file["hash"]:
                conflicts.append(path)
                
    return {
        "to_upload": to_upload,
        "to_download": to_download,
        "conflicts": conflicts,
        "to_delete_server": to_delete_server,
        "to_delete_client": to_delete_client
    }

def resolve_conflict(db: Session, user_id: int, relative_path: str, client_content: bytes, device_name: str):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    name, ext = os.path.splitext(relative_path)
    conflict_path = f"{name}_CONFLICT_{timestamp}{ext}"
    
    save_file(db, user_id, conflict_path, client_content)
    log_sync_action(db, user_id, conflict_path, "conflict_resolved", device_name)
    return conflict_path

def log_sync_action(db: Session, user_id: int, file_path: str, action: str, device_name: str):
    log = SyncLog(
        user_id=user_id,
        file_path=file_path,
        action=action,
        device_name=device_name
    )
    db.add(log)
    db.commit()
