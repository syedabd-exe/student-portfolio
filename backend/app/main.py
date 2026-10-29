from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from . import models
from .routes import protected_router, router


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Student Portfolio System",
    description="Manage student profiles, achievements, activities and projects",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.include_router(protected_router, prefix="/api")


@app.get("/")
def home():
    return {
        "message": "Student Portfolio System API is running!"
    }


@app.get("/api/health")
def health():
    return {"status": "online"}