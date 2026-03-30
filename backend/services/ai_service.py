"""
LangChain-based AI service for structured graph generation.
Uses streaming to avoid proxy/connection timeouts on long responses.
"""
import json
import re
from typing import Any, Type, TypeVar

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from openai import AsyncOpenAI
from pydantic import BaseModel

from models import AIConfig

T = TypeVar("T", bound=BaseModel)


def _build_llm(config: AIConfig) -> ChatOpenAI:
    kwargs: dict[str, Any] = {
        "api_key": config.api_key,
        "model": config.model,
        "temperature": 0.7,
        "streaming": True,
    }
    if config.base_url:
        kwargs["base_url"] = config.base_url
    return ChatOpenAI(**kwargs)


def _build_openai_client(config: AIConfig) -> AsyncOpenAI:
    kwargs: dict[str, Any] = {"api_key": config.api_key}
    if config.base_url:
        kwargs["base_url"] = config.base_url
    return AsyncOpenAI(**kwargs)


async def _chat_streaming(config: AIConfig, messages: list) -> str:
    """Call the API with streaming to avoid proxy timeout on long responses."""
    client = _build_openai_client(config)
    openai_messages = [
        {"role": "system" if isinstance(m, SystemMessage) else "user", "content": m.content}
        for m in messages
    ]
    chunks = []
    stream = await client.chat.completions.create(
        model=config.model,
        messages=openai_messages,
        temperature=0.7,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        chunks.append(delta)
    return "".join(chunks)


async def generate_structured(
    config: AIConfig,
    system_prompt: str,
    user_prompt: str,
    response_model: Type[T],
) -> T:
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]
    try:
        raw = await _chat_streaming(config, messages)
        match = re.search(r"\{[\s\S]*\}", raw)
        data = json.loads(match.group() if match else raw)
        return response_model.model_validate(data)
    except Exception as exc:
        raise RuntimeError(f"AI generation failed: {exc}") from exc


async def generate_graph_from_file(
    config: AIConfig,
    file_content: bytes,
    file_name: str,
) -> Any:
    from models import GraphData
    from prompts import GRAPH_SYSTEM_PROMPT

    text = file_content.decode("utf-8", errors="replace")
    user_prompt = f"File: {file_name}\n\n{text}"

    return await generate_structured(
        config=config,
        system_prompt=GRAPH_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=GraphData,
    )


async def generate_graph_data(config: AIConfig, prompt: str):
    from models import GraphData
    from prompts import GRAPH_SYSTEM_PROMPT

    return await generate_structured(
        config=config,
        system_prompt=GRAPH_SYSTEM_PROMPT,
        user_prompt=prompt,
        response_model=GraphData,
    )


async def generate_theme_config(config: AIConfig, prompt: str, graph_json: str):
    from models import ThemeConfig
    from prompts import THEME_SYSTEM_PROMPT

    user_prompt = f"{prompt}\n\nGraph structure:\n{graph_json}"
    return await generate_structured(
        config=config,
        system_prompt=THEME_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=ThemeConfig,
    )


async def generate_event_sequence(
    config: AIConfig,
    prompt: str,
    graph_json: str,
    theme_json: str,
):
    from models import EventSequence
    from prompts import EVENTS_SYSTEM_PROMPT

    user_prompt = (
        f"{prompt}\n\n"
        f"Graph structure:\n{graph_json}\n\n"
        f"Theme config:\n{theme_json}"
    )
    return await generate_structured(
        config=config,
        system_prompt=EVENTS_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=EventSequence,
    )
