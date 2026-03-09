from app.domain.models import PromptOptions
from app.infrastructure.groq_provider import GroqLiveProvider


class _FakeResponse:
    def __init__(self, payload: dict):
        self.status_code = 200
        self._payload = payload

    def json(self):
        return self._payload


def test_generate_script_includes_generic_language_and_stable_labels(monkeypatch):
    captured = {}

    def fake_post(url, headers, json, timeout):  # noqa: A002 - matches requests.post signature
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        captured["timeout"] = timeout
        return _FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": (
                                "Scene 1:\n"
                                "Visual direction: X\n"
                                "Narration: Y\n"
                                "Mood: Z\n"
                                "Camera/shot cues: A\n"
                                "Transition: B"
                            )
                        }
                    }
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            }
        )

    monkeypatch.setattr("requests.post", fake_post)

    provider = GroqLiveProvider(api_key="test-key", model_name="test-model", timeout_seconds=1)
    provider.generate_script("A short brief.", options=PromptOptions(language="spanish"))

    payload = captured["json"]
    assert payload["model"] == "test-model"
    assert isinstance(payload["messages"], list) and len(payload["messages"]) >= 2

    system_prompt = payload["messages"][0]["content"]
    assert "Visual direction:" in system_prompt
    assert "Camera/shot cues:" in system_prompt
    assert "Transition:" in system_prompt
    assert "Narration:" in system_prompt
    assert "language specified in the constraints" in system_prompt
    assert "Language: spanish" in system_prompt

