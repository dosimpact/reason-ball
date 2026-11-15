"""Independent arithmetic and contract assertions over the model-free TA20 HTTP API."""

import json
import math
from pathlib import Path
from statistics import mean, pstdev

import httpx

NAMES = {
    "SMA",
    "EMA",
    "MACD",
    "PSAR",
    "CCI",
    "STOCH",
    "RSI",
    "STOCHRSI",
    "WILLIAMS_R",
    "AO",
    "TSI",
    "UO",
    "TRIX",
    "BBANDS",
    "KELTNER",
    "DONCHIAN",
    "OBV",
    "PVT",
    "AD",
    "CMF",
}


def near(actual, expected):
    assert actual is not None and math.isclose(
        actual, expected, rel_tol=1e-8, abs_tol=1e-6
    ), (actual, expected)


def main():
    evidence = []
    with httpx.Client(base_url="http://127.0.0.1:3981", timeout=90) as client:

        def get(**params):
            response = client.get(
                "/technical-analysis/chart",
                params={
                    "ticker": "AAPL",
                    "interval": "1d",
                    "schema_version": 2,
                    **params,
                },
            )
            response.raise_for_status()
            assert response.headers["cache-control"] == "no-store"
            return response.json()

        guard = client.get("/qa/model-guard").json()
        assert guard == {"enabled": True, "calls": 0}, guard
        catalog = client.get("/technical-analysis/catalog")
        catalog.raise_for_status()
        catalog = catalog.json()
        assert catalog["schemaVersion"] == 2
        assert {item["name"] for item in catalog["indicators"]} == NAMES
        large = get(count=120, indicators="all")
        assert (
            large["schemaVersion"] == 2
            and large["catalogVersion"] == catalog["catalogVersion"]
        )
        assert {item["name"] for item in large["indicators"]} == NAMES
        assert len({item["instanceId"] for item in large["indicators"]}) == 20
        assert len(large["bars"]) == 120
        for item in large["indicators"]:
            assert item["status"] == "success", item
            for series in item["series"]:
                assert len(series["values"]) == 120
                assert all(
                    v is None or isinstance(v, (int, float)) and math.isfinite(v)
                    for v in series["values"]
                )
        indicators = {item["name"]: item for item in large["indicators"]}
        bars = large["bars"]
        values = lambda name, key: next(
            s["values"] for s in indicators[name]["series"] if s["key"] == key
        )
        closes = [bar["close"] for bar in bars]
        near(values("SMA", "sma")[-1], mean(closes[-20:]))
        median = [(bar["high"] + bar["low"]) / 2 for bar in bars]
        near(values("AO", "ao")[-1], mean(median[-5:]) - mean(median[-34:]))
        near(values("BBANDS", "middle")[-1], mean(closes[-20:]))
        near(
            values("BBANDS", "upper")[-1], mean(closes[-20:]) + 2 * pstdev(closes[-20:])
        )
        near(
            values("BBANDS", "lower")[-1], mean(closes[-20:]) - 2 * pstdev(closes[-20:])
        )
        near(values("DONCHIAN", "upper")[-1], max(b["high"] for b in bars[-20:]))
        near(values("DONCHIAN", "lower")[-1], min(b["low"] for b in bars[-20:]))

        def flow(bar):
            return (
                0
                if bar["high"] == bar["low"]
                else (2 * bar["close"] - bar["high"] - bar["low"])
                / (bar["high"] - bar["low"])
                * bar["volume"]
            )

        near(
            values("CMF", "cmf")[-1],
            sum(map(flow, bars[-20:])) / sum(b["volume"] for b in bars[-20:]),
        )
        near(values("AD", "ad")[-1] - values("AD", "ad")[-2], flow(bars[-1]))
        near(
            values("PVT", "pvt")[-1] - values("PVT", "pvt")[-2],
            bars[-1]["volume"] * (closes[-1] - closes[-2]) / closes[-2],
        )
        near(
            values("OBV", "obv")[-1] - values("OBV", "obv")[-2],
            bars[-1]["volume"]
            * ((closes[-1] > closes[-2]) - (closes[-1] < closes[-2])),
        )
        evidence.append(
            "all20 aligned finite outputs + independent SMA/AO/BBANDS/Donchian/CMF/AD/PVT/OBV arithmetic"
        )
        from domains.technical_analysis.presentation import build_program

        answer = {
            **large,
            "dates": [bar["time"] for bar in large["bars"]],
            "chart_snapshot": large,
        }
        program = build_program({"answer": answer})
        assert (
            "IndicatorControls(" in program and "technical_analysis_catalog" in program
        )
        assert len(program) <= 60000
        validation = client.post(
            "http://127.0.0.1:3183/api/sec-ui/validate", json={"program": program}
        )
        validation.raise_for_status()
        assert validation.json()["valid"], validation.json()
        Path("/tmp/ta20-generated-program.txt").write_text(program)
        evidence.append(
            "actual20-output deterministic OpenUI program accepted by Host parser;IndicatorControls/catalogQuery;<=60000chars"
        )
        small = get(count=60, indicators="all")
        assert small["origin"] == large["origin"]
        assert small["bars"] == large["bars"][-60:]
        for name in ("OBV", "PVT", "AD"):
            a = indicators[name]
            b = next(i for i in small["indicators"] if i["name"] == name)
            assert a["instanceId"] == b["instanceId"]
            for left, right in zip(a["series"], b["series"], strict=True):
                assert left["values"][-60:] == right["values"]
        evidence.append(
            "fixed cumulative origin and exact overlapping60/120 bars+OBV/PVT/AD values"
        )
        instances = [
            {"name": "SMA", "parameters": {"timeperiod": 5}},
            {"name": "SMA", "parameters": {"timeperiod": 20}},
            {"name": "TSI", "showSignal": True},
            {"name": "TRIX", "showSignal": True},
        ]
        multi = get(count=120, instances=json.dumps(instances))
        assert len(multi["indicators"]) == 4
        assert len({i["instanceId"] for i in multi["indicators"]}) == 4
        for item in multi["indicators"][:2]:
            near(
                item["series"][0]["values"][-1],
                mean(
                    [b["close"] for b in multi["bars"]][
                        -item["parameters"]["timeperiod"] :
                    ]
                ),
            )
        for item in multi["indicators"][2:]:
            assert item["showSignal"] and item["parameters"]["signal_period"] == 9
            assert {s["key"] for s in item["series"]} == {
                item["name"].lower(),
                "signal",
            }
        for name in ("TSI", "TRIX"):
            assert len(indicators[name]["series"]) == 1
        evidence.append(
            "two distinct SMA parameters/IDs + opt-in TSI/TRIX signal9 and default absent"
        )
        invalid = [
            [],
            [{"name": "NOPE"}],
            [{"name": "SMA", "parameters": {"timeperiod": 0}}],
            [{"name": "MACD", "parameters": {"fastperiod": 30, "slowperiod": 20}}],
            [{"name": "SMA"}, {"name": "SMA"}],
            [
                {"name": "SMA", "instanceId": "duplicate"},
                {"name": "RSI", "instanceId": "duplicate"},
            ],
        ]
        for settings in invalid:
            response = client.get(
                "/technical-analysis/chart",
                params={
                    "ticker": "AAPL",
                    "schema_version": 2,
                    "instances": json.dumps(settings),
                },
            )
            assert response.status_code == 422, (settings, response.text)
        forty = [
            {"name": "SMA", "parameters": {"timeperiod": period}}
            for period in range(2, 42)
        ]
        response = client.get(
            "http://127.0.0.1:3183/api/fastapi-langgraph/technical-analysis/chart",
            params={
                "ticker": "AAPL",
                "schema_version": 2,
                "count": 200,
                "instances": json.dumps(forty),
            },
        )
        response.raise_for_status()
        maximum = response.json()
        assert len(maximum["bars"]) == 200 and len(maximum["indicators"]) == 40
        assert len({item["instanceId"] for item in maximum["indicators"]}) == 40
        response = client.get(
            "/technical-analysis/chart",
            params={
                "ticker": "AAPL",
                "schema_version": 2,
                "instances": json.dumps(forty + [{"name": "RSI"}]),
            },
        )
        assert response.status_code == 422
        evidence.append(
            "Host same-origin proxy40 distinct instances/200 bars without truncation;41 rejected422"
        )
        legacy = client.get(
            "/technical-analysis/chart", params={"ticker": "AAPL", "count": 60}
        )
        legacy.raise_for_status()
        assert legacy.json()["indicators"] == ["SMA", "RSI", "MACD"]
        assert {"sma", "rsi", "macd", "signal", "histogram"} <= legacy.json()["bars"][
            -1
        ].keys()
        evidence.append("six invalid requests422 + unchanged legacy flat bars contract")
        guard = client.get("/qa/model-guard").json()
        assert guard == {"enabled": True, "calls": 0}, guard
        evidence.append(
            "fail-closed BaseChatModel invocation/stream guard enabled; all chart GETs caused zero model calls"
        )
    Path("/tmp/ta20-api-evidence.json").write_text(
        json.dumps({"passed": evidence, "origin": large["origin"]}, indent=2)
    )
    print(
        json.dumps({"passed": len(evidence), "evidence": "/tmp/ta20-api-evidence.json"})
    )


if __name__ == "__main__":
    main()
