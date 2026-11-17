"""Provider selection is global; credentials never cross provider boundaries."""
import os

import pytest
from langchain_core.messages import HumanMessage, SystemMessage

from graph.provider.chat_model import ChatModelSettings
from graph.provider.ui_model import ModelSettings, OAuthResponsesChatOpenAI


@pytest.fixture(autouse=True)
def clean_model_environment(monkeypatch):
    for name in tuple(os.environ):
        if name.startswith(("CHAT_LLM_", "OPENAI_", "OPENUI_", "OPEN_UI_", "SEC_CHAT_")):
            monkeypatch.delenv(name)


def test_defaults_select_oauth_proxy():
    settings = ChatModelSettings.from_env()
    assert settings.provider == "oauth-proxy"
    assert settings.model
    assert settings.base_url.startswith("http://127.0.0.1:")
    assert settings.api_key


def test_oauth_settings_use_provider_specific_values(monkeypatch):
    monkeypatch.setenv("CHAT_LLM_OAUTH_MODEL", "oauth-demo")
    monkeypatch.setenv("CHAT_LLM_OAUTH_BASE_URL", "http://localhost:9999/v1/")
    monkeypatch.setenv("CHAT_LLM_OAUTH_API_KEY", "oauth-only")
    settings = ChatModelSettings.from_env()
    assert (settings.model, settings.base_url, settings.api_key) == (
        "oauth-demo", "http://localhost:9999/v1", "oauth-only",
    )


def test_openai_switch_isolates_proxy_configuration(monkeypatch):
    monkeypatch.setenv("CHAT_LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "official-key")
    monkeypatch.setenv("OPENAI_MODEL", "legacy-oauth-model")
    monkeypatch.setenv("OPENAI_BASE_URL", "http://localhost:9999/v1")
    monkeypatch.setenv("CHAT_LLM_OAUTH_API_KEY", "proxy-secret")
    monkeypatch.setenv("CHAT_LLM_OAUTH_MODEL", "proxy-model")
    settings = ChatModelSettings.from_env()
    assert settings.provider == "openai"
    assert settings.base_url == "https://api.openai.com/v1"
    assert settings.model == "gpt-4.1-mini"
    assert settings.api_key == "official-key"


def test_openai_provider_specific_values_win(monkeypatch):
    monkeypatch.setenv("CHAT_LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "legacy-key")
    monkeypatch.setenv("CHAT_LLM_OPENAI_MODEL", "official-demo")
    monkeypatch.setenv("CHAT_LLM_OPENAI_BASE_URL", "https://official.example/v1/")
    monkeypatch.setenv("CHAT_LLM_OPENAI_API_KEY", "official-key")
    settings = ChatModelSettings.from_env()
    assert (settings.model, settings.base_url, settings.api_key) == (
        "official-demo", "https://official.example/v1", "official-key",
    )


@pytest.mark.parametrize("provider", ["api-key", "proxy", "unsupported"])
def test_invalid_provider_fails_clearly(monkeypatch, provider):
    monkeypatch.setenv("CHAT_LLM_PROVIDER", provider)
    with pytest.raises(ValueError, match="CHAT_LLM_PROVIDER"):
        ChatModelSettings.from_env()


@pytest.mark.parametrize("key", [None, "", "chatgpt-oauth-placeholder"])
def test_openai_requires_real_key(monkeypatch, key):
    monkeypatch.setenv("CHAT_LLM_PROVIDER", "openai")
    if key is not None:
        monkeypatch.setenv("CHAT_LLM_OPENAI_API_KEY", key)
    with pytest.raises(ValueError, match="API_KEY"):
        ChatModelSettings.from_env()


@pytest.mark.parametrize("provider", ["oauth-proxy", "openai"])
def test_legacy_ui_and_sec_settings_cannot_override_global_flag(monkeypatch, provider):
    monkeypatch.setenv("CHAT_LLM_PROVIDER", provider)
    monkeypatch.setenv("CHAT_LLM_OPENAI_API_KEY", "official-key")
    for prefix in ("OPENUI_MODEL", "OPEN_UI_MODEL", "SEC_CHAT_MODEL"):
        monkeypatch.setenv(prefix, "wrong-model")
        monkeypatch.setenv(prefix + "_BASE_URL", "http://wrong-host/v1")
        monkeypatch.setenv(prefix + "_PROVIDER", "api-key")
    from graph.primary_graphs.sec_intelligent_ui.workflow import chat_model

    settings = ChatModelSettings.from_env()
    ui = ModelSettings.from_env()
    sec = chat_model()
    assert ui.provider == provider
    assert ui.model == settings.model == sec.model_name
    assert str(sec.openai_api_base).rstrip("/") == settings.base_url


@pytest.mark.parametrize("provider", ["oauth-proxy", "openai"])
def test_ui_transport_and_role_follow_provider(monkeypatch, provider):
    monkeypatch.setenv("CHAT_LLM_PROVIDER", provider)
    monkeypatch.setenv("CHAT_LLM_OPENAI_API_KEY", "official-key")
    model = ModelSettings.from_env().build()
    payload = model._get_request_payload([
        SystemMessage(content="instruction"), HumanMessage(content="question"),
    ])
    if provider == "oauth-proxy":
        assert isinstance(model, OAuthResponsesChatOpenAI)
        assert payload["input"][0]["role"] == "developer"
        assert payload["stream"] is True
    else:
        assert not isinstance(model, OAuthResponsesChatOpenAI)
        assert payload["messages"][0]["role"] == "system"


@pytest.mark.parametrize("legacy_name", ["openai", "proxy", "chatgpt-oauth-proxy"])
def test_main_graph_legacy_provider_argument_obeys_global_flag(monkeypatch, legacy_name):
    from graph.provider import get_provider

    assert get_provider(legacy_name).settings.provider == "oauth-proxy"
    monkeypatch.setenv("CHAT_LLM_PROVIDER", "openai")
    monkeypatch.setenv("CHAT_LLM_OPENAI_API_KEY", "official-key")
    assert get_provider(legacy_name).settings.provider == "openai"


@pytest.mark.parametrize("provider", ["oauth-proxy", "openai"])
def test_real_chat_client_invokes_only_selected_endpoint(monkeypatch, provider):
    """Exercise OpenAI SDK serialization/parsing without network or billing."""
    import json

    import httpx

    monkeypatch.setenv("CHAT_LLM_PROVIDER", provider)
    monkeypatch.setenv("CHAT_LLM_OAUTH_MODEL", "demo")
    monkeypatch.setenv("CHAT_LLM_OPENAI_MODEL", "demo")
    monkeypatch.setenv("CHAT_LLM_OAUTH_BASE_URL", "http://oauth.test/v1")
    monkeypatch.setenv("CHAT_LLM_OAUTH_API_KEY", "oauth-key")
    monkeypatch.setenv("CHAT_LLM_OPENAI_BASE_URL", "https://openai.test/v1")
    monkeypatch.setenv("CHAT_LLM_OPENAI_API_KEY", "official-key")
    requests = []

    def respond(request):
        requests.append(request)
        body = json.loads(request.content)
        assert body["messages"][0]["content"] == "hello"
        return httpx.Response(200, json={
            "id": "chatcmpl-test", "object": "chat.completion", "created": 1,
            "model": body["model"], "choices": [{
                "index": 0, "finish_reason": "stop",
                "message": {"role": "assistant", "content": "mock answer"},
            }],
        })

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        model = ChatModelSettings.from_env().build(http_client=client)
        assert model.invoke("hello").content == "mock answer"
    assert len(requests) == 1
    assert requests[0].url.host == ("oauth.test" if provider == "oauth-proxy" else "openai.test")
    assert requests[0].url.path == "/v1/chat/completions"
    assert requests[0].headers["authorization"] == (
        "Bearer oauth-key" if provider == "oauth-proxy" else "Bearer official-key"
    )


@pytest.mark.parametrize("name,value", [
    ("CHAT_LLM_PROVIDER", "openai"),
    ("CHAT_LLM_OAUTH_MODEL", "changed-oauth-model"),
    ("CHAT_LLM_OPENAI_MODEL", "changed-openai-model"),
])
def test_worker_execution_version_tracks_chat_configuration(monkeypatch, name, value):
    from server.postgres_run_manager import execution_version

    initial = execution_version()
    monkeypatch.setenv(name, value)
    assert execution_version() != initial
