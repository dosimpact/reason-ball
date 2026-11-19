"""Bounded observations for native outputs; never substitute a trading score."""

from domains.technical_analysis.evidence import summarize_series


def dataset_names(result, state, seen=None):
    seen = set() if seen is None else seen
    identifier = result.get("id")
    if identifier in seen:
        return set()
    seen.add(identifier)
    names = set()
    for ref in result.get("inputMetadata", {}).values():
        if ref.get("dataset"):
            names.add(ref["dataset"])
        if ref.get("result"):
            names.update(
                dataset_names(
                    state.get("results", {}).get(ref["result"], {}), state, seen
                )
            )
    return names


def summarize_result(result, state=None):
    state = state or {}
    names = dataset_names(result, state)
    datasets = [
        (name, state.get("datasets", {}).get(name, {})) for name in sorted(names)
    ]
    count = min(
        [120, *[data.get("metadata", {}).get("count", 120) for _, data in datasets]]
    )
    dates = result.get("dates", [])[-count:]
    outputs = {}
    for name, output in result.get("outputs", {}).items():
        summary = summarize_series(
            dates, output.get("values", [])[-count:], "native-output"
        )
        if result.get("function") in {"OBV", "AD"} or output.get("type") == "integer":
            summary["changePercent"] = None
            summary["percentPolicy"] = (
                "ordinal-or-origin-dependent; absolute change only"
            )
        if output.get("semantics"):
            summary["semantics"] = output["semantics"]
            value = output.get("lastBarValue")
            summary["latestStateMeaning"] = (
                output["semantics"].get("levels", {}).get(str(value))
            )
        outputs[name] = summary
    market = []
    for name, data in datasets:
        meta = data.get("metadata", {})
        days = data.get("dates", [])[-count:]
        market.append(
            {
                "dataset": name,
                "ticker": meta.get("ticker"),
                "interval": meta.get("interval"),
                "price": summarize_series(
                    days, data.get("close", [])[-count:], meta.get("currency")
                ),
                "volume": summarize_series(
                    days, data.get("volume", [])[-count:], "shares"
                ),
            }
        )
    return {
        "scope": "recent-calculation-bars",
        "maximumBars": count,
        "outputs": outputs,
        "market": market,
        "interpretation": "Descriptive first/last changes over the stated dates, not causality, prediction or a combined trading score.",
    }
