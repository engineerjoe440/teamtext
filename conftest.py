from pathlib import Path

import pytest
from fastapi.testclient import TestClient

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
        self.sent_payloads.append(payload)

    async def receive_json(self):
        if not self.receive_queue:
            return {}
        return self.receive_queue.pop(0)

    async def close(self, code=1000):
        self.closed = True
        self.close_code = code


def _ensure_runtime_assets() -> None:
    """Ensure template/static paths required by app startup exist in tests."""
    package_dir = Path(__file__).resolve().parents[1] / "teamtext"
    static_dir = package_dir / "static"
    templates_dir = package_dir / "templates"
    index_template = templates_dir / "index.html"

    static_dir.mkdir(parents=True, exist_ok=True)
    templates_dir.mkdir(parents=True, exist_ok=True)

    if not index_template.exists():
        index_template.write_text(
            """
<!doctype html>
<html>
  <body>
    TeamText test template
    {{ client_id_token }}
    {{ client_hash }}
    {{ game_title }}
    {{ player_name }}
  </body>
</html>
""".strip(),
            encoding="utf-8",
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
    _ensure_runtime_assets()
    from teamtext.main import app

    with TestClient(app) as test_client:
        yield test_client
