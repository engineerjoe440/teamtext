################################################################################
"""
TeamText - Modern reimagining of the classic telephone game for education!

(c) 2025 Stanley Solutions
"""
################################################################################

from typing import Annotated, Optional
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.requests import Request
from fastapi.responses import HTMLResponse
from fastapi.params import Cookie
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from loguru import logger

from teamtext import __header__, __version__
from teamtext.logger import CustomLogger
from teamtext.settings import get_settings
from teamtext.sockets import WebSocketManager

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
manager = WebSocketManager()

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
    # # Set Client Token if Needed
    # if not client_token:
    #     client_token = clients.new_session()
    # elif not clients.get_session(client_token=client_token):
    #     client_token = clients.new_session()
    response = TEMPLATES.TemplateResponse(
        name="index.html",
        request=request,
        context={
            "request": request,
            "client_id_token": client_token,
            "game_title": get_settings().game_title,
			"player_name": player_name,
        },
    )
    response.set_cookie("client_token", client_token)
    return response


# Main Application Response - Loads Index Page, Login Page, and Admin Portal
@app.get("/", response_class=HTMLResponse, include_in_schema=False)
@app.get("/chat", response_class=HTMLResponse, include_in_schema=False)
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



@app.websocket('/ws')
async def websocket_endpoint(ws: WebSocket):
	session = await manager.connect(ws)
	try:
		while True:
			data = await session.receive_json()
			print(data)
			# handle incoming message; broadcast to other clients, etc.
	except WebSocketDisconnect:
		await manager.disconnect(session.id)