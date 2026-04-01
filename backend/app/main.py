from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_db
from app.routers.upload import router as upload_router
from app.routers.chat import router as chat_router
from app.routers.sessions import router as sessions_router
from app.routers.documents import router as documents_router

app = FastAPI(title="RAG Study Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://study-assistant.vercel.app",  # Update with actual Vercel domain after deploy
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db()

app.include_router(upload_router)
app.include_router(chat_router)
app.include_router(sessions_router)
app.include_router(documents_router)

@app.get("/ping")
def ping():
    return {"status": "ok"}
