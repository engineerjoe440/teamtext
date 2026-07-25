def test_main_module_imports_and_exposes_app(client):
    # Import is exercised by the client fixture; this asserts app is available.
    from teamtext.main import app

    assert app is not None
