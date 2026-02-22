"""API integration tests for prompt workflow endpoints."""
import pytest


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.get_json() == {"status": "ok"}


def test_extract_options_returns_run_id_and_options(client):
    r = client.post(
        "/api/v1/prompts/extract-options",
        json={"prompt": "Create a 30 second kids educational video about cleanliness for YouTube in English, vertical format."},
        content_type="application/json",
    )
    assert r.status_code == 200
    data = r.get_json()
    assert "run_id" in data
    assert "options" in data
    assert "missing_fields" in data
    assert data["options"].get("duration_seconds") == 30
    assert data["options"].get("platform") == "youtube"


def test_extract_options_validation_too_short(client):
    r = client.post(
        "/api/v1/prompts/extract-options",
        json={"prompt": "short"},
        content_type="application/json",
    )
    assert r.status_code == 400


def test_enhance_prompt_refills_prompt(client):
    extract_r = client.post(
        "/api/v1/prompts/extract-options",
        json={"prompt": "Create a 30 second kids educational video about cleanliness for YouTube in English, vertical format."},
        content_type="application/json",
    )
    assert extract_r.status_code == 200
    run_id = extract_r.get_json()["run_id"]
    options = extract_r.get_json()["options"]

    r = client.post(
        "/api/v1/prompts/enhance",
        json={"run_id": run_id, "prompt": "Create a 30 second kids educational video about cleanliness for YouTube in English, vertical format.", "options": options},
        content_type="application/json",
    )
    assert r.status_code == 200
    data = r.get_json()
    assert "enhanced_prompt" in data
    assert len(data["enhanced_prompt"]) > 0


def test_generate_script_returns_script(client):
    extract_r = client.post(
        "/api/v1/prompts/extract-options",
        json={"prompt": "Create a 30 second kids educational video about cleanliness for YouTube in English, vertical format."},
        content_type="application/json",
    )
    assert extract_r.status_code == 200
    run_id = extract_r.get_json()["run_id"]

    r = client.post(
        "/api/v1/prompts/generate-script",
        json={"run_id": run_id, "prompt": "Create a 30 second kids educational video about cleanliness for YouTube in English, vertical format."},
        content_type="application/json",
    )
    assert r.status_code == 200
    data = r.get_json()
    assert "script" in data
    assert "Scene" in data["script"]


def test_get_run_404_for_unknown(client):
    r = client.get("/api/v1/runs/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_list_runs_returns_list(client):
    r = client.get("/api/v1/runs")
    assert r.status_code == 200
    assert "runs" in r.get_json()
