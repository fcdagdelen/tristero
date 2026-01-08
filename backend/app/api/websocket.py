"""WebSocket manager for real-time graph updates."""

import json
from typing import Any
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict[str, Any]):
        message_json = json.dumps(message, default=str)
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_text(message_json)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def send_graph_update(self, event_type: str, data: dict[str, Any]):
        await self.broadcast({"type": "graph_update", "event": event_type, "data": data})

    async def send_adaptation_event(self, event: dict[str, Any]):
        await self.broadcast({"type": "adaptation", "event": event})

    async def send_state_update(self, state: dict[str, Any]):
        await self.broadcast({"type": "state", "data": state})


manager = ConnectionManager()
