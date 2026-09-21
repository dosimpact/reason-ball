import httpx
import pytest

from domains.tenk.sec_client import SecClient, SecReadError


@pytest.mark.asyncio
async def test_company_query_is_encoded_and_read_only():
    def handler(request):
        assert request.method == "GET"
        assert request.url.params["q"] == "A&B"
        assert request.url.params["pageSize"] == "10"
        return httpx.Response(200, json={"items": [], "pagination": {"page": 1, "totalPages": 0}})
    assert (await SecClient(transport=httpx.MockTransport(handler)).companies("A&B"))["items"] == []


@pytest.mark.asyncio
async def test_cross_company_filing_response_is_rejected():
    client = SecClient(transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"items": [{"cik": "0000000001"}], "pagination": {}})))
    with pytest.raises(SecReadError, match="일치"):
        await client.filings("0000320193")


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [404, 409, 500, 302])
async def test_content_failure_is_not_a_successful_document(status):
    client = SecClient(transport=httpx.MockTransport(lambda request: httpx.Response(status, text="private upstream error")))
    with pytest.raises(SecReadError) as error:
        await client.content("0000320193", "0000320193-25-000079")
    assert "private" not in str(error.value)


@pytest.mark.asyncio
async def test_request_size_and_path_are_bounded():
    client = SecClient(transport=httpx.MockTransport(lambda request: httpx.Response(200, text="oversize")))
    with pytest.raises(SecReadError):
        await client._read("/api/sec/companies", max_bytes=3)
    with pytest.raises(SecReadError):
        await client.content("../../other", "arbitrary")
