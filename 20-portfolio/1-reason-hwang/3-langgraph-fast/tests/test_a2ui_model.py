from langchain_core.messages import HumanMessage, SystemMessage

from graph.primary_graphs.a2ui_demo.model import ModelSettings, OAuthResponsesChatOpenAI


def test_oauth_responses_normalizes_system_role_without_affecting_api_key_model():
    oauth = ModelSettings("oauth-proxy", "demo", "http://127.0.0.1:18741/v1", "placeholder").build()
    payload = oauth._get_request_payload([SystemMessage(content="instruction"), HumanMessage(content="question")])
    assert payload["input"][0]["role"] == "developer"
    assert payload["input"][0]["content"] == "instruction"
    assert payload["input"][1]["role"] == "user"
    assert payload["stream"] is True
    api = ModelSettings("api-key", "demo", "https://api.openai.com/v1", "test-key").build()
    assert not isinstance(api, OAuthResponsesChatOpenAI)
    assert api._get_request_payload([SystemMessage(content="instruction")])["messages"][0]["role"] == "system"
