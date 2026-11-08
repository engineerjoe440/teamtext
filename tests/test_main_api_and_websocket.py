"""Tests for application routes and websocket behavior."""

from teamtext.main import clients as session_clients
from teamtext.settings import get_settings


def _clients():
    """Return the active application session manager."""
    return session_clients


def test_root_sets_client_cookie_and_creates_session(client):
    """Create a session and cookie when serving the application page."""
    clients = _clients()
    response = client.get("/")

    assert response.status_code == 200
    assert "client_token" in response.cookies

    token = response.cookies["client_token"]
    assert token in clients.sessions


def test_root_reuses_existing_valid_cookie(client):
    """Reuse a valid client session cookie."""
    clients = _clients()
    first = client.get("/")
    token = first.cookies["client_token"]

    second = client.get("/play", cookies={"client_token": token})

    assert second.status_code == 200
    assert second.cookies["client_token"] == token
    assert len(clients.sessions) == 1


def test_root_replaces_unknown_cookie(client):
    """Replace a cookie that does not identify a session."""
    clients = _clients()
    response = client.get("/play", cookies={"client_token": "unknown-token"})

    assert response.status_code == 200
    assert response.cookies["client_token"] != "unknown-token"
    assert response.cookies["client_token"] in clients.sessions


def test_root_sets_player_name_from_query_parameter(client):
    """Store the player name provided in the page query string."""
    clients = _clients()
    response = client.get("/play", params={"name": "Jordan"})
    token = response.cookies["client_token"]

    assert response.status_code == 200
    assert clients.get_session(token).player_name == "Jordan"


def test_start_game_marks_playing_and_forwards_starting_message(client):
    """Send the opening message to the only connected player."""
    clients = _clients()
    settings = get_settings()
    settings.starting_message = "Game starts now"

    recipient_token = clients.new_session()

    with client.websocket_connect(f"/ws/chat?client_token={recipient_token}") as ws:
        response = client.post("/api/start-game")

        assert response.status_code == 200
        assert response.json() == {"status": "Game started"}
        assert settings.playing is True
        assert clients.get_session(recipient_token).messages_received == ["Game starts now"]
        assert clients.final_message is None
        assert ws.receive_json() == {"text": "Game starts now"}


def test_start_game_uses_connection_order_and_forwards_next_message(client):
    """Start with the first connection even when sessions were created out of order."""
    clients = _clients()
    get_settings().starting_message = "opening"
    second_token = clients.new_session()
    first_token = clients.new_session()

    with (
        client.websocket_connect(f"/ws/chat?client_token={first_token}") as first_ws,
        client.websocket_connect(f"/ws/chat?client_token={second_token}") as second_ws,
    ):
        response = client.post("/api/start-game")

        assert response.status_code == 200
        assert clients.get_session(first_token).messages_received == ["opening"]
        assert clients.get_session(second_token).messages_received == []
        assert first_ws.receive_json() == {"text": "opening"}

        first_ws.send_json({"text": "next"})
        assert first_ws.receive_json() == {"echo": {"text": "next"}, "text": "👍"}
        assert second_ws.receive_json() == {"text": "next"}


def test_websocket_echoes_and_forwards_when_game_is_playing(client):
    """Echo websocket messages and forward them while the game is active."""
    clients = _clients()
    settings = get_settings()
    settings.playing = True

    sender_token = clients.new_session()
    recipient_token = clients.new_session()

    with (
        client.websocket_connect(
            f"/ws/chat?client_token={sender_token}"
        ) as sender_ws,
        client.websocket_connect(
            f"/ws/chat?client_token={recipient_token}"
        ) as recipient_ws,
    ):
        sender_ws.send_json({"text": "telephone"})

        echo = sender_ws.receive_json()
        forwarded = recipient_ws.receive_json()

    assert echo == {"echo": {"text": "telephone"}, "text": "👍"}
    assert forwarded == {"text": "telephone"}
    assert clients.get_session(recipient_token).messages_received == ["telephone"]


def test_websocket_without_token_creates_session_and_echoes(client):
    """Create a session and echo messages for a tokenless websocket."""
    clients = _clients()
    before = set(clients.sessions)

    with client.websocket_connect("/ws/chat") as ws:
        ws.send_json({"text": "hello"})
        response = ws.receive_json()

    after = set(clients.sessions)

    assert len(after - before) == 1
    assert response == {"echo": {"text": "hello"}, "text": "👍"}
