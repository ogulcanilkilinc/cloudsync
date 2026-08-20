import os
import io
import zipfile
import urllib.parse
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import User, FileRecord
from server.auth import get_current_user
from server.services import file_service, sync_service

router = APIRouter(prefix="/api/files", tags=["Files"])

@router.get("/list")
def list_files(path: str = "", current_user: User = Depends(get_current_user)):
    return file_service.list_directory(current_user.id, path)

@router.post("/upload")
async def upload_file(path: str = Form(""), file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = await file.read()
    # Support both folder path and full relative path
    if path and (path.endswith(file.filename) or "/" in path):
        if path.endswith(file.filename):
            full_path = path
        else:
            full_path = f"{path.rstrip('/')}/{file.filename}"
    else:
        full_path = f"{path}/{file.filename}" if path else file.filename
        
    full_path = full_path.lstrip("/")
    record = file_service.save_file(db, current_user.id, full_path, content)
    sync_service.log_sync_action(db, current_user.id, full_path, "upload", "Web")
    return {"message": "File uploaded", "path": full_path}

@router.get("/download")
def download_file(path: str, current_user: User = Depends(get_current_user)):
    try:
        content, mime_type = file_service.read_file(current_user.id, path)
        filename = os.path.basename(path)
        encoded_name = urllib.parse.quote(filename)
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{encoded_name}',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
        return Response(content=content, media_type=mime_type or "application/octet-stream", headers=headers)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dosya sunucuda bulunamadı.")

@router.get("/download-folder")
def download_folder(path: str = "", current_user: User = Depends(get_current_user)):
    try:
        zip_buf = file_service.create_zip_of_path(current_user.id, path)
        folder_name = os.path.basename(path) if path else "tum_dosyalar"
        encoded_name = urllib.parse.quote(f"{folder_name}.zip")
        return StreamingResponse(
            iter([zip_buf.getvalue()]),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{folder_name}.zip"; filename*=UTF-8\'\'{encoded_name}',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class EditRequest(BaseModel):
    path: str
    content: str

@router.put("/edit")
def edit_file(req: EditRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    file_service.save_file(db, current_user.id, req.path, req.content.encode('utf-8'))
    sync_service.log_sync_action(db, current_user.id, req.path, "edit", "Web")
    return {"message": "File updated"}

@router.delete("/delete")
def delete_file(path: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    success = file_service.delete_item(db, current_user.id, path)
    if not success:
        raise HTTPException(status_code=404, detail="Öğe bulunamadı.")
    sync_service.log_sync_action(db, current_user.id, path, "delete", "Web")
    return {"message": "Deleted"}

class MkdirRequest(BaseModel):
    path: str

@router.post("/mkdir")
def mkdir(req: MkdirRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    file_service.create_directory(db, current_user.id, req.path)
    sync_service.log_sync_action(db, current_user.id, req.path, "mkdir", "Web")
    return {"message": "Directory created"}

class RenameRequest(BaseModel):
    path: str
    new_name: str

@router.post("/rename")
def rename(req: RenameRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    file_service.rename_item(db, current_user.id, req.path, req.new_name)
    sync_service.log_sync_action(db, current_user.id, req.path, f"rename to {req.new_name}", "Web")
    return {"message": "Renamed"}

class MoveRequest(BaseModel):
    old_path: str
    new_path: str

@router.post("/move")
def move(req: MoveRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    file_service.move_item(db, current_user.id, req.old_path, req.new_path)
    sync_service.log_sync_action(db, current_user.id, req.old_path, f"move to {req.new_path}", "Web")
    return {"message": "Moved"}

class ZipRequest(BaseModel):
    paths: List[str]

@router.post("/download-zip")
def download_zip(req: ZipRequest, current_user: User = Depends(get_current_user)):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
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
        headers={
            "Content-Disposition": 'attachment; filename="secilen_dosyalar.zip"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
