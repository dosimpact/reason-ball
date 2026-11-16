"""Read-only publication batching, independent from modeling execution."""
import pytest
from pydantic import ValidationError

from domains.sec_modeling.store import GraphStore
from server.routers.sec_modeling import FilingStatusesRequest


def test_bulk_publications_one_query_preserves_order_and_missing_stages():
    filings=[{'cik':'0000000001','accessionNo':'0000000001-26-000001'},
             {'cik':'0000000002','accessionNo':'0000000002-26-000001'}]
    graph=object.__new__(GraphStore)
    calls=[]
    def query(cypher,**params):
        calls.append((cypher,params))
        return [{'publicationId':'filing:0000000002:0000000002-26-000001:3',
                 'g':{'id':'generation-3','sourceHash':'hash','resultCount':5}}]
    graph.query=query
    result=graph.active_many(filings)
    assert len(calls)==1
    assert len(calls[0][1]['ids'])==6
    assert 'IN $ids' in calls[0][0]
    assert result[0]=={**filings[0],'stages':{}}
    assert result[1]['stages']['3']['generationId']=='generation-3'
    assert result[1]['stages']['3']['resultCount']==5


def test_bulk_request_rejects_duplicates_invalid_identity_and_unbounded_page():
    identity={'cik':'0000000001','accessionNo':'0000000001-26-000001'}
    assert FilingStatusesRequest(filings=[identity]).filings[0].cik==identity['cik']
    for values in ([],[identity,identity],[identity]*101,[{**identity,'cik':'1'}],[{**identity,'accessionNo':'../private'}]):
        with pytest.raises(ValidationError):
            FilingStatusesRequest(filings=values)


def test_publication_summaries_expose_only_readiness_metadata_and_skip_invalid_ids():
    graph = object.__new__(GraphStore)
    calls = []
    def query(cypher, **params):
        calls.append(cypher)
        return [
            {"publicationId": "legacy-invalid"},
            {"publicationId": "filing:0000000001:0000000001-26-000001:2", "generationId": "g2", "sourceHash": "hash", "inputGenerationId": "g1"},
        ]
    graph.query = query
    assert graph.publication_summaries() == [{"cik": "0000000001", "accessionNo": "0000000001-26-000001", "stages": {"2": {"generationId": "g2", "sourceHash": "hash", "inputGenerationId": "g1"}}}]
    assert len(calls) == 1
    assert "RETURN p.id" in calls[0]
