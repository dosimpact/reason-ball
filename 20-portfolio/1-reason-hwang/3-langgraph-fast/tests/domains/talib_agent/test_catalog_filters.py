import pytest

from graph.primary_graphs.talib_agent.tools import build_tools


@pytest.mark.parametrize("group", [None, "", "  ", "\t\n"])
def test_blank_group_is_unfiltered(group):
    tool = next(tool for tool in build_tools() if tool.name == "list_talib_functions")
    result = tool.invoke({"group": group, "search": " ICHIMOKU "})
    assert [item["name"] for item in result["functions"]] == ["ICHIMOKU"]


def test_named_group_remains_case_insensitive_and_trimmed():
    tool = next(tool for tool in build_tools() if tool.name == "list_talib_functions")
    baseline = tool.invoke({"search": "ICHIMOKU"})["functions"][0]
    assert tool.invoke(
        {"group": " " + baseline["group"].swapcase() + " ", "search": "ichimoku"}
    )["functions"] == [baseline]
    assert tool.invoke({"group": "unknown group"})["functions"] == []
