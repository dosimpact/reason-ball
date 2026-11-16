import pytest

from domains.technical_analysis.evidence import summarize_series, summarize_snapshot


def snapshot():
    return {
        "currency": "USD",
        "bars": [
            {"time": "2026-01-01", "close": 100, "volume": 1000},
            {"time": "2026-01-02", "close": 110, "volume": 800},
            {"time": "2026-01-03", "close": 120, "volume": 600},
        ],
        "indicators": [
            {
                "instanceId": "bands20",
                "name": "BBANDS",
                "parameters": {"timeperiod": 20},
                "signal": {},
                "series": [
                    {"key": k, "unit": "USD", "values": v}
                    for k, v in [
                        ("upper", [110, 120, 150]),
                        ("middle", [100, 110, 120]),
                        ("lower", [90, 100, 90]),
                    ]
                ],
            }
        ],
    }


def test_price_volume_and_normalized_band_width_have_actual_evidence():
    evidence = summarize_snapshot(snapshot())
    assert evidence["price"]["changePercent"] == pytest.approx(20)
    assert evidence["volume"]["changePercent"] == pytest.approx(-40)
    width = evidence["indicators"][0]["normalizedWidth"]
    assert (width["first"], width["last"], width["delta"]) == (20, 50, 30)
    assert width["changePercent"] == 150
    assert width["start"] == "2026-01-01" and width["end"] == "2026-01-03"
    assert "values" not in str(evidence)


def test_warmup_nulls_zero_and_signed_baselines_do_not_invent_percent():
    result = summarize_series(["a", "b", "c"], [None, 0, -2], "volume")
    assert result["start"] == "b" and result["delta"] == -2
    assert result["changePercent"] is None and result["validCount"] == 2
    assert summarize_series(["a"], [None], "ratio")["status"] == "unavailable"
    assert summarize_series(["a", "b"], [-1, 1], "ratio")["changePercent"] is None


def test_zero_middle_does_not_create_infinite_width():
    data = snapshot()
    data["indicators"][0]["series"][1]["values"] = [0, 0, 0]
    assert (
        summarize_snapshot(data)["indicators"][0]["normalizedWidth"]["status"]
        == "unavailable"
    )
