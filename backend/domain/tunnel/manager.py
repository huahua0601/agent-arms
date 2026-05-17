"""Tunnel manager — in-memory WebSocket connection tracking and request routing.

Architecture:
    - Each tunnel agent (running inside a private network) maintains a WebSocket to the registry.
    - Gateway / direct calls lookup the server_id in the ConnectionRegistry and forward the
      JSON-RPC over the WebSocket, awaiting a response by request id.
    - Responses from agent are delivered via Future resolution.
"""
import asyncio
import json
import logging
import uuid
from typing import Dict, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class TunnelConnection:
    """One active WebSocket connection from a tunnel agent."""

    def __init__(self, server_id: int, namespace: str, ws: WebSocket, agent_info: dict):
        self.server_id = server_id
        self.namespace = namespace
        self.ws = ws
        self.agent_info = agent_info
        self.connected_at = asyncio.get_event_loop().time()
        self._pending: Dict[str, asyncio.Future] = {}
        self._lock = asyncio.Lock()
        self._closed = False

    async def call(self, json_rpc_body: dict, timeout: float = 30.0) -> dict:
        """Send a JSON-RPC request to the agent and await its response."""
        if self._closed:
            raise RuntimeError("Tunnel connection closed")

        req_id = json_rpc_body.get("id")
        if req_id is None:
            req_id = str(uuid.uuid4())
            json_rpc_body = {**json_rpc_body, "id": req_id}

        envelope = {"type": "request", "req_id": str(req_id), "payload": json_rpc_body}
        fut: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[str(req_id)] = fut

        try:
            async with self._lock:
                await self.ws.send_text(json.dumps(envelope))
            response = await asyncio.wait_for(fut, timeout=timeout)
            return response
        finally:
            self._pending.pop(str(req_id), None)

    def handle_response(self, envelope: dict):
        """Called when agent sends back a response envelope."""
        req_id = str(envelope.get("req_id", ""))
        fut = self._pending.get(req_id)
        if fut and not fut.done():
            fut.set_result(envelope.get("payload", {}))

    async def close(self):
        if self._closed:
            return
        self._closed = True
        for fut in self._pending.values():
            if not fut.done():
                fut.set_exception(RuntimeError("Tunnel closed"))
        self._pending.clear()
        try:
            await self.ws.close()
        except Exception:
            pass


class TunnelRegistry:
    """Global registry of active tunnel connections, keyed by server_id."""

    def __init__(self):
        self._conns: Dict[int, TunnelConnection] = {}
        self._lock = asyncio.Lock()

    async def register(self, conn: TunnelConnection) -> None:
        async with self._lock:
            existing = self._conns.get(conn.server_id)
            if existing:
                logger.info("Replacing existing tunnel for server %s", conn.server_id)
                await existing.close()
            self._conns[conn.server_id] = conn
        logger.info("Tunnel registered for server %s (%s)", conn.server_id, conn.namespace)

    async def unregister(self, server_id: int) -> None:
        async with self._lock:
            conn = self._conns.pop(server_id, None)
        if conn:
            await conn.close()
            logger.info("Tunnel unregistered for server %s", server_id)

    def get(self, server_id: int) -> Optional[TunnelConnection]:
        return self._conns.get(server_id)

    def is_connected(self, server_id: int) -> bool:
        conn = self._conns.get(server_id)
        return conn is not None and not conn._closed

    def list_connections(self) -> list[dict]:
        return [
            {
                "server_id": c.server_id,
                "namespace": c.namespace,
                "agent_info": c.agent_info,
                "connected_at": c.connected_at,
            }
            for c in self._conns.values()
        ]


tunnel_registry = TunnelRegistry()
