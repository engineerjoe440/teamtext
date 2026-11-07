"""Tests for importing the main application module."""

from teamtext.main import app


def test_main_module_imports_and_exposes_app(client):
    """Expose the FastAPI application through the test client."""
    # Import is exercised by the client fixture; this asserts app is available.
    assert client.app is app
