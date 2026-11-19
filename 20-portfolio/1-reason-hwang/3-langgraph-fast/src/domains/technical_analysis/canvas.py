"""Saved analysis request metadata for individually pinnable Canvas reports."""

from domains.technical_analysis.request import AnalysisRequest as CanvasRequest

__all__ = ["CanvasRequest", "request_for"]


def request_for(report, indicators):
    return {"ticker": report["symbol"], "interval": report["interval"],
            "count": report["requested_count"], "indicators": indicators}
