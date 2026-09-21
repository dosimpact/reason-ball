import pytest
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, HumanMessage

from graph.primary_graphs.a2ui_demo.cabin import cabin_operations
from graph.primary_graphs.a2ui_demo.contract import ContractError, validate_operations
from graph.primary_graphs.a2ui_demo.surfaces import apply_action, flight_operations
from graph.primary_graphs.a2ui_demo.workflow import build_graph


class ToolModel(FakeMessagesListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


def setup_cabin():
    surfaces = validate_operations("fixed", cabin_operations("demo-nrt-icn"))
    surface_id = next(iter(surfaces))
    action = {
        "name": "confirm_cabin", "surfaceId": surface_id, "sourceComponentId": "confirm",
        "context": {"flightId": "demo-nrt-icn", "meal": "vegetarian", "seat": "14C"},
    }
    return surfaces, surface_id, action


def test_cabin_selection_and_existing_flight_are_independent():
    surfaces, surface_id, action = setup_cabin()
    surfaces = validate_operations("fixed", flight_operations("demo-icn-nrt"), existing=surfaces)
    _, updated = apply_action("fixed", action, surfaces)
    data = updated[surface_id]["data"]
    assert (data["meal"], data["seat"], data["confirmed"]) == ("vegetarian", "14C", True)
    flight = next(value for key, value in updated.items() if key != surface_id)
    assert flight["data"]["selected"] is False
    assert surfaces[surface_id]["data"]["confirmed"] is False
    assert apply_action("fixed", action, updated)[1] == updated
    action["context"]["seat"] = "12A"
    with pytest.raises(ContractError, match="already confirmed"):
        apply_action("fixed", action, updated)


@pytest.mark.parametrize("field,value", [
    ("meal", "invented"), ("seat", "99Z"), ("seat", []),
    ("flightId", "demo-icn-nrt"), ("extra", "ignored"),
])
def test_cabin_rejects_tampered_context(field, value):
    surfaces, _, action = setup_cabin()
    action["context"][field] = value
    with pytest.raises(ContractError):
        apply_action("fixed", action, surfaces)


def test_cabin_rejects_foreign_surface_and_unknown_flight():
    surfaces, _, action = setup_cabin()
    action["surfaceId"] = "another-thread"
    with pytest.raises(ContractError):
        apply_action("fixed", action, surfaces)
    with pytest.raises(ContractError):
        cabin_operations("unknown")


@pytest.mark.asyncio
async def test_single_tool_generates_both_selectors():
    graph = build_graph("fixed", ToolModel(responses=[
        AIMessage(content="", tool_calls=[{
            "id": "cabin-call", "name": "display_cabin_options",
            "args": {"flight_id": "demo-nrt-icn"},
        }]),
    ]))
    result = await graph.ainvoke(
        {"messages": [HumanMessage(content="도쿄 인천 기내식 좌석 선택")], "surfaces": {}},
        {"configurable": {"thread_id": "cabin-tool"}},
    )
    assert len(result["surfaces"]) == 1
    components = next(iter(result["surfaces"].values()))["components"]
    assert components["meal"]["component"] == "RadioGroup"
    assert components["seat"]["component"] == "RadioGroup"


@pytest.mark.parametrize("ui_type,field,choice,absent", [
    ("meal", "meal", "vegetarian", "seat"),
    ("seat", "seat", "14C", "meal"),
])
def test_individual_ui_confirms_only_visible_field(ui_type, field, choice, absent):
    surfaces = validate_operations("fixed", cabin_operations("demo-nrt-icn", ui_type))
    surface_id = next(iter(surfaces))
    assert absent not in surfaces[surface_id]["components"]
    assert absent not in surfaces[surface_id]["data"]
    action = {
        "name": "confirm_cabin", "surfaceId": surface_id, "sourceComponentId": "confirm",
        "context": {"flightId": "demo-nrt-icn", field: choice},
    }
    _, updated = apply_action("fixed", action, surfaces)
    assert updated[surface_id]["data"][field] == choice
    assert updated[surface_id]["data"]["confirmed"] is True
    assert absent not in updated[surface_id]["data"]
    action["context"][absent] = "injected"
    with pytest.raises(ContractError):
        apply_action("fixed", action, surfaces)


def test_invalid_ui_type_is_rejected():
    with pytest.raises(ContractError, match="UI type"):
        cabin_operations("demo-nrt-icn", "../arbitrary")  # type: ignore[arg-type]
