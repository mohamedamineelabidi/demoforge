import pytest

from demoforge.enrich.proposals import FakeLLM, ProposalError, propose
from demoforge.video.storyboard import artifact_hash
from tests.video.test_storyboard import catalog, proposal


def response():
    value = proposal().model_dump()
    value["catalog_sha256"] = artifact_hash(catalog())
    return value


def test_valid_proposal_uses_exact_catalog():
    adapter = FakeLLM([response()])
    result = propose(catalog(), adapter)
    assert result.catalog_sha256 == artifact_hash(catalog())
    assert adapter.calls == 1


def test_one_repair_then_success():
    broken = response()
    broken["captions"][0]["text"] = "Invented product fact."
    adapter = FakeLLM([broken, response()])
    assert propose(catalog(), adapter).captions[0].text == "Filter tasks."
    assert adapter.calls == 2


def test_second_failure_stops_without_model_response_in_error():
    adapter = FakeLLM([{"secret": "do-not-log"}, {"secret": "do-not-log"}, response()])
    with pytest.raises(ProposalError) as caught:
        propose(catalog(), adapter)
    assert "do-not-log" not in str(caught.value)
    assert adapter.calls == 2


def test_wrong_catalog_is_rejected():
    broken = response()
    broken["catalog_sha256"] = "f" * 64
    with pytest.raises(ProposalError):
        propose(catalog(), FakeLLM([broken, broken]))


def test_unscanned_or_sensitive_catalog_never_reaches_provider():
    for sensitive in [False, True]:
        source = catalog()
        if sensitive:
            source.evidence[0] = source.evidence[0].model_copy(
                update={"quote": "API_KEY=private-test-value"}
            )
        else:
            source.files[0].scan_status = "not_scanned"
        adapter = FakeLLM([response()])
        with pytest.raises(ProposalError):
            propose(source, adapter)
        assert adapter.calls == 0


def test_openai_adapter_uses_structured_output_without_tools():
    import json

    import httpx
    from openai import OpenAI

    from demoforge.enrich.proposals import OpenAIAdapter

    def respond(request):
        body = json.loads(request.content)
        assert "tools" not in body
        assert body["response_format"]["type"] == "json_schema"
        assert body["messages"][0]["role"] == "system"
        assert "untrusted" in body["messages"][0]["content"]
        return httpx.Response(
            200,
            json={
                "id": "mock",
                "object": "chat.completion",
                "created": 0,
                "model": "mock-model",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": json.dumps(response())},
                        "finish_reason": "stop",
                    }
                ],
            },
        )

    with httpx.Client(transport=httpx.MockTransport(respond)) as transport:
        client = OpenAI(api_key="test-only-not-a-secret", http_client=transport, max_retries=0)
        result = propose(catalog(), OpenAIAdapter(client, model="mock-model"))
        assert result.captions[0].text == "Filter tasks."
