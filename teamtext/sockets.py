################################################################################
"""
TeamText - Modern reimagining of the classic telephone game for education!

(c) 2025 Stanley Solutions
"""
################################################################################

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class WebSocketSession:
	"""Represents one WebSocket connection.

	Attributes:
	  id: unique session id (string)
	  websocket: the FastAPI `WebSocket` instance
	  meta: arbitrary metadata dictionary (e.g. username, role)
	  created_at: epoch timestamp when session was created
	"""

	id: str
	websocket: WebSocket
	meta: Dict[str, Any] = field(default_factory=dict)
	created_at: float = field(default_factory=time.time)

	async def accept(self) -> None:
		"""Accept the underlying WebSocket connection."""
		await self.websocket.accept()

	async def send_json(self, data: Any) -> None:
		"""Send JSON to this session. Handles exceptions by re-raising.

		Callers may catch exceptions and decide to disconnect the session.
		"""
		await self.websocket.send_json(data)

	async def send_text(self, text: str) -> None:
		"""Send plain text."""
		await self.websocket.send_text(text)

	async def receive_json(self) -> Any:
		"""Receive a JSON message from the socket.

		This will raise WebSocketDisconnect if the client disconnects.
		"""
		return await self.websocket.receive_json()

	async def close(self, code: int = 1000) -> None:
		"""Close the underlying WebSocket."""
		try:
			await self.websocket.close(code=code)
		except Exception:
			# ignore errors during close
			logger.debug('Error while closing websocket %s', self.id, exc_info=True)


class WebSocketManager:
	"""Manage multiple WebSocketSession instances.

	This manager is concurrency-safe: it uses an asyncio.Lock to protect
	the sessions mapping when adding/removing entries.
	"""

	def __init__(self) -> None:
		self._sessions: Dict[str, WebSocketSession] = {}
		self._lock = asyncio.Lock()

	# ----- lifecycle -----
	async def connect(self, websocket: WebSocket, meta: Optional[Dict[str, Any]] = None) -> WebSocketSession:
		"""Accept a `WebSocket` and create a managed `WebSocketSession`.

		Returns the created session. The session is already accepted.
		"""
		session_id = str(uuid.uuid4())
		session = WebSocketSession(id=session_id, websocket=websocket, meta=meta or {})
		await session.accept()
		async with self._lock:
			self._sessions[session_id] = session
		logger.debug('Connected websocket session %s', session_id)
		return session

	async def disconnect(self, session_id: str) -> None:
		"""Remove and close a session if present."""
		async with self._lock:
			session = self._sessions.pop(session_id, None)
		if not session:
			return
		try:
			await session.close()
		except Exception:
			logger.debug('Error closing session %s', session_id, exc_info=True)
		logger.debug('Disconnected websocket session %s', session_id)

	async def get(self, session_id: str) -> Optional[WebSocketSession]:
		async with self._lock:
			return self._sessions.get(session_id)

	async def list_sessions(self) -> Iterable[WebSocketSession]:
		async with self._lock:
			return list(self._sessions.values())

	# ----- messaging -----
	async def send_json_to(self, session_id: str, payload: Any) -> bool:
		"""Send JSON payload to a specific session.

		Returns True on success, False if the session does not exist or send failed.
		"""
		session = await self.get(session_id)
		if not session:
			return False
		try:
			await session.send_json(payload)
			return True
		except Exception:
			# On send failure, disconnect the session.
			logger.warning('Send failed to %s, disconnecting', session_id, exc_info=True)
			await self.disconnect(session_id)
			return False

	async def broadcast_json(self, payload: Any, *, exclude: Optional[Iterable[str]] = None) -> int:
		"""Broadcast a JSON payload to all sessions, optionally excluding some.

		Returns the number of successful sends.
		"""
		exclude_set = set(exclude) if exclude else set()
		successes = 0
		async with self._lock:
			sessions = list(self._sessions.items())
		for sid, session in sessions:
			if sid in exclude_set:
				continue
			try:
				await session.send_json(payload)
				successes += 1
			except Exception:
				logger.warning('Broadcast send failed to %s, disconnecting', sid, exc_info=True)
				await self.disconnect(sid)
		return successes

	# convenience: find sessions by meta
	async def find_by_meta(self, key: str, value: Any) -> Iterable[WebSocketSession]:
		async with self._lock:
			return [s for s in self._sessions.values() if s.meta.get(key) == value]



