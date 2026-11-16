"""Catalog-driven tools keep numeric arrays in state, not ToolMessages."""

from __future__ import annotations

import json
from typing import Annotated, Literal

from langchain_core.messages import ToolMessage
from langchain_core.tools import InjectedToolCallId, tool
from langgraph.prebuilt import InjectedState
from langgraph.types import Command
from pydantic import Field

from domains.talib_agent.catalog import catalog
from domains.talib_agent.engine import execute_batch, required_lookback
from graph.subgraph.price_agent.tools.yahoo_finance import (
    PriceProviderError,
    fetch_historical_prices,
)


def reply(name, call_id, payload, **updates):
    return Command(
        update={
            **updates,
            "messages": [
                ToolMessage(
                    name=name,
                    tool_call_id=call_id,
                    status="error" if "error" in payload else "success",
                    content=json.dumps(payload, ensure_ascii=False, allow_nan=False),
                )
            ],
        }
    )


def result_summary(result):
    """Only latest aligned values and semantics enter the model context."""
    return {
        key: result.get(key)
        for key in (
            "id",
            "function",
            "status",
            "parameters",
            "lookback",
            "warnings",
            "error",
        )
    } | {
        "outputs": {
            name: {
                key: value.get(key)
                for key in (
                    "type",
                    "flags",
                    "displayShift",
                    "lastBarValue",
                    "lastValidAt",
                )
            }
            for name, value in result.get("outputs", {}).items()
        }
    }


def invalidate_results(state, dataset):
    """A refresh invalidates only the replaced dataset's transitive result closure."""
    requests = state.get("result_requests", {})
    stale = set()
    while True:
        previous = set(stale)
        for identifier, request in requests.items():
            refs = request.get("inputs", {}).values()
            if any(
                ref.get("dataset") == dataset or ref.get("result") in stale
                for ref in refs
            ):
                stale.add(identifier)
            if not request.get("inputs") and dataset in state.get("datasets", {}):
                stale.add(identifier)
        if stale == previous:
            break
    return (
        {
            key: value
            for key, value in state.get("results", {}).items()
            if key not in stale
        },
        {key: value for key, value in requests.items() if key not in stale},
    )


def price_dataset(ticker, interval, display_count, fetched_count, fetcher):
    response = fetcher(ticker, interval, fetched_count, True)
    bars = [p for p in response.prices if not p.is_partial]
    if not bars:
        raise ValueError("No completed bars")
    return {
        "dates": [p.trading_date.isoformat() for p in bars],
        **{
            key: [float(getattr(p, key)) for p in bars]
            for key in ("open", "high", "low", "close", "volume")
        },
        "metadata": {
            "ticker": ticker,
            "interval": interval,
            "count": display_count,
            "display_from": bars[
                -min(display_count, len(bars))
            ].trading_date.isoformat(),
            "display_to": bars[-1].trading_date.isoformat(),
            "fetched_count": len(bars),
            "currency": bars[-1].currency,
            "source": "Yahoo Finance",
            "auto_adjust": True,
            "source_url": f"https://finance.yahoo.com/quote/{ticker}/history/",
            "fetched_at": bars[-1].fetched_at.isoformat()
            if bars[-1].fetched_at
            else None,
            "history_policy": "bounded-window; cumulative functions may depend on this origin",
        },
    }


def build_tools(*, fetcher=None, engine=None):
    fetcher = fetcher or fetch_historical_prices
    engine = engine or execute_batch

    @tool
    def list_talib_functions(
        group: str | None = None, search: str | None = None
    ) -> dict:
        """List the installed TA-Lib functions and groups. Discover names before executing unfamiliar functions."""
        data = catalog()
        return {
            "version": data["version"],
            "count": data["count"],
            "functions": [
                {"name": f["name"], "group": f["group"]}
                for f in data["functions"]
                if (group is None or f["group"].lower() == group.lower())
                and (
                    not search
                    or search.lower() in (f["name"] + " " + f["description"]).lower()
                )
            ],
        }

    @tool
    def describe_talib_function(name: str) -> dict:
        """Describe exact native input keys, default fields, parameters, outputs, types and flags for a TA-Lib function."""
        return next(
            (f for f in catalog()["functions"] if f["name"] == name.upper()),
            {"error": "Unknown TA-Lib function", "name": name},
        )

    @tool
    def get_price_ohlcv(
        ticker: str,
        state: Annotated[dict, InjectedState],
        tool_call_id: Annotated[str, InjectedToolCallId],
        interval: Literal["1d", "1wk"] = "1d",
        count: Annotated[int, Field(ge=2, le=200)] = 120,
    ) -> Command:
        """Store completed adjusted Yahoo OHLCV as a named dataset. Daily or weekly only. Fetch before a new ticker/interval/count; results depending on a replaced dataset are invalidated. Display count is at most200; at least600 bars are fetched for warmup."""
        ticker = ticker.strip().upper()
        try:
            dataset = price_dataset(ticker, interval, count, max(600, count), fetcher)
            preserved, request_map = invalidate_results(state, ticker)
            datasets = {**state.get("datasets", {}), ticker: dataset}
            return reply(
                "get_price_ohlcv",
                tool_call_id,
                {
                    "dataset": ticker,
                    "bars": len(dataset["dates"]),
                    "from": dataset["dates"][0],
                    "to": dataset["dates"][-1],
                    **dataset["metadata"],
                },
                datasets=datasets,
                results=preserved,
                result_requests=request_map,
                current_result_ids=[],
                analysis_error=None,
            )
        except (ValueError, PriceProviderError) as error:
            # Failed replacement cannot leave old data available under this name.
            datasets = {
                key: value
                for key, value in state.get("datasets", {}).items()
                if key != ticker
            }
            return reply(
                "get_price_ohlcv",
                tool_call_id,
                {"error": str(error)},
                datasets=datasets,
                results=invalidate_results(state, ticker)[0],
                result_requests=invalidate_results(state, ticker)[1],
                current_result_ids=[],
                analysis_error=str(error),
            )

    @tool
    def run_talib_functions(
        requests: list[dict],
        state: Annotated[dict, InjectedState],
        tool_call_id: Annotated[str, InjectedToolCallId],
    ) -> Command:
        """Run exact catalog functions sequentially. Each request has id,function,parameters,inputs. Input refs: {dataset:'AAPL',field:'close'}, {constant:14,dataset:'AAPL'}, {values:[...],dates:[...]}, or {result:'prior-id',output:'real'}. Use describe_talib_function for input keys (price,price0,price1,periods or OHLCV). Missing generic multi-input operands/periods must be explicit. Preserve output IDs for chaining/follow-ups. No invented arrays or silent substitutions."""
        try:
            if not 1 <= len(requests) <= 40:
                raise ValueError(
                    "Choose 1–40 requests per tool call; split larger requests into sequential calls"
                )
            datasets = dict(state.get("datasets", {}))
            previous = dict(state.get("results", {}))
            request_map = dict(state.get("result_requests", {}))
            for request in requests:
                try:
                    required = required_lookback(
                        request["function"], request.get("parameters", {})
                    )
                except (ValueError, TypeError, KeyError):
                    continue  # Native engine reports the precise per-request error.
                refs = request.get("inputs", {}).values()
                names = {
                    ref["dataset"]
                    for ref in refs
                    if "dataset" in ref and "values" not in ref
                }
                if not request.get("inputs") and datasets:
                    names = {next(iter(datasets))}
                for name in names:
                    dataset = datasets.get(name)
                    if not dataset or not dataset.get("metadata"):
                        continue
                    meta = dataset["metadata"]
                    needed = min(5000, max(600, required + meta["count"] + 1))
                    if (
                        len(dataset["dates"]) < needed
                        and meta.get("fetched_count", 0) < needed
                    ):
                        datasets[name] = price_dataset(
                            name, meta["interval"], meta["count"], needed, fetcher
                        )
                        previous, request_map = invalidate_results(
                            {
                                "datasets": datasets,
                                "results": previous,
                                "result_requests": request_map,
                            },
                            name,
                        )
            report = engine(requests, datasets, previous)
            rows = report["results"]
            results = {**previous, **{r["id"]: r for r in rows}}
            request_map.update(
                {
                    row["id"]: {**request, "id": row["id"]}
                    for row, request in zip(rows, requests)
                }
            )
            ids = list(
                dict.fromkeys(
                    [*state.get("current_result_ids", []), *[r["id"] for r in rows]]
                )
            )
            return reply(
                "run_talib_functions",
                tool_call_id,
                {"results": [result_summary(r) for r in rows]},
                datasets=datasets,
                results=results,
                result_requests=request_map,
                current_result_ids=ids,
                analysis_error=None,
            )
        except (ValueError, TypeError, KeyError, PriceProviderError) as error:
            return reply(
                "run_talib_functions",
                tool_call_id,
                {"error": str(error)},
                current_result_ids=[],
                analysis_error=str(error),
            )

    return [
        list_talib_functions,
        describe_talib_function,
        get_price_ohlcv,
        run_talib_functions,
    ]
