"""Bounded numerical evidence for explanations; never copies full series to prompts."""

from math import isfinite


def summarize_series(dates, values, unit):
    """Compare first/last valid observations, explicitly retaining their actual dates."""
    points = [
        (day, float(value))
        for day, value in zip(dates, values, strict=True)
        if value is not None and isfinite(float(value))
    ]
    if not points:
        return {"unit": unit, "validCount": 0, "status": "unavailable"}
    first, last = points[0], points[-1]
    return {
        "unit": unit,
        "validCount": len(points),
        "status": "available",
        "start": first[0],
        "end": last[0],
        "first": first[1],
        "last": last[1],
        "min": min(v for _, v in points),
        "max": max(v for _, v in points),
        "delta": last[1] - first[1],
        "changePercent": (last[1] / first[1] - 1) * 100 if first[1] > 0 else None,
        "percentPolicy": "positive-start-only",
    }


def summarize_snapshot(snapshot):
    bars = snapshot["bars"]
    dates = [bar["time"] for bar in bars]
    price = summarize_series(
        dates, [bar["close"] for bar in bars], snapshot.get("currency")
    )
    volume = summarize_series(dates, [bar["volume"] for bar in bars], "shares")
    indicators = []
    for indicator in snapshot["indicators"]:
        item = {
            "instanceId": indicator["instanceId"],
            "name": indicator["name"],
            "parameters": indicator["parameters"],
            "signal": indicator["signal"],
            "series": {
                series["key"]: summarize_series(
                    dates, series["values"], series.get("unit")
                )
                for series in indicator["series"]
            },
        }
        if indicator["name"] in {"BBANDS", "KELTNER", "DONCHIAN"}:
            by_role = {
                series.get("role"): series["values"] for series in indicator["series"]
            }
            # Descriptor keys are canonical; role is presentation metadata only.
            by_key = {series["key"]: series["values"] for series in indicator["series"]}
            upper = by_role.get("upper") or by_key.get("upper")
            lower = by_role.get("lower") or by_key.get("lower")
            middle = by_role.get("middle") or by_key.get("middle")
            if upper is not None and lower is not None and middle is not None:
                widths = [
                    None
                    if u is None or l is None or m is None or m <= 0
                    else (u - l) / m * 100
                    for u, l, m in zip(upper, lower, middle, strict=True)
                ]
                item["normalizedWidth"] = summarize_series(dates, widths, "percent")
                item["normalizedWidth"]["formula"] = "(upper-lower)/middle*100"
        indicators.append(item)
    return {
        "scope": "displayed-bars-only",
        "price": price,
        "volume": volume,
        "indicators": indicators,
        "interpretation": "Descriptive changes, not causal, predictive, or trading recommendations.",
    }
