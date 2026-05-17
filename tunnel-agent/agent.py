#!/usr/bin/env python3
"""AgentHub Tunnel Agent - reverse tunnel for private-network MCP servers.

Usage:
    python agent.py --registry wss://registry.example.com --token tnl_xxx --local http://localhost:8080

This agent runs inside your private network. It:
  1. Opens a persistent WebSocket to the public registry
  2. Accepts incoming JSON-RPC requests from the registry
  3. Forwards them to your local MCP server via HTTP
  4. Sends the response back through the WebSocket

No public IP or inbound firewall rule required on your side.
"""
import argparse
import asyncio
import json
import logging
import platform
import signal
import sys
import time
from typing import Optional

import httpx
import websockets

logger = logging.getLogger("tunnel-agent")

RECONNECT_DELAY_BASE = 1.0
RECONNECT_DELAY_MAX = 30.0
PING_INTERVAL = 30.0


class TunnelAgent:
    def __init__(self, registry_url: str, token: str, local_url: str,
                 auth_header: Optional[str] = None, auth_value: Optional[str] = None,
                 name: Optional[str] = None):
        self.registry_url = registry_url.rstrip("/")
        self.token = token
        self.local_url = local_url.rstrip("/")
        self.auth_header = auth_header
        self.auth_value = auth_value
        self.name = name or platform.node()
        self._http: Optional[httpx.AsyncClient] = None
        self._ws = None
        self._session_id: Optional[str] = None
        self._shutdown = asyncio.Event()

    @property
    def ws_url(self) -> str:
        base = self.registry_url
        if base.startswith("http://"):
            base = "ws://" + base[7:]
        elif base.startswith("https://"):
            base = "wss://" + base[8:]
        return f"{base}/tunnel/connect?token={self.token}"

    async def start(self):
        self._http = httpx.AsyncClient(timeout=30.0)
        try:
            await self._run_loop()
        finally:
            await self._http.aclose()

    async def stop(self):
        self._shutdown.set()
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass

    async def _run_loop(self):
        delay = RECONNECT_DELAY_BASE
        while not self._shutdown.is_set():
            try:
                logger.info("Connecting to %s ...", self.ws_url)
                async with websockets.connect(self.ws_url, max_size=10 * 1024 * 1024) as ws:
                    self._ws = ws
                    delay = RECONNECT_DELAY_BASE
                    await self._handle_connection(ws)
            except websockets.ConnectionClosed as e:
                logger.warning("Connection closed (code=%s): %s", e.code, e.reason)
                if e.code == 4001:
                    logger.error("Invalid tunnel token. Check your --token argument.")
                    return
                if e.code == 4004:
                    logger.error("Server not found for this token.")
                    return
            except Exception as e:
                logger.error("Connection error: %s", e)

            if self._shutdown.is_set():
                break

            logger.info("Reconnecting in %.1fs ...", delay)
            try:
                await asyncio.wait_for(self._shutdown.wait(), timeout=delay)
                break
            except asyncio.TimeoutError:
                pass
            delay = min(delay * 2, RECONNECT_DELAY_MAX)

    async def _handle_connection(self, ws):
        # Send hello with agent info
        hello = {
            "agent_info": {
                "name": self.name,
                "hostname": platform.node(),
                "platform": platform.platform(),
                "python": platform.python_version(),
                "version": "1.0.0",
            }
        }
        await ws.send(json.dumps(hello))

        # Wait for welcome
        welcome_raw = await ws.recv()
        welcome = json.loads(welcome_raw)
        if welcome.get("type") == "error":
            logger.error("Registry rejected: %s", welcome.get("error"))
            return
        if welcome.get("type") == "welcome":
            logger.info("[OK] Tunnel established: namespace=%s", welcome.get("namespace"))

        # Start periodic ping
        ping_task = asyncio.create_task(self._ping_loop(ws))

        try:
            async for raw in ws:
                try:
                    envelope = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                etype = envelope.get("type")
                if etype == "request":
                    asyncio.create_task(self._handle_request(ws, envelope))
                elif etype == "pong":
                    pass
        finally:
            ping_task.cancel()

    async def _ping_loop(self, ws):
        try:
            while not self._shutdown.is_set():
                await asyncio.sleep(PING_INTERVAL)
                await ws.send(json.dumps({"type": "ping"}))
        except Exception:
            pass

    async def _handle_request(self, ws, envelope: dict):
        req_id = envelope.get("req_id")
        payload = envelope.get("payload", {})
        method = payload.get("method", "")
        logger.info("-> %s (req_id=%s)", method, req_id)

        try:
            response = await self._forward_to_local(payload)
        except Exception as e:
            logger.error("Local call failed: %s", e)
            response = {
                "jsonrpc": "2.0",
                "id": payload.get("id"),
                "error": {"code": -32603, "message": f"Agent error: {e}"}
            }

        await ws.send(json.dumps({
            "type": "response",
            "req_id": req_id,
            "payload": response,
        }))

    async def _forward_to_local(self, rpc: dict) -> dict:
        method = rpc.get("method", "")
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if self.auth_header and self.auth_value:
            headers[self.auth_header] = self.auth_value
        if self._session_id:
            headers["mcp-session-id"] = self._session_id

        start = time.time()
        resp = await self._http.post(self.local_url, json=rpc, headers=headers)
        elapsed = round((time.time() - start) * 1000, 2)
        logger.info("   <- %d (%.1fms)", resp.status_code, elapsed)

        new_session = resp.headers.get("mcp-session-id")
        if new_session and method == "initialize":
            self._session_id = new_session

        text = resp.text
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # SSE response — parse data: lines
            for line in text.strip().split("\n"):
                line = line.strip()
                if line.startswith("data: "):
                    try:
                        return json.loads(line[6:])
                    except json.JSONDecodeError:
                        continue
            return {
                "jsonrpc": "2.0",
                "id": rpc.get("id"),
                "error": {"code": -32603, "message": f"Invalid response from local server (HTTP {resp.status_code})"}
            }


def main():
    parser = argparse.ArgumentParser(description="AgentHub Tunnel Agent")
    parser.add_argument("--registry", required=True, help="Registry URL (e.g., https://registry.example.com)")
    parser.add_argument("--token", required=True, help="Tunnel token from registry")
    parser.add_argument("--local", required=True, help="Local MCP server URL (e.g., http://localhost:8080/mcp)")
    parser.add_argument("--auth-header", help="Optional auth header name for local server")
    parser.add_argument("--auth-value", help="Optional auth header value for local server")
    parser.add_argument("--name", help="Agent display name (defaults to hostname)")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    agent = TunnelAgent(
        registry_url=args.registry,
        token=args.token,
        local_url=args.local,
        auth_header=args.auth_header,
        auth_value=args.auth_value,
        name=args.name,
    )

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def shutdown():
        logger.info("Shutting down...")
        loop.create_task(agent.stop())

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, shutdown)
        except NotImplementedError:
            pass

    try:
        loop.run_until_complete(agent.start())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
