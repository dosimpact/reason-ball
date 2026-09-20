import pytest

from graph.primary_graphs.a2ui_demo.contract import (
    MANIFEST,
    ContractError,
    load_catalog,
    validate_operations,
    verify_client_contract,
    verify_versions,
)
from graph.primary_graphs.a2ui_demo.data import sales_summary
from graph.primary_graphs.a2ui_demo.surfaces import apply_action, flight_operations


def test_generated_contracts_and_installed_versions():
    verify_versions()
    for mode in ("host", "dynamic", "fixed", "sec"):
        assert load_catalog(mode)["catalogId"] == MANIFEST["catalogs"][mode]["catalogId"]
    assert len(load_catalog("host")["components"]) == 66


def test_fixed_surface_and_selection_preserve_authoritative_price():
    operations = flight_operations("demo-icn-nrt", "flight-1")
    surfaces = validate_operations("fixed", operations)
    updates, next_surfaces = apply_action("fixed", {
        "name": "select_flight", "surfaceId": "flight-1", "sourceComponentId": "select",
        "context": {"flightId": "demo-icn-nrt"},
    }, surfaces)
    assert updates[0]["updateDataModel"]["value"]["selected"] is True
    assert next_surfaces["flight-1"]["data"]["price"] == "$289"
    assert surfaces["flight-1"]["data"]["selected"] is False


@pytest.mark.parametrize("mutation", ["version", "catalog", "props", "cycle", "missing", "duplicate"])
def test_invalid_protocol_and_component_graph_are_rejected(mutation):
    operations = flight_operations("demo-icn-nrt", "flight-1")
    if mutation == "version":
        operations[0]["version"] = "v0.9.1"
    elif mutation == "catalog":
        operations[0]["createSurface"]["catalogId"] = "unknown"
    else:
        components = operations[1]["updateComponents"]["components"]
        if mutation == "props":
            components[0]["invented"] = True
        elif mutation == "cycle":
            components[0]["child"] = "root"
        elif mutation == "missing":
            components[0]["child"] = "absent"
        else:
            components.append(components[0])
    with pytest.raises(ContractError):
        validate_operations("fixed", operations)


def test_action_cannot_select_another_card_or_invoke_arbitrary_tool():
    surfaces = validate_operations("fixed", flight_operations("demo-icn-nrt", "flight-1"))
    action = {"name": "select_flight", "surfaceId": "flight-1", "sourceComponentId": "select", "context": {"flightId": "demo-pus-kix"}}
    with pytest.raises(ContractError, match="Flight"):
        apply_action("fixed", action, surfaces)
    action["name"] = "delete_all"
    with pytest.raises(ContractError, match="not declared"):
        apply_action("fixed", action, surfaces)


def test_contract_handshake_rejects_stale_hash():
    supplied = {"protocolVersion": "v0.9", **MANIFEST["catalogs"]["fixed"]}
    verify_client_contract("fixed", supplied)
    supplied["sha256"] = "stale"
    with pytest.raises(ContractError, match="sha256"):
        verify_client_contract("fixed", supplied)


def test_sales_totals_are_deterministic():
    assert sales_summary()["revenue"] == "$680,000"
    assert sales_summary("seoul")["revenue"] == "$360,000"
    assert sales_summary("busan")["accounts"] == "3"
    with pytest.raises(ValueError):
        sales_summary("unknown")
