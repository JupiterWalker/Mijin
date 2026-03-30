"""
GraphFlow AI Backend — FastAPI entry point.

Start with:
    source .venv/bin/activate
    uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.generate import router as generate_router

app = FastAPI(
    title="GraphFlow AI Backend",
    description="AI-powered graph structure generation using OpenAI-compatible APIs.",
    version="1.0.0",
)

# Allow all origins in development — tighten in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate_router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
