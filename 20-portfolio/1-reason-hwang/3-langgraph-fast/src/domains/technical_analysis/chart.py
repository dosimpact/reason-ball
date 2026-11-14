"""Aligned chart snapshot assembled from one completed OHLCV history."""

from domains.technical_analysis.report import warmup_count


def build_chart_snapshot(prices, metadata, settings, count, result):
    display = prices[-count:]
    bars = [
        {
            "time": p.trading_date.isoformat(),
            "open": float(p.open),
            "high": float(p.high),
            "low": float(p.low),
            "close": float(p.close),
            "volume": p.volume,
        }
        for p in display
    ]
    warnings = list(result.warnings)
    parameters = {}
    for setting, outcome in zip(settings, result.indicators, strict=True):
        if setting.name == "MACD":
            parameters.update(
                macd_fast=setting.fastperiod,
                macd_slow=setting.slowperiod,
                macd_signal=setting.signalperiod,
            )
        else:
            parameters[setting.name.lower() + "_period"] = setting.request().parameters[
                "timeperiod"
            ]
        keys = {
            "SMA": ["sma"],
            "RSI": ["rsi"],
            "MACD": ["macd", "signal", "histogram"],
        }[setting.name]
        for bar in bars:
            bar.update({key: None for key in keys})
        for key, values in outcome.series.items():
            for bar, value in zip(bars, values[-len(display) :], strict=True):
                bar[key] = value
        if outcome.status == "error":
            warnings.append(outcome.error_message or "Indicator unavailable")
    if len(prices) < count + warmup_count(settings):
        warnings.append(
            "Insufficient warmup history; early indicator values may be unavailable or unstable."
        )
    return {
        **metadata,
        "as_of": bars[-1]["time"],
        "bars": bars,
        "indicators": [s.name for s in settings],
        "parameters": parameters,
        "warnings": warnings,
        "requested_count": count,
        "available_count": len(prices),
    }
