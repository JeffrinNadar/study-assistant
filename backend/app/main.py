import time
import logging

logging.basicConfig(level=logging.INFO)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_db
from app.routers.upload import router as upload_router
from app.routers.chat import router as chat_router
from app.routers.sessions import router as sessions_router
from app.routers.documents import router as documents_router
from app.routers.auth import router as auth_router

latency_logger = logging.getLogger("latency")

app = FastAPI(title="RAG Study Assistant")

# Request timing middleware
@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
    latency_logger.info(
        "%s %s — %.1fms",
        request.method,
        request.url.path,
        duration_ms,
    )
    return response

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://study-assistant-green.vercel.app",  # Update with actual Vercel domain after deploy
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db()

app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(chat_router)
app.include_router(sessions_router)
app.include_router(documents_router)

@app.get("/ping")
def ping():
    return {"status": "ok"}
