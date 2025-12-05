################################################################################
"""
TeamText - Modern reimagining of the classic telephone game for education!

(c) 2025 Stanley Solutions
"""
################################################################################

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from loguru import logger

from teamtext.sockets import WebSocketManager
from teamtext import __header__, __version__

app = FastAPI()
manager = WebSocketManager()



@asynccontextmanager
async def lifespan(_: FastAPI):
    """Application Lifespan System."""
    logger.info(__header__)
    logger.info(f"Version: {__version__} starting.")

@app.websocket('/ws')
async def websocket_endpoint(ws: WebSocket):
	session = await manager.connect(ws)
	try:
		while True:
			data = await session.receive_json()
			# handle incoming message; broadcast to other clients, etc.
	except WebSocketDisconnect:
		await manager.disconnect(session.id)