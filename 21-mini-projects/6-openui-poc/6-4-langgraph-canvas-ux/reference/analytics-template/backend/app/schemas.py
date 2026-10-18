from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class CanvasSnapshotComponentGraph(BaseModel):
    id: str
    componentType: Literal["Graph"]
    title: str
    chartType: Literal["bar", "line", "pie"]
    order: int


class CanvasSnapshotComponentMarkdown(BaseModel):
    id: str
    componentType: Literal["Markdown"]
    title: str
    contentPreview: str
    order: int


CanvasSnapshotComponent = Annotated[
    CanvasSnapshotComponentGraph | CanvasSnapshotComponentMarkdown,
    Field(discriminator="componentType"),
]


class CanvasSummary(BaseModel):
    id: str
    name: str
    isActive: bool


class ActiveCanvasSnapshot(BaseModel):
    id: str
    name: str
    components: list[CanvasSnapshotComponent] = Field(default_factory=list)


class CanvasSnapshot(BaseModel):
    activeCanvasId: str | None = None
    canvases: list[CanvasSummary] = Field(default_factory=list)
    activeCanvas: ActiveCanvasSnapshot | None = None


class ChatStreamRequest(BaseModel):
    threadId: str | None = None
    message: str
    history: list[ChatHistoryMessage] = Field(default_factory=list)
    canvas: CanvasSnapshot | None = None


class ChartDataset(BaseModel):
    label: str
    data: list[float]
    color: str | None = None


class ChartData(BaseModel):
    type: Literal["bar", "line", "pie"]
    labels: list[str]
    datasets: list[ChartDataset]


class GraphArtifactProps(BaseModel):
    title: str
    data: ChartData
    showLegend: bool | None = True
    variant: Literal["default", "solid", "bordered"] | None = "bordered"
    size: Literal["default", "sm", "lg"] | None = "sm"


class MarkdownArtifactProps(BaseModel):
    title: str | None = None
    content: str
    variant: Literal["default", "bordered", "callout"] | None = "bordered"


class GraphArtifact(BaseModel):
    component: Literal["Graph"]
    props: GraphArtifactProps


class MarkdownArtifact(BaseModel):
    component: Literal["Markdown"]
    props: MarkdownArtifactProps


StudyComponentArtifact = Annotated[
    GraphArtifact | MarkdownArtifact,
    Field(discriminator="component"),
]


class GraphPatchComponent(BaseModel):
    componentType: Literal["Graph"]
    id: str
    title: str
    chartType: Literal["bar", "line", "pie"]


class MarkdownPatchComponent(BaseModel):
    componentType: Literal["Markdown"]
    id: str
    title: str | None = None
    content: str | None = None


CanvasPatchComponent = Annotated[
    GraphPatchComponent | MarkdownPatchComponent,
    Field(discriminator="componentType"),
]


class CanvasPatch(BaseModel):
    components: list[CanvasPatchComponent] = Field(default_factory=list)


class ToolCallEvent(BaseModel):
    name: str
    input: dict[str, Any] = Field(default_factory=dict)


class GenerativeResponse(BaseModel):
    message: str
    artifacts: list[StudyComponentArtifact] = Field(default_factory=list)
    canvas_patch: CanvasPatch | None = None
    tool_calls: list[ToolCallEvent] = Field(default_factory=list)
