################################################################################
"""
TeamText - Modern reimagining of the classic telephone game for education!

(c) 2025 Stanley Solutions
"""
################################################################################

from uuid import uuid4
from typing import Optional

from fastapi import WebSocket, APIRouter


router = APIRouter(prefix="/users")

class User:
    """Class representing a user in TeamText.

    This class can optionally own a single WebSocket connection. The
    connection is not persisted across process restarts and is cleared on
    disconnect.
    """

    user_id: str
    player_name: Optional[str] = None
    messages_received: list[str] = []
    messages_sent: list[str] = []
    websocket: Optional[WebSocket] = None
    recipient: Optional['User'] = None

    def __init__(self):
        self.user_id = str(uuid4())
        self.messages_received = []
        self.messages_sent = []
        self.websocket = None
        self.recipient = None

    @property
    def hash(self) -> str:
        """Return the 4-Character Hash of the User ID."""
        return str(hash(self.user_id))[-4:]

    async def connect(self, ws: WebSocket) -> None:
        """Attach a WebSocket connection to this user."""
        self.websocket = ws

    async def send_json(self, obj) -> None:
        """Send JSON to the user's websocket if connected."""
        if self.websocket:
            await self.websocket.send_json(obj)

    async def receive_json(self):
        """Receive JSON from the user's websocket. Caller should handle
        exceptions like WebSocketDisconnect."""
        if not self.websocket:
            raise RuntimeError("No websocket connected for user")
        received = await self.websocket.receive_json()
        if text := received.get("text"):
            self.messages_sent.append(text)
        return received

    async def close(self, code: int = 1000) -> None:
        """Close and clear the websocket connection."""
        if self.websocket:
            try:
                await self.websocket.close(code=code)
            finally:
                self.websocket = None


class SessionManager:
    """Class to manage user sessions and attach websocket connections."""

    def __init__(self):
        # sessions: dict[user_id, User]
        self.sessions: dict[str, User] = {}

    def new_session(self) -> str:
        """Create a new user session and return the session token."""
        user = User()
        self.sessions[user.user_id] = user
        return user.user_id

    def get_session(self, client_token: str) -> Optional[User]:
        """Retrieve a user session by its token."""
        return self.sessions.get(client_token)

    def get_session_hash(self, client_token: str) -> Optional[str]:
        """Retrieve the hash of a user session by its token."""
        user = self.get_session(client_token)
        return user.hash if user else None

    def set_player_name(self, client_token: str, player_name: str) -> None:
        """Set the player's name for a given session."""
        user = self.get_session(client_token)
        if user:
            user.player_name = player_name

    async def forward_message(self, message: str, client_token: Optional[str] = None) -> User | None:
        """Send a Message to the Next User in the Session List."""
        if not client_token:
            for user in self.sessions.values():
                # use the first connected user we find
                if user.websocket and len(user.messages_received) == 0:
                    client_token = user.user_id
                    break
        user = self.get_session(client_token)
        if not user:
            return None
        if user.recipient is None or user.recipient.websocket is None:
            for next_user in self.sessions.values():
                # Skip self
                if next_user.user_id == user.user_id:
                    continue
                # use the first connected user we find
                if next_user.websocket and len(next_user.messages_received) == 0:
                    user.recipient = next_user
                    break
        user.recipient.messages_received.append(message)
        await user.recipient.send_json({"text": message})
        return user.recipient

    async def connect(self, client_token: str, ws: WebSocket) -> User:
        """
        Attach a WebSocket to the user identified by client_token.

        If the session does not exist, a new session is created using the
        provided token as the user id.
        """
        user = self.get_session(client_token)
        if not user:
            # create a new User but preserve token so cookie remains meaningful
            user = User()
            user.user_id = client_token
            self.sessions[client_token] = user
        await user.connect(ws)
        return user

    async def disconnect(self, client_token: str) -> None:
        """Close the websocket for the given session (if any) and leave the
        session record in place."""
        user = self.get_session(client_token)
        if user:
            await user.close()

active_sessions = SessionManager()

def get_session_manager() -> SessionManager:
    """Get the Active Session Manager."""
    return active_sessions

# URL Paths

@router.get("/list")
async def list_users():
    """List all active user IDs."""
    users_list = []
    for user_id, user in active_sessions.sessions.items():
        users_list.append({
            "user_id": user_id,
            "player_name": user.player_name,
            "connected": user.websocket is not None,
            "messages_sent": user.messages_sent,
        })
    return users_list
