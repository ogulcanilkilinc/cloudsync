from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import User, SyncLog
from server.auth import get_current_user
from server.services import sync_service, file_service

router = APIRouter(prefix="/api/sync", tags=["Sync"])

@router.get("/manifest")
def get_manifest(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return sync_service.get_file_manifest(db, current_user.id)

class ManifestItem(BaseModel):
    path: str
    hash: str
    size: int
    updated_at: str

class CheckRequest(BaseModel):
    client_manifest: List[ManifestItem]

@router.post("/check")
def check_sync(req: CheckRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    server_manifest = sync_service.get_file_manifest(db, current_user.id)
    client_dicts = [{"path": m.path, "hash": m.hash, "size": m.size, "updated_at": m.updated_at} for m in req.client_manifest]
    return sync_service.compare_manifests(server_manifest, client_dicts)

@router.post("/push")
async def push_file(
    path: str = Form(...),
    device_name: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    content = await file.read()
    file_service.save_file(db, current_user.id, path, content)
    sync_service.log_sync_action(db, current_user.id, path, "upload", device_name)
    return {"message": "Pushed successfully"}

class PullRequest(BaseModel):
    paths: List[str]

@router.post("/pull")
def pull_files(req: PullRequest, current_user: User = Depends(get_current_user)):
    import io, zipfile
    from fastapi.responses import StreamingResponse
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zip_file:
        for p in req.paths:
            try:
                content, _ = file_service.read_file(current_user.id, p)
                zip_file.writestr(p, content)
            except FileNotFoundError:
                pass
    zip_buffer.seek(0)
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=pull.zip"}
    )

@router.post("/resolve-conflict")
async def resolve_conflict(
    path: str = Form(...),
    device_name: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    content = await file.read()
    new_path = sync_service.resolve_conflict(db, current_user.id, path, content, device_name)
    return {"message": "Conflict resolved", "new_path": new_path}

@router.get("/log")
def get_logs(limit: int = 50, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = db.query(SyncLog).filter(SyncLog.user_id == current_user.id).order_by(SyncLog.timestamp.desc()).limit(limit).all()
    return logs
