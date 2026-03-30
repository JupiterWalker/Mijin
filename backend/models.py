"""
Pydantic models mirroring the TypeScript types in types.ts.
"""
from __future__ import annotations

from typing import Any, Optional, Union
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Graph primitives
# ---------------------------------------------------------------------------

class NodeApparence(BaseModel):
    fill: Optional[str] = None
    stroke: Optional[str] = None


class GraphNode(BaseModel):
    id: str
    label: str
    group: Optional[int] = None
    x: Optional[float] = None
    y: Optional[float] = None
    apparence: Optional[NodeApparence] = None
    activeStates: Optional[list[str]] = None
    meta_data: Optional[dict[str, Any]] = None


class GraphLink(BaseModel):
    source: str
    target: str
    value: Optional[float] = None
    activeStates: Optional[list[str]] = None


class AttachedElementIds(BaseModel):
    nodes: list[str] = Field(default_factory=list)
    zones: list[str] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)


class EnvironmentZone(BaseModel):
    id: str
    label: str
    x: float
    y: float
    width: float
    height: float
    color: Optional[str] = None
    isLocked: bool = False
    attachedElementIds: Optional[AttachedElementIds] = None


class EnvironmentLabel(BaseModel):
    id: str
    text: str
    x: float
    y: float
    fontSize: float
    color: Optional[str] = None


class Environments(BaseModel):
    zones: Optional[list[EnvironmentZone]] = None
    labels: Optional[list[EnvironmentLabel]] = None


class GraphData(BaseModel):
    nodes: list[GraphNode]
    links: list[GraphLink]
    environments: Optional[Environments] = None


# ---------------------------------------------------------------------------
# Theme / Style
# ---------------------------------------------------------------------------

class Badge(BaseModel):
    text: Optional[str] = None
    color: Optional[str] = None
    textColor: Optional[str] = None


class NodeStyleVisuals(BaseModel):
    fill: Optional[str] = None
    stroke: Optional[str] = None
    strokeWidth: Optional[float] = None
    radius: Optional[float] = None
    badge: Optional[Badge] = None


class LinkStyleVisuals(BaseModel):
    mainColor: Optional[str] = None
    width: Optional[float] = None
    opacity: Optional[float] = None
    outlineColor: Optional[str] = None
    outlineWidth: Optional[float] = None


class AnimationProps(BaseModel):
    packetColor: Optional[str] = None
    packetRadius: Optional[float] = None
    duration: Optional[float] = None
    scale: Optional[float] = None
    durationIn: Optional[float] = None


class NodeStyleDefinition(BaseModel):
    persistent: Optional[NodeStyleVisuals] = None
    animation: Optional[AnimationProps] = None


class LinkStyleDefinition(BaseModel):
    persistent: Optional[LinkStyleVisuals] = None
    animation: Optional[AnimationProps] = None


class ThemeConfig(BaseModel):
    nodeStyles: dict[str, NodeStyleDefinition] = Field(default_factory=dict)
    linkStyles: dict[str, LinkStyleDefinition] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Event Sequence
# ---------------------------------------------------------------------------

class InitialNodeState(BaseModel):
    id: str
    nodeState: str


class AtomicStep(BaseModel):
    type: Optional[str] = "atomic"
    from_node: str = Field(alias="from")
    to: str
    label: Optional[str] = None
    linkStyle: Optional[str] = None
    targetNodeState: Optional[str] = None
    processingNodeState: Optional[str] = None
    finalNodeState: Optional[str] = None
    duration: Optional[float] = None
    durationProcessing: Optional[float] = None
    durationFinal: Optional[float] = None
    delay: Optional[float] = None

    model_config = {"populate_by_name": True}


class ParallelStep(BaseModel):
    type: str = "parallel"
    steps: list[AtomicStep]
    delay: Optional[float] = None
    label: Optional[str] = None


SimulationAction = Union[AtomicStep, ParallelStep]


class EventSequence(BaseModel):
    name: str
    initNodes: Optional[list[InitialNodeState]] = None
    steps: list[SimulationAction]


# ---------------------------------------------------------------------------
# API Request / Response models
# ---------------------------------------------------------------------------

class AIConfig(BaseModel):
    api_key: str
    base_url: Optional[str] = None
    model: str = "gpt-4o"


class GenerateContext(BaseModel):
    graph_data: Optional[GraphData] = None
    theme_data: Optional[ThemeConfig] = None


class GenerateRequest(BaseModel):
    prompt: str
    config: AIConfig
    context: Optional[GenerateContext] = None


class GenerateGraphResponse(BaseModel):
    graph_data: GraphData


class GenerateThemeResponse(BaseModel):
    theme_data: ThemeConfig


class GenerateEventsResponse(BaseModel):
    event_data: EventSequence


class GenerateProjectResponse(BaseModel):
    graph_data: GraphData
    theme_data: ThemeConfig
    event_data: EventSequence
