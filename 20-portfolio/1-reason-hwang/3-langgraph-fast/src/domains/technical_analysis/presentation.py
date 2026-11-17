"""Build OpenUI from verified numbers without a model rewriting chart data."""

import json


def build_program(state: dict) -> str:
    report = state["answer"]
    dumps = lambda value: json.dumps(
        value, ensure_ascii=False, allow_nan=False, separators=(",", ":")
    )
    if state.get("canvas_item_report_id"):
        return _build_canvas_item_program(report, state["canvas_item_report_id"], dumps)
    statements = []
    dates = report["dates"]
    caption = f"분석 시점 스냅샷 · {report['symbol']} · {report['interval']} · {dates[0]} ~ {dates[-1]} · {report['currency']} · 수정주가 · 완료 봉"
    nodes = [f'Title({dumps("기술적 분석")}, "xl")', f"Text({dumps(caption)})"]
    snapshot = report.get("chart_snapshot")
    if snapshot and snapshot.get("schemaVersion") == 2:
        from domains.technical_analysis.catalog import catalog
        instances = [{"instanceId":i["instanceId"],"name":i["name"],"parameters":i["parameters"],"showSignal":i.get("showSignal",False)} for i in snapshot["indicators"]]
        statements.extend([
            f"$chart_ticker = {dumps(report['symbol'])}",
            f"$chart_interval = {dumps(report['interval'])}",
            f"$chart_count = {dumps(str(report['requested_count']))}",
            f"$chart_instances = {dumps(dumps(instances))}",
            "$chart_refresh_seconds = 0",
            f"catalogSnapshot = {dumps(catalog())}",
            'catalog = Query("technical_analysis_catalog", {}, catalogSnapshot)',
        ])
        fallback = {**{k:v for k,v in snapshot.items() if k not in {"bars","indicators"}},"bars":[],"indicators":[]}
        statements.append(f"snapshot = {dumps(fallback)}")
        args = '{"ticker":$chart_ticker,"interval":$chart_interval,"count":$chart_count,"schema_version":2,"instances":$chart_instances}'
        statements.append(f'chart = Query("technical_analysis_chart", {args}, snapshot, $chart_refresh_seconds)')
        nodes.append('QueryPanel([Input($chart_ticker, "Yahoo 티커", "text"), Select($chart_interval,[{"value":"1d","label":"일봉"},{"value":"1wk","label":"주봉"}],"주기"), Select($chart_count,["60","120","200"],"봉 수"), IndicatorControls($chart_instances,catalog), Text("조회 갱신은 모델 호출 없이 실행됩니다. 아래 해석은 최초 분석 snapshot 기준입니다."), FinancialChart(chart)],Action([@Run(chart)]))')
    if snapshot and snapshot.get("schemaVersion") != 2:
        args = {
            "ticker": report["symbol"],
            "interval": report["interval"],
            "count": report["requested_count"],
            "indicators": ",".join(snapshot["indicators"]),
            **snapshot["parameters"],
        }
        statements.extend(
            [
                f"$chart_ticker = {dumps(report['symbol'])}",
                f"$chart_interval = {dumps(report['interval'])}",
                f"$chart_count = {dumps(str(report['requested_count']))}",
            ]
        )
        query_args = dumps(args)
        for key, variable in (
            ("ticker", "$chart_ticker"),
            ("interval", "$chart_interval"),
            ("count", "$chart_count"),
        ):
            query_args = query_args.replace(
                dumps(key) + ":" + dumps(args[key]), dumps(key) + ":" + variable, 1
            )
        counts = list(
            dict.fromkeys([str(report["requested_count"]), "60", "120", "200"])
        )
        query_controls = [
            'Input($chart_ticker, "Yahoo 티커", "text")',
            'Select($chart_interval, [{"value":"1d","label":"일봉"},{"value":"1wk","label":"주봉"}], "주기")',
            f'Select($chart_count, {dumps(counts)}, "봉 수")',
            'Text("차트 조회 조건은 모델 호출 없이 변경됩니다. 아래 해석과 근거는 최초 분석 시점 기준입니다.")',
        ]
        statements.append(f"snapshot = {dumps(snapshot)}")
        statements.append("$chart_refresh_seconds = 0")
        statements.append(
            f'chart = Query("technical_analysis_chart", {query_args}, snapshot, $chart_refresh_seconds)'
        )
        query_controls.append("FinancialChart(chart)")
        nodes.append(
            "QueryPanel([" + ", ".join(query_controls) + "], Action([@Run(chart)]))"
        )
    for item in report["indicators"]:
        nodes.append(
            f"Title({dumps(item['name'] + ' (' + ' / '.join(str(v) for v in item['parameters'].values()) + ')')})"
        )
        signal = item["signal"]
        label = signal["state"] + (" · " + signal["cross"] if "cross" in signal else "")
        nodes.append(f"Text({dumps('기준일 ' + dates[-1] + ' · ' + label)})")
        evidence = [
            [key, "판단 불가" if value is None else f"{value:.4f}" if isinstance(value,(int,float)) else str(value)]
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
    for warning in report["warnings"]:
        nodes.append(f"Text({dumps(warning)})")
    nodes.append(
        f"Text({dumps('출처: ' + report['source_url'] + ' · 조회 시각: ' + str(report['fetched_at']))})"
    )
    if state.get("canvas"):
        panel = nodes[2] if snapshot else 'Text("차트 없음")'
        signals = nodes[3:-1] if snapshot else nodes[2:-1]
        statements.extend(["taHeader = Col([" + ", ".join(nodes[:2]) + "], 2)", "taPanel = " + panel, "taSignals = Col([" + ", ".join(signals) + "], 2)", "taFooter = " + nodes[-1]])
    else:
        statements.append("root = Col([" + ", ".join(nodes) + "], 4)")
    return "\n".join(statements)


def _build_canvas_item_program(report: dict, report_id: str, dumps) -> str:
    """Give each pinned chart its own query bindings and indicator subset."""
    snapshot = report.get("chart_snapshot") or {}
    chart_fallback = {**{key: value for key, value in snapshot.items() if key not in {"bars", "indicators"}}, "bars": [], "indicators": []}
    statements = []
    wrappers = []
    if report["indicators"]:
        from domains.technical_analysis.catalog import catalog

        statements.extend([
            f"catalogSnapshot = {dumps(catalog())}",
            'catalog = Query("technical_analysis_catalog", {}, catalogSnapshot)',
        ])
    chart_items = [("chart", "가격", [])]
    for index, indicator in enumerate(report["indicators"]):
        matching = next((item for item in snapshot.get("indicators", []) if item.get("instanceId") == indicator.get("instanceId")), None)
        if matching is None:
            matching = next((item for item in snapshot.get("indicators", []) if item.get("name") == indicator["name"]), None)
        instance = {key: matching[key] for key in ("instanceId", "name", "parameters") if key in matching} if matching else {"name": indicator["name"], "parameters": indicator["parameters"]}
        chart_items.append(("indicator:" + str(index), indicator["name"], [instance]))
    for index, (item_id, label, instances) in enumerate(chart_items):
        prefix = f"$item{index}_"
        query = f"item{index}Chart"
        statements.extend([
            f"{prefix}ticker = {dumps(report['symbol'])}",
            f"{prefix}interval = {dumps(report['interval'])}",
            f"{prefix}count = {dumps(str(report['requested_count']))}",
            f"{prefix}instances = {dumps(dumps(instances))}",
            f"{prefix}refresh = 0",
            f'{query} = Query("technical_analysis_chart", {{"ticker":{prefix}ticker,"interval":{prefix}interval,"count":{prefix}count,"schema_version":2,"instances":{prefix}instances}}, {dumps(chart_fallback)}, {prefix}refresh)',
        ])
        controls = [
            f'Input({prefix}ticker, "Yahoo 티커", "text")',
            f'Select({prefix}interval, [{{"value":"1d","label":"일봉"}},{{"value":"1wk","label":"주봉"}}], "주기")',
            f'Select({prefix}count, {dumps(list(dict.fromkeys([str(report["requested_count"]), "60", "120", "200"])))}, "봉 수")',
            f'FinancialChart({query})',
        ]
        if index:
            controls.insert(-1, f"IndicatorControls({prefix}instances, catalog)")
            signal = report["indicators"][index - 1]["signal"]
            signal_text = "분석 기준일 " + report["dates"][-1] + " · " + str(signal.get("state", "판단 불가"))
            controls.append(f"Text({dumps(signal_text)})")
        panel = "QueryPanel([" + ", ".join(controls) + f"], Action([@Run({query})]))"
        title = report["symbol"] + " · " + label + " 차트"
        wrappers.append(f"CanvasItem({dumps(report_id + ':' + item_id)}, {dumps(title)}, [{panel}])")
    statements.append("root = Col([" + ", ".join(wrappers) + "], 4)")
    return "\n".join(statements)
