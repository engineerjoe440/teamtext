"""Tests for user sessions and their API endpoints."""

import pytest

from conftest import DummyWebSocket
from teamtext.users import SessionManager, User, active_sessions


def test_new_session_and_hash_roundtrip():
    """Create a session and retrieve its token hash."""
    manager = SessionManager()

    token = manager.new_session()

    assert token in manager.sessions
    user = manager.get_session(token)
    assert user is not None
    assert manager.get_session_hash(token) == user.hash


def test_set_player_name_is_noop_for_missing_session():
    """Ignore player-name updates for unknown sessions."""
    manager = SessionManager()

    manager.set_player_name("does-not-exist", "Nora")

    assert not manager.sessions


@pytest.mark.asyncio
async def test_user_receive_json_tracks_sent_messages():
    """Track messages received from a connected websocket."""
    user = User()
    ws = DummyWebSocket(receive_queue=[{"text": "hello"}, {"other": "value"}])

    await user.connect(ws)
    first = await user.receive_json()
    second = await user.receive_json()

    assert first == {"text": "hello"}
    assert second == {"other": "value"}
    assert user.messages_sent == ["hello"]


@pytest.mark.asyncio
async def test_opening_message_uses_current_connection_order():
    """A reconnected player follows players who remained connected."""
    manager = SessionManager()
    first_token = manager.new_session()
    second_token = manager.new_session()
    first_ws = DummyWebSocket()
    second_ws = DummyWebSocket()

    await manager.connect(first_token, first_ws)
    await manager.connect(second_token, second_ws)
    await manager.disconnect(first_token)
    await manager.connect(first_token, DummyWebSocket())

    recipient = await manager.forward_message("opening")

    assert recipient is manager.get_session(second_token)
    assert second_ws.sent_payloads == [{"text": "opening"}]
    assert manager.get_session(first_token).messages_received == []


@pytest.mark.asyncio
async def test_forward_message_to_next_connected_recipient():
    """Forward a message to the next connected session."""
    manager = SessionManager()
    sender_token = manager.new_session()
    recipient_token = manager.new_session()

    sender_ws = DummyWebSocket()
    recipient_ws = DummyWebSocket()

    await manager.connect(sender_token, sender_ws)
    await manager.connect(recipient_token, recipient_ws)

    recipient = await manager.forward_message("secret", client_token=sender_token)

    assert recipient is not None
    assert recipient.user_id == recipient_token
    assert manager.get_session(sender_token).recipient == manager.get_session(recipient_token)
    assert manager.get_session(recipient_token).messages_received == ["secret"]
    assert recipient_ws.sent_payloads == [{"text": "secret"}]
    assert manager.handoffs == [{"sender_id": sender_token, "receiver_id": recipient_token}]


@pytest.mark.asyncio
async def test_forward_message_sets_final_message_when_no_recipient():
    """Store a final message when there is no connected recipient."""
    manager = SessionManager()
    sender_token = manager.new_session()

    recipient = await manager.forward_message("last message", client_token=sender_token)

    assert recipient is None
    assert manager.final_message == "last message"
    assert not manager.handoffs


@pytest.mark.asyncio
async def test_forward_message_does_not_record_disconnected_recipient():
    """Treat a disconnected former recipient as unavailable."""
    manager = SessionManager()
    sender_token = manager.new_session()
    recipient_token = manager.new_session()
    await manager.connect(sender_token, DummyWebSocket())
    await manager.connect(recipient_token, DummyWebSocket())
    await manager.forward_message("first", client_token=sender_token)
    await manager.disconnect(recipient_token)

    recipient = await manager.forward_message("last", client_token=sender_token)

    assert recipient is None
    assert manager.final_message == "last"
    assert manager.handoffs == [{"sender_id": sender_token, "receiver_id": recipient_token}]


def test_list_users_endpoint_reports_users_and_connection_state(client):
    """Report each user's name, connection status, and sent messages."""
    token = active_sessions.new_session()
    active_sessions.set_player_name(token, "Ava")
    active_sessions.get_session(token).websocket = DummyWebSocket()

    response = client.get("/api/users/list")

    assert response.status_code == 200
    payload = response.json()
    assert payload["final_message"] is None
    assert payload["handoffs"] == []
    assert payload["users"] == [
        {
            "user_id": token,
            "player_name": "Ava",
            "connected": True,
            "messages_sent": [],
        }
    ]


def test_clear_users_endpoint_resets_sessions_and_final_message(client):
    """Clear active sessions and the final message through the API."""
    token = active_sessions.new_session()
    active_sessions.get_session(token).messages_sent.append("already sent")
    active_sessions.final_message = "old final"
    active_sessions.handoffs.append({"sender_id": token, "receiver_id": token})

    response = client.post("/api/users/clear")

    assert response.status_code == 200
    assert not active_sessions.sessions
    assert active_sessions.final_message is None
    assert not active_sessions.handoffs

    list_response = client.get("/api/users/list")
    assert list_response.status_code == 200
    assert list_response.json() == {"users": [], "final_message": None, "handoffs": []}
