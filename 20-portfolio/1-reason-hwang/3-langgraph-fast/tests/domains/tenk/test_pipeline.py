from pathlib import Path

import pytest

from langgraph_fast.domains.tenk.pipeline import ParserPipeline
from langgraph_fast.domains.tenk.segmenter import FilingSegmenter

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "tenk" / "sample_10k.txt"


def test_segmenter_detects_item_sections() -> None:
    text = FIXTURE.read_text(encoding="utf-8")
    sections = FilingSegmenter(max_chars=1000).run(text, metadata={"report_type": "10-K"})

    assert [section.item_code for section in sections] == ["1", "1A", "7", "8"]
    assert sections[1].section_title == "RISK FACTORS"


def test_pipeline_dry_run_returns_graph_counts() -> None:
    pipeline = ParserPipeline(write_to_neo4j=False)
    try:
        result = pipeline.parse_file(
            FIXTURE,
            metadata={
                "company_name": "Sample Technology Inc.",
                "ticker": "SAMP",
                "report_type": "10-K",
                "accession_no": "0000000000-26-000001",
            },
        )
    finally:
        pipeline.close()

    assert result["segments"] == 4
    assert result["graph_nodes"] > 0
    assert result["graph_relationships"] > 0
    assert result["written_nodes"] == 0


def test_pipeline_raises_for_missing_manifest_path() -> None:
    pipeline = ParserPipeline(write_to_neo4j=False)
    try:
        result = pipeline.parse_manifest_records([{}])
    finally:
        pipeline.close()

    assert result["success"] == 0
    assert result["failed"] == 1
    assert "missing file path" in result["errors"][0]["error"].lower()


def test_non_mock_extractor_requires_explicit_future_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    from langgraph_fast.settings import reset_settings_cache

    reset_settings_cache()
    with pytest.raises(RuntimeError, match="LLM_PROVIDER=mock"):
        ParserPipeline(write_to_neo4j=False)
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    reset_settings_cache()
