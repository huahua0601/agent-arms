"""MCP protocol client — health check and capability discovery via Streamable HTTP with session."""
import time
import logging
import json
from typing import Optional
import httpx

logger = logging.getLogger(__name__)


def _resolve_url(url: str) -> str:
    import os
    if os.path.exists("/.dockerenv"):
        url = url.replace("://127.0.0.1", "://host.docker.internal")
        url = url.replace("://localhost", "://host.docker.internal")
    return url


def _build_headers(auth_type: Optional[str], auth_config: Optional[dict], session_id: Optional[str] = None) -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    if auth_type and auth_type != "none" and auth_config:
        name = auth_config.get("header_name", "Authorization")
        value = auth_config.get("header_value", "")
        if name and value:
            headers[name] = value
    if session_id:
        headers["mcp-session-id"] = session_id
    return headers


def _parse_sse(text: str) -> Optional[dict]:
    for line in text.strip().split("\n"):
        line = line.strip()
        if line.startswith("data: "):
            try:
                return json.loads(line[6:])
            except json.JSONDecodeError:
                continue
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


async def health_check(endpoint_url: str, auth_type: Optional[str] = None, auth_config: Optional[dict] = None) -> dict:
    endpoint_url = _resolve_url(endpoint_url)
    headers = _build_headers(auth_type, auth_config)
    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(endpoint_url, json={
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                           "clientInfo": {"name": "agenthub", "version": "1.0.0"}}
            }, headers=headers)
            latency = round((time.time() - start) * 1000, 2)

            if resp.status_code != 200:
                return {"status": "unhealthy", "latency_ms": latency, "error": f"HTTP {resp.status_code}"}

            body = _parse_sse(resp.text)
            if not body:
                return {"status": "unhealthy", "latency_ms": latency, "error": "Invalid response"}
            if "result" in body:
                return {"status": "healthy", "latency_ms": latency, "server_info": body["result"].get("serverInfo")}
            if "error" in body:
                msg = body["error"].get("message", str(body["error"])) if isinstance(body["error"], dict) else str(body["error"])
                return {"status": "unhealthy", "latency_ms": latency, "error": msg}
            return {"status": "unhealthy", "latency_ms": latency, "error": "Unexpected response"}

    except httpx.ConnectError:
        return {"status": "offline", "latency_ms": None, "error": "Connection refused"}
    except httpx.TimeoutException:
        return {"status": "timeout", "latency_ms": None, "error": "Request timeout (10s)"}
    except Exception as e:
        return {"status": "error", "latency_ms": None, "error": str(e)}


async def discover_capabilities(endpoint_url: str, auth_type: Optional[str] = None, auth_config: Optional[dict] = None) -> dict:
    endpoint_url = _resolve_url(endpoint_url)
    result = {"tools": [], "resources": [], "prompts": [], "server_info": None, "error": None}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Step 1: Initialize and capture session ID
            headers = _build_headers(auth_type, auth_config)
            init_resp = await client.post(endpoint_url, json={
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"protocolVersion": "2024-11-05",
                           "capabilities": {"tools": {}, "resources": {}, "prompts": {}},
                           "clientInfo": {"name": "agenthub", "version": "1.0.0"}}
            }, headers=headers)

            if init_resp.status_code != 200:
                result["error"] = f"Initialize failed: HTTP {init_resp.status_code}"
                return result

            session_id = init_resp.headers.get("mcp-session-id")
            init_body = _parse_sse(init_resp.text)

            if not init_body or "error" in (init_body or {}):
                err = init_body.get("error", "No response") if init_body else "No response"
                result["error"] = f"Initialize error: {err}"
                return result

            server_result = init_body.get("result", {})
            result["server_info"] = server_result.get("serverInfo")
            capabilities = server_result.get("capabilities", {})
            logger.info("MCP init OK: server=%s, caps=%s, session=%s",
                        result["server_info"], list(capabilities.keys()), session_id)

            # Step 2: Send initialized notification (with session)
            sess_headers = _build_headers(auth_type, auth_config, session_id)
            try:
                await client.post(endpoint_url, json={
                    "jsonrpc": "2.0", "method": "notifications/initialized"
                }, headers=sess_headers)
            except Exception:
                pass

            # Step 3: List tools (with session)
            if "tools" in capabilities:
                try:
                    resp = await client.post(endpoint_url, json={
                        "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}
                    }, headers=sess_headers)
                    if resp.status_code == 200:
                        body = _parse_sse(resp.text)
                        if body and "result" in body:
                            result["tools"] = body["result"].get("tools", [])
                            logger.info("Discovered %d tools", len(result["tools"]))
                except Exception as e:
                    logger.warning("tools/list failed: %s", e)

            # Step 4: List resources (with session)
            if "resources" in capabilities:
                try:
                    resp = await client.post(endpoint_url, json={
                        "jsonrpc": "2.0", "id": 3, "method": "resources/list", "params": {}
                    }, headers=sess_headers)
                    if resp.status_code == 200:
                        body = _parse_sse(resp.text)
                        if body and "result" in body:
                            result["resources"] = body["result"].get("resources", [])
                except Exception as e:
                    logger.warning("resources/list failed: %s", e)

            # Step 5: List prompts (with session)
            if "prompts" in capabilities:
                try:
                    resp = await client.post(endpoint_url, json={
                        "jsonrpc": "2.0", "id": 4, "method": "prompts/list", "params": {}
                    }, headers=sess_headers)
                    if resp.status_code == 200:
                        body = _parse_sse(resp.text)
                        if body and "result" in body:
                            result["prompts"] = body["result"].get("prompts", [])
                except Exception as e:
                    logger.warning("prompts/list failed: %s", e)

    except httpx.ConnectError:
        result["error"] = "Connection refused"
    except httpx.TimeoutException:
        result["error"] = "Request timeout"
    except Exception as e:
        result["error"] = str(e)

    return result
