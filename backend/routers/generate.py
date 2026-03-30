"""
/generate/* routes — AI-powered graph structure generation.
"""
import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from models import (
    AIConfig,
    GenerateRequest,
    GenerateGraphResponse,
    GenerateThemeResponse,
    GenerateEventsResponse,
    GenerateProjectResponse,
)
from services.ai_service import (
    generate_graph_data,
    generate_graph_from_file,
    generate_theme_config,
    generate_event_sequence,
)

router = APIRouter(prefix="/generate", tags=["generate"])


def _graph_to_json(graph_data) -> str:
    return json.dumps(graph_data.model_dump(by_alias=True, exclude_none=True), ensure_ascii=False)


def _theme_to_json(theme_data) -> str:
    return json.dumps(theme_data.model_dump(exclude_none=True), ensure_ascii=False)


@router.post("/graph-from-file", response_model=GenerateGraphResponse)
async def generate_graph_file(
    file: UploadFile = File(...),
    config: str = Form(...),  # JSON-encoded AIConfig
):
    """
    Generate a GraphData by analyzing an uploaded file (image, PDF, text).
    `config` is a JSON string: {"api_key":"...", "base_url":"...", "model":"..."}.
    """
    try:
        ai_config = AIConfig.model_validate_json(config)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid config: {e}")

    content = await file.read()

    try:
        graph_data = await generate_graph_from_file(
            ai_config, content, file.filename or "upload"
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return GenerateGraphResponse(graph_data=graph_data)


@router.post("/graph", response_model=GenerateGraphResponse)
async def generate_graph(req: GenerateRequest):
    """Generate a GraphData (nodes + links) from a text description."""
    try:
        graph_data = await generate_graph_data(req.config, req.prompt)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return GenerateGraphResponse(graph_data=graph_data)


@router.post("/theme", response_model=GenerateThemeResponse)
async def generate_theme(req: GenerateRequest):
    """Generate a ThemeConfig based on the graph structure and description."""
    if not req.context or not req.context.graph_data:
        raise HTTPException(
            status_code=422,
            detail="context.graph_data is required for theme generation.",
        )
    graph_json = _graph_to_json(req.context.graph_data)
    try:
        theme_data = await generate_theme_config(req.config, req.prompt, graph_json)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return GenerateThemeResponse(theme_data=theme_data)


@router.post("/events", response_model=GenerateEventsResponse)
async def generate_events(req: GenerateRequest):
    """Generate an EventSequence (animation steps) for the given graph."""
    if not req.context or not req.context.graph_data:
        raise HTTPException(
            status_code=422,
            detail="context.graph_data is required for event generation.",
        )
    graph_json = _graph_to_json(req.context.graph_data)
    theme_json = (
        _theme_to_json(req.context.theme_data)
        if req.context.theme_data
        else "{}"
    )
    try:
        event_data = await generate_event_sequence(
            req.config, req.prompt, graph_json, theme_json
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return GenerateEventsResponse(event_data=event_data)


@router.post("/project", response_model=GenerateProjectResponse)
async def generate_project(req: GenerateRequest):
    """
    Generate a complete project in one call:
    graph → theme → events (sequential, each informed by the previous).
    """
    try:
        # Step 1: graph structure
        graph_data = await generate_graph_data(req.config, req.prompt)

        # Step 2: theme based on graph
        graph_json = _graph_to_json(graph_data)
        theme_data = await generate_theme_config(req.config, req.prompt, graph_json)

        # Step 3: events based on graph + theme
        theme_json = _theme_to_json(theme_data)
        event_data = await generate_event_sequence(
            req.config, req.prompt, graph_json, theme_json
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return GenerateProjectResponse(
        graph_data=graph_data,
        theme_data=theme_data,
        event_data=event_data,
    )
