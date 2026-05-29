"""Gateway proxy router — unified MCP endpoint with header-based routing.

When AgentCore is enabled, MCP requests are routed through AWS Bedrock AgentCore Gateway.
Otherwise, falls back to the self-hosted direct proxy.
"""
import time
import json
import asyncio
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Request, Response, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db, async_session
from domain.registry.models import McpServer
from domain.registry.mcp_client import _resolve_url, _build_headers, _parse_sse
from domain.gateway.auth import authenticate_gateway_request
from domain.gateway.models import GatewayCallLog
from domain.agentcore import is_agentcore_enabled

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Gateway"])


@router.api_route("/gateway/mcp", methods=["POST", "GET", "DELETE"])
async def gateway_proxy(request: Request, db: AsyncSession = Depends(get_db)):
    """MCP Gateway — routes JSON-RPC requests to target MCP server.

    Routing: X-MCP-Server header specifies the target server namespace.
    Auth: Authorization: Bearer <api_key> using registry API keys.

    When AgentCore is enabled, requests are delegated to AWS AgentCore Gateway
    for managed routing, auth, throttling, and observability.
    """
    user_id, username, api_key_id = await authenticate_gateway_request(request, db)

    server_ns = request.headers.get("x-mcp-server", "").strip()
    if not server_ns:
        raise HTTPException(status_code=400, detail="Missing X-MCP-Server header")

    result = await db.execute(
        select(McpServer).where(McpServer.namespace == server_ns)
    )
    server: Optional[McpServer] = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail=f"MCP server '{server_ns}' not found")

    body_bytes = await request.body()
    try:
        rpc_body = json.loads(body_bytes) if body_bytes else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    method_name = rpc_body.get("method", "")
    tool_name = rpc_body.get("params", {}).get("name") if method_name == "tools/call" else None

    # --- AgentCore Gateway routing ---
    if is_agentcore_enabled():
        return await _route_via_agentcore(
            request, server, server_ns, rpc_body, body_bytes,
            method_name, tool_name, user_id, username, api_key_id,
        )

    # --- Self-hosted routing (fallback) ---

    # Tunnel-enabled servers: route via reverse WebSocket
    if server.tunnel_enabled:
        return await _route_via_tunnel(
            request, server, server_ns, rpc_body, body_bytes,
            method_name, tool_name, user_id, username, api_key_id,
        )

    if not server.endpoint_url:
        raise HTTPException(status_code=400, detail=f"MCP server '{server_ns}' has no endpoint configured")

    # OpenAPI-type servers: delegate to REST-to-MCP runtime
    if server.source_type == "openapi" and server.openapi_spec:
        from domain.registry.rest_to_mcp import handle_rest_to_mcp
        return await handle_rest_to_mcp(server, request, user_id, username, api_key_id)

    # Direct HTTP proxy to MCP server
    return await _route_direct_proxy(
        request, server, server_ns, body_bytes,
        method_name, tool_name, user_id, username, api_key_id,
    )


async def _route_via_agentcore(
    request: Request, server: McpServer, server_ns: str,
    rpc_body: dict, body_bytes: bytes,
    method_name: str, tool_name: Optional[str],
    user_id: int, username: str, api_key_id: Optional[int],
) -> Response:
    """Route MCP request through AWS AgentCore Gateway."""
    from domain.agentcore.gateway_adapter import get_gateway_adapter
    from domain.agentcore.observability_adapter import trace_tool_call

    adapter = get_gateway_adapter()
    start = time.time()
    response_status = "success"
    error_message = None

    try:
        async with trace_tool_call(tool_name or method_name, server_ns):
            resp_data = await adapter.route_mcp_request(server_ns, rpc_body)

        if "error" in resp_data:
            response_status = "error"
            err = resp_data["error"]
            error_message = err.get("message", str(err)) if isinstance(err, dict) else str(err)

        resp_body = json.dumps(resp_data).encode()
    except Exception as e:
        response_status = "error"
        error_message = str(e)[:500]
        resp_data = {"jsonrpc": "2.0", "id": rpc_body.get("id"), "error": {"code": -32000, "message": f"AgentCore Gateway error: {error_message}"}}
        resp_body = json.dumps(resp_data).encode()

    latency_ms = round((time.time() - start) * 1000, 2)
    await _log_call(user_id, username, api_key_id, server, server_ns, method_name, tool_name, rpc_body.get("params"), response_status, error_message, latency_ms, len(body_bytes), len(resp_body), request)

    return Response(content=resp_body, media_type="application/json")


async def _route_via_tunnel(
    request: Request, server: McpServer, server_ns: str,
    rpc_body: dict, body_bytes: bytes,
    method_name: str, tool_name: Optional[str],
    user_id: int, username: str, api_key_id: Optional[int],
) -> Response:
    """Route MCP request through reverse WebSocket tunnel."""
    from domain.tunnel.manager import tunnel_registry

    conn = tunnel_registry.get(server.id)
    if not conn:
        raise HTTPException(status_code=503, detail=f"Tunnel agent for '{server_ns}' is offline")

    start = time.time()
    try:
        resp_body = await conn.call(rpc_body, timeout=60.0)
        latency_ms = round((time.time() - start) * 1000, 2)
        response_status = "error" if "error" in resp_body else "success"
        error_message = None
        if "error" in resp_body and isinstance(resp_body["error"], dict):
            error_message = resp_body["error"].get("message", "")[:500]
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Tunnel request timeout")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tunnel error: {e}")

    await _log_call(user_id, username, api_key_id, server, server_ns, method_name, tool_name, {"_tunnel": True}, response_status, error_message, latency_ms, len(body_bytes), len(json.dumps(resp_body)), request)

    return Response(content=json.dumps(resp_body), media_type="application/json")


async def _route_direct_proxy(
    request: Request, server: McpServer, server_ns: str,
    body_bytes: bytes, method_name: str, tool_name: Optional[str],
    user_id: int, username: str, api_key_id: Optional[int],
) -> Response:
    """Route MCP request directly to the target server via HTTP proxy."""
    request_size = len(body_bytes)
    request_params = None
    try:
        rpc_body = json.loads(body_bytes) if body_bytes else {}
        params = rpc_body.get("params", {})
        request_params = _truncate_params(params)
    except (json.JSONDecodeError, AttributeError):
        pass

    incoming_session_id = request.headers.get("mcp-session-id")
    target_url = _resolve_url(server.endpoint_url)
    target_headers = _build_headers(server.auth_type, server.auth_config, incoming_session_id)

    start = time.time()
    response_status = "success"
    error_message = None
    resp_body = b""
    resp_status_code = 200
    resp_headers = {}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if request.method == "POST":
                upstream = await client.post(target_url, content=body_bytes, headers=target_headers)
            elif request.method == "GET":
                upstream = await client.get(target_url, headers=target_headers)
            elif request.method == "DELETE":
                upstream = await client.delete(target_url, headers=target_headers)
            else:
                upstream = await client.post(target_url, content=body_bytes, headers=target_headers)

            resp_body = upstream.content
            resp_status_code = upstream.status_code
            resp_headers = dict(upstream.headers)

            if upstream.status_code >= 400:
                response_status = "error"
                error_message = f"HTTP {upstream.status_code}"
            else:
                try:
                    parsed = _parse_sse(upstream.text)
                    if parsed and "error" in parsed:
                        response_status = "error"
                        err = parsed["error"]
                        error_message = err.get("message", str(err)) if isinstance(err, dict) else str(err)
                except Exception:
                    pass

    except httpx.ConnectError:
        response_status = "error"
        error_message = "Connection refused"
        resp_body = json.dumps({"jsonrpc": "2.0", "error": {"code": -32000, "message": "Target MCP server connection refused"}}).encode()
        resp_status_code = 502
    except httpx.TimeoutException:
        response_status = "timeout"
        error_message = "Request timeout (30s)"
        resp_body = json.dumps({"jsonrpc": "2.0", "error": {"code": -32000, "message": "Target MCP server timeout"}}).encode()
        resp_status_code = 504
    except Exception as e:
        response_status = "error"
        error_message = str(e)[:500]
        resp_body = json.dumps({"jsonrpc": "2.0", "error": {"code": -32000, "message": f"Gateway error: {error_message}"}}).encode()
        resp_status_code = 502

    latency_ms = round((time.time() - start) * 1000, 2)
    await _log_call(user_id, username, api_key_id, server, server_ns, method_name, tool_name, request_params, response_status, error_message, latency_ms, request_size, len(resp_body), request)

    pass_through_headers = {}
    for key in ("mcp-session-id", "content-type"):
        if key in resp_headers:
            pass_through_headers[key] = resp_headers[key]

    return Response(
        content=resp_body,
        status_code=resp_status_code,
        headers=pass_through_headers,
        media_type=resp_headers.get("content-type", "application/json"),
    )


async def _log_call(
    user_id, username, api_key_id, server, server_ns,
    method_name, tool_name, request_params,
    response_status, error_message, latency_ms,
    request_size, response_size, request: Request,
):
    """Persist a gateway call log entry."""
    try:
        async with async_session() as log_db:
            log = GatewayCallLog(
                user_id=user_id, username=username, api_key_id=api_key_id,
                server_id=server.id, server_namespace=server_ns,
                method=method_name, tool_name=tool_name,
                request_params=request_params if isinstance(request_params, dict) else None,
                response_status=response_status, error_message=error_message,
                latency_ms=latency_ms,
                request_size=request_size, response_size=response_size,
                ip_address=request.client.host if request.client else None,
            )
            log_db.add(log)
            await log_db.commit()
    except Exception as e:
        logger.warning("Failed to log gateway call: %s", e)


def _truncate_params(params: dict, max_len: int = 1024) -> Optional[dict]:
    """Keep a truncated snapshot of request params for logging."""
    if not params:
        return None
    try:
        s = json.dumps(params, default=str)
        if len(s) > max_len:
            return {"_truncated": True, "_preview": s[:max_len]}
        return params
    except Exception:
        return {"_error": "non-serializable"}
