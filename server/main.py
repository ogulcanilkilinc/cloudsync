from fastapi import FastAPI, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os

from server.database import init_db, get_db, engine
from server.config import config
from server.models import User
from server.auth import hash_password
from server.routes import auth_routes, file_routes, sync_routes

app = FastAPI(title="CloudSync")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(config.STORAGE_DIR, exist_ok=True)

static_dir = os.path.join(os.path.dirname(__file__), "static")
template_dir = os.path.join(os.path.dirname(__file__), "templates")

app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=template_dir)

app.include_router(auth_routes.router)
app.include_router(file_routes.router)
app.include_router(sync_routes.router)

@app.on_event("startup")
def startup():
    init_db()
    db = next(get_db())
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        new_admin = User(username="admin", password_hash=hash_password("admin123"))
        db.add(new_admin)
        db.commit()
    db.close()

@app.get("/")
def index(request: Request):
    return templates.TemplateResponse(request, "login.html")

@app.get("/dashboard")
def dashboard(request: Request):
    return templates.TemplateResponse(request, "dashboard.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
