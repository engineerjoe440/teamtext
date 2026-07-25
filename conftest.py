"""Test fixtures and helpers for TeamText unit tests."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from teamtext.main import app
from teamtext import settings as settings_module
from teamtext import users as users_module


DEFAULT_GAME_TITLE = "TeamText"
DEFAULT_STARTING_MESSAGE = (
    "4-H is a community of young people across America who are learning "
    "leadership, citizenship, and life skills."
)


class DummyWebSocket:
    """Simple websocket-like test double used for session-level unit tests."""

    def __init__(self, receive_queue=None):
        self.receive_queue = list(receive_queue or [])
        self.sent_payloads = []
        self.closed = False
        self.close_code = None

    async def send_json(self, payload):
        """Simulate sending JSON to the websocket by storing it in a list."""
        self.sent_payloads.append(payload)

    async def receive_json(self):
        """Simulate receiving JSON from the websocket by popping from a queue."""
        if not self.receive_queue:
            return {}
        return self.receive_queue.pop(0)

    async def close(self, code=1000):
        """Simulate closing the websocket by setting a closed flag."""
        self.closed = True
        self.close_code = code


def _ensure_runtime_assets() -> None:
    """Validate package template/static paths required by app startup."""
    package_dir = Path(__file__).resolve().parent / "teamtext"
    static_dir = package_dir / "static"
    templates_dir = package_dir / "templates"
    index_template = templates_dir / "index.html"

    missing_paths = [
        path
        for path in (static_dir, templates_dir, index_template)
        if not path.exists()
    ]
    if missing_paths:
        missing_list = ", ".join(str(path) for path in missing_paths)
        raise RuntimeError(
            f"Missing runtime assets required for tests: {missing_list}"
        )


@pytest.fixture(autouse=True)
def reset_global_state():
    """Reset module-level globals so tests remain isolated."""
    settings_module.active.playing = False
    settings_module.active.game_title = DEFAULT_GAME_TITLE
    settings_module.active.starting_message = DEFAULT_STARTING_MESSAGE

    users_module.active_sessions.sessions = {}
    users_module.active_sessions.final_message = None

    yield

    settings_module.active.playing = False
    settings_module.active.game_title = DEFAULT_GAME_TITLE
    settings_module.active.starting_message = DEFAULT_STARTING_MESSAGE

    users_module.active_sessions.sessions = {}
    users_module.active_sessions.final_message = None


@pytest.fixture
def client():
    """Provide a FastAPI TestClient for API and websocket tests."""
    _ensure_runtime_assets()

    with TestClient(app) as test_client:
        yield test_client
