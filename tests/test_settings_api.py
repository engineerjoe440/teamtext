from teamtext.settings import get_settings


def test_get_settings_defaults(client):
    response = client.get("/api/settings/")

    assert response.status_code == 200
    assert response.json() == {
        "game_title": "TeamText",
        "starting_message": (
            "4-H is a community of young people across America who are learning "
            "leadership, citizenship, and life skills."
        ),
    }


def test_set_settings_persists_and_reads_back(client):
    payload = {
        "game_title": "Classroom Whisper Chain",
        "starting_message": "The first clue starts now.",
    }

    post_response = client.post("/api/settings/", json=payload)
    get_response = client.get("/api/settings/")

    assert post_response.status_code == 200
    assert post_response.json() == payload
    assert get_response.status_code == 200
    assert get_response.json() == payload

    active = get_settings()
    assert active.game_title == payload["game_title"]
    assert active.starting_message == payload["starting_message"]


def test_set_settings_requires_required_fields(client):
    response = client.post("/api/settings/", json={"game_title": "Missing message"})

    assert response.status_code == 422
