################################################################################
"""
TeamText - Modern reimagining of the classic telephone game for education!

(c) 2025 Stanley Solutions
"""
################################################################################

from typing import Annotated, Optional
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Cookie
from fastapi.requests import Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from loguru import logger

from teamtext import __header__, __version__
from teamtext.logger import CustomLogger
from teamtext.settings import get_settings
from teamtext.users import SessionManager, get_session_manager
from teamtext.users import router as user_router

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Application Lifespan System."""
    logger.info(__header__)
    logger.info(f"Version: {__version__} starting.")
    yield
    logger.info("Application shutting down.")

app = FastAPI(
	title="TeamText",
	summary="Modern reimagining of the classic telephone game for education!",
	version=__version__,
	lifespan=lifespan,
)
app.include_router(user_router)


clients: SessionManager = get_session_manager()

# Configure the Logger
app.logger = CustomLogger.make_logger(
    Path(__file__).with_name("log_conf.json")
)

# Mount the Static File Path
app.mount(
    "/static",
    StaticFiles(directory=Path(__file__).parent/"static"),
    name="static"
)

# Load Templates
TEMPLATES: Jinja2Templates = Jinja2Templates(
    directory=(Path(__file__).parent/"templates")
)



def web_page_load(
    request: Request,
    client_token: Annotated[str | None, Cookie()] = None,
	player_name: Optional[str] = None,
) -> HTMLResponse:
    """General Web Page Response Loader."""
    # Set Client Token if Needed
    if not client_token:
        client_token = clients.new_session()
    elif not clients.get_session(client_token=client_token):
        client_token = clients.new_session()
    # Set Player Name
    clients.set_player_name(
		client_token=client_token,
		player_name=player_name,
	)
    # Prepare the Response
    response = TEMPLATES.TemplateResponse(
        name="index.html",
        request=request,
        context={
            "request": request,
            "client_id_token": client_token,
            "client_hash": clients.get_session_hash(client_token=client_token),
            "game_title": get_settings().game_title,
			"player_name": player_name,
        },
    )
    response.set_cookie("client_token", client_token)
    return response


# Main Application Response - Loads Index Page, Login Page, and Admin Portal
@app.get("/", response_class=HTMLResponse, include_in_schema=False)
@app.get("/play", response_class=HTMLResponse, include_in_schema=False)
@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
@app.get("/control", response_class=HTMLResponse, include_in_schema=False)
async def root(
    request: Request,
    client_token: Annotated[str | None, Cookie()] = None,
	name: Optional[str] = None,
):
    """Server Root."""
    return web_page_load(
		request=request,
		client_token=client_token,
		player_name=name,
	)


@app.websocket('/ws/chat')
async def websocket_endpoint(
    ws: WebSocket,
    client_token: Annotated[str | None, Cookie()] = None
):
    """
    WebSocket endpoint that attaches the connection to the user's session.

    The client should supply the `client_token` cookie (set by the HTML
    page). If missing, a new session will be created and used.
    """
    # Accept the websocket connection first
    await ws.accept()

    # Determine or create a client token
    if not client_token:
        # try to use query param ?client_token=... if provided
        client_token = ws.query_params.get('client_token') or clients.new_session()
    # Attach websocket to session
    user = await clients.connect(client_token=client_token, ws=ws)

    try:
        while True:
            data = await user.receive_json()
            # For now simply echo the message back and log it
            print(f"Received from {user.user_id}:", data)
            await user.send_json({"echo": data})
    except WebSocketDisconnect:
        await clients.disconnect(client_token)