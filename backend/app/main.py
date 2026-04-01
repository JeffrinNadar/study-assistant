from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_db
from app.routers.upload import router as upload_router

app = FastAPI(title="RAG Study Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db()

app.include_router(upload_router)

@app.get("/ping")
def ping():
    return {"status": "ok"}
