from teamtext.settings import get_settings

from conftest import DummyWebSocket


def _clients():
    from teamtext.main import clients

    return clients


def test_root_sets_client_cookie_and_creates_session(client):
    clients = _clients()
    response = client.get("/")

    assert response.status_code == 200
    assert "client_token" in response.cookies

    token = response.cookies["client_token"]
    assert token in clients.sessions


def test_root_reuses_existing_valid_cookie(client):
    clients = _clients()
    first = client.get("/")
    token = first.cookies["client_token"]

    second = client.get("/play", cookies={"client_token": token})

    assert second.status_code == 200
    assert second.cookies["client_token"] == token
    assert len(clients.sessions) == 1


def test_root_replaces_unknown_cookie(client):
    clients = _clients()
    response = client.get("/play", cookies={"client_token": "unknown-token"})

    assert response.status_code == 200
    assert response.cookies["client_token"] != "unknown-token"
    assert response.cookies["client_token"] in clients.sessions


def test_root_sets_player_name_from_query_parameter(client):
    clients = _clients()
    response = client.get("/play", params={"name": "Jordan"})
    token = response.cookies["client_token"]

    assert response.status_code == 200
    assert clients.get_session(token).player_name == "Jordan"


def test_start_game_marks_playing_and_forwards_starting_message(client):
    clients = _clients()
    settings = get_settings()
    settings.starting_message = "Game starts now"

    sender_token = clients.new_session()
    recipient_token = clients.new_session()

    clients.get_session(sender_token).websocket = DummyWebSocket()
    clients.get_session(recipient_token).websocket = DummyWebSocket()

    response = client.post("/api/start-game")

    assert response.status_code == 200
    assert response.json() == {"status": "Game started"}
    assert settings.playing is True
    assert clients.get_session(recipient_token).messages_received == ["Game starts now"]


def test_websocket_echoes_and_forwards_when_game_is_playing(client):
    clients = _clients()
    settings = get_settings()
    settings.playing = True

    sender_token = clients.new_session()
    recipient_token = clients.new_session()

    with client.websocket_connect(f"/ws/chat?client_token={sender_token}") as sender_ws:
        with client.websocket_connect(f"/ws/chat?client_token={recipient_token}") as recipient_ws:
            sender_ws.send_json({"text": "telephone"})

            echo = sender_ws.receive_json()
            forwarded = recipient_ws.receive_json()

    assert echo == {"echo": {"text": "telephone"}, "text": "👍"}
    assert forwarded == {"text": "telephone"}
    assert clients.get_session(recipient_token).messages_received == ["telephone"]


def test_websocket_without_token_creates_session_and_echoes(client):
    clients = _clients()
    before = set(clients.sessions)

    with client.websocket_connect("/ws/chat") as ws:
        ws.send_json({"text": "hello"})
        response = ws.receive_json()

    after = set(clients.sessions)

    assert len(after - before) == 1
    assert response == {"echo": {"text": "hello"}, "text": "👍"}
