"""Build OpenUI from verified numbers without a model rewriting chart data."""

import json


def build_program(state: dict) -> str:
    report = state["answer"]
    dumps = lambda value: json.dumps(
        value, ensure_ascii=False, allow_nan=False, separators=(",", ":")
    )
    statements = []
    dates = report["dates"]
    caption = f"{report['symbol']} · {report['interval']} · {dates[0]} ~ {dates[-1]} · {report['currency']} · 수정주가 · 완료 봉"
    nodes = [f'Title({dumps("기술적 분석")}, "xl")', f"Text({dumps(caption)})"]
    price_rows = [
        {"date": day, "close": close}
        for day, close in zip(dates, report["close"], strict=True)
    ]
    price_series = ["close"]
    for item in report["indicators"]:
        if item["name"] == "SMA" and item["status"] == "success":
            label = f"SMA {item['parameters']['timeperiod']}"
            price_series.append(label)
            for row, value in zip(price_rows, item["series"]["sma"], strict=True):
                if value is not None:
                    row[label] = value
    statements.append(f"prices = {dumps(price_rows)}")
    nodes.append(
        f'Chart("line", prices, "date", {dumps(price_series)}, "currency", {dumps(report["currency"])})'
    )
    for item in report["indicators"]:
        nodes.append(
            f"Title({dumps(item['name'] + ' (' + ' / '.join(str(v) for v in item['parameters'].values()) + ')')})"
        )
        signal = item["signal"]
        label = signal["state"] + (" · " + signal["cross"] if "cross" in signal else "")
        nodes.append(f"Text({dumps('기준일 ' + dates[-1] + ' · ' + label)})")
        evidence = [
            [key, "판단 불가" if value is None else f"{value:.4f}"]
            for key, value in signal.items()
            if key not in {"state", "cross"}
        ]
        if evidence:
            nodes.append(f'Table(["근거", "값"], {dumps(evidence)})')
        if item["status"] == "error":
            nodes.append(f"Text({dumps(item['error_message'] or '판단 불가')})")
            continue
        if item["name"] == "SMA":
            continue
        rows = []
        for index, day in enumerate(dates):
            row = {"date": day}
            row.update(
                {
                    key: values[index]
                    for key, values in item["series"].items()
                    if values[index] is not None
                }
            )
            if item["name"] == "RSI":
                row.update({"lower": 30, "upper": 70})
            rows.append(row)
        keys = (
            ["rsi", "lower", "upper"] if item["name"] == "RSI" else ["macd", "signal"]
        )
        variable = item["name"].lower() + "Data"
        statements.append(f"{variable} = {dumps(rows)}")
        nodes.append(f'Chart("line", {variable}, "date", {dumps(keys)})')
        if item["name"] == "MACD":
            nodes.append(f'Chart("bar", {variable}, "date", ["histogram"])')
    for warning in report["warnings"]:
        nodes.append(f"Text({dumps(warning)})")
    nodes.append(
        f"Text({dumps('출처: ' + report['source_url'] + ' · 조회 시각: ' + str(report['fetched_at']))})"
    )
    statements.append("root = Col([" + ", ".join(nodes) + "], 4)")
    return "\n".join(statements)
