"""REST-to-MCP runtime — virtual MCP server that translates MCP tool calls to REST API calls.

When an MCP server is registered with source_type="openapi" and has openapi_spec stored,
this module provides a complete MCP Streamable HTTP endpoint that:
1. Responds to initialize/tools/list with generated tool definitions
2. Translates tools/call into actual HTTP requests to the upstream REST API
"""
import json
import re
import time
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Request, Response, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db, async_session
from domain.registry.models import McpServer, McpTool
from domain.registry.openapi_converter import parse_openapi
from domain.registry.mcp_client import _resolve_url
from domain.gateway.auth import authenticate_gateway_request
from domain.gateway.models import GatewayCallLog

logger = logging.getLogger(__name__)

router = APIRouter(tags=["REST-to-MCP"])


def _build_mcp_response(id: int, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": id, "result": result}


def _build_mcp_error(id: int, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": id, "error": {"code": code, "message": message}}


def _get_tools_from_spec(server: McpServer) -> list[dict]:
    """Parse openapi_spec from server and return MCP tool list."""
    if not server.openapi_spec:
        return []
    try:
        parsed = parse_openapi(server.openapi_spec)
        tools = []
        for t in parsed.get("tools", []):
            tool_def = {
                "name": t["name"],
                "description": t.get("description", ""),
                "inputSchema": t.get("input_schema", {"type": "object", "properties": {}}),
            }
            tools.append(tool_def)
        return tools
    except Exception as e:
        logger.warning("Failed to parse openapi_spec for server %s: %s", server.id, e)
        return []


def _find_tool_config(server: McpServer, tool_name: str) -> Optional[dict]:
    """Find tool config (with request_template) from OpenAPI spec."""
    if not server.openapi_spec:
        return None
    try:
        parsed = parse_openapi(server.openapi_spec)
        for t in parsed.get("tools", []):
            if t["name"] == tool_name:
                return t
        return None
    except Exception:
        return None


async def _execute_rest_call(server: McpServer, tool_config: dict, arguments: dict) -> dict:
    """Convert MCP tools/call arguments into an HTTP request and execute it."""
    tpl = tool_config.get("request_template", {})
    method = tpl.get("method", "GET")
    url_template = tpl.get("url", "/")
    base_url = ""

    if server.openapi_spec:
        servers = server.openapi_spec.get("servers", [])
        if servers:
            base_url = servers[0].get("url", "").rstrip("/")
    if server.endpoint_url:
        base_url = server.endpoint_url.rstrip("/")

    base_url = _resolve_url(base_url)

    url = url_template
    query_params = {}
    body_fields = {}
    headers = {}

    for arg in tool_config.get("args", []):
        name = arg["name"]
        value = arguments.get(name)
        if value is None:
            continue
        position = arg.get("position", "query")
        if position == "path":
            url = url.replace(f"{{{name}}}", str(value))
        elif position == "query":
            query_params[name] = value
        elif position == "header":
            headers[name] = str(value)
        elif position == "body":
            body_fields[name] = value

    full_url = base_url + url

    if server.auth_type and server.auth_type != "none" and server.auth_config:
        h_name = server.auth_config.get("header_name", "Authorization")
        h_value = server.auth_config.get("header_value", "")
        if h_name and h_value:
            headers[h_name] = h_value

    for h in tpl.get("headers", []):
        headers[h["key"]] = h["value"]

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if method in ("POST", "PUT", "PATCH") and body_fields:
                resp = await client.request(
                    method, full_url, params=query_params, json=body_fields, headers=headers
                )
            else:
                resp = await client.request(method, full_url, params=query_params, headers=headers)
            latency = round((time.time() - start) * 1000, 2)

            try:
                data = resp.json()
            except Exception:
                data = resp.text

            return {
                "success": resp.status_code < 400,
                "status_code": resp.status_code,
                "data": data,
                "latency_ms": latency,
            }
    except httpx.ConnectError:
        return {"success": False, "status_code": 502, "data": "Connection refused", "latency_ms": 0}
    except httpx.TimeoutException:
        return {"success": False, "status_code": 504, "data": "Timeout", "latency_ms": 0}
    except Exception as e:
        return {"success": False, "status_code": 500, "data": str(e), "latency_ms": 0}


async def handle_rest_to_mcp(
    server: McpServer,
    request: Request,
    user_id: int,
    username: str,
    api_key_id: int,
) -> Response:
    """Core REST-to-MCP handler — can be called from both the direct endpoint and the Gateway."""
    body_bytes = await request.body()
    try:
        rpc = json.loads(body_bytes) if body_bytes else {}
    except json.JSONDecodeError:
        return Response(
            content=json.dumps(_build_mcp_error(0, -32700, "Parse error")),
            media_type="application/json",
        )

    rpc_id = rpc.get("id", 0)
    method = rpc.get("method", "")
    params = rpc.get("params", {})

    if method == "initialize":
        result = {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {
                "name": server.name,
                "version": server.version or "1.0.0",
            },
        }
        return Response(content=json.dumps(_build_mcp_response(rpc_id, result)), media_type="application/json")

    elif method == "notifications/initialized":
        return Response(status_code=200, content="", media_type="application/json")

    elif method == "tools/list":
        tools = _get_tools_from_spec(server)
        return Response(
            content=json.dumps(_build_mcp_response(rpc_id, {"tools": tools})),
            media_type="application/json",
        )

    elif method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        tool_config = _find_tool_config(server, tool_name)
        if not tool_config:
            return Response(
                content=json.dumps(_build_mcp_error(rpc_id, -32602, f"Unknown tool: {tool_name}")),
                media_type="application/json",
            )

        rest_result = await _execute_rest_call(server, tool_config, arguments)

        try:
            async with async_session() as log_db:
                log = GatewayCallLog(
                    user_id=user_id, username=username, api_key_id=api_key_id,
                    server_id=server.id, server_namespace=server.namespace,
                    method="tools/call", tool_name=tool_name,
                    request_params={"arguments": arguments} if len(json.dumps(arguments, default=str)) < 1024 else {"_truncated": True},
                    response_status="success" if rest_result["success"] else "error",
                    error_message=str(rest_result["data"])[:500] if not rest_result["success"] else None,
                    latency_ms=rest_result["latency_ms"],
                    request_size=len(body_bytes),
                    ip_address=request.client.host if request.client else None,
                )
                log_db.add(log)
                await log_db.commit()
        except Exception as e:
            logger.warning("Failed to log REST-to-MCP call: %s", e)

        content_text = json.dumps(rest_result["data"], ensure_ascii=False, default=str) if not isinstance(rest_result["data"], str) else rest_result["data"]
        mcp_result = {
            "content": [{"type": "text", "text": content_text}],
            "isError": not rest_result["success"],
        }
        return Response(
            content=json.dumps(_build_mcp_response(rpc_id, mcp_result)),
            media_type="application/json",
        )

    else:
        return Response(
            content=json.dumps(_build_mcp_error(rpc_id, -32601, f"Method not found: {method}")),
            media_type="application/json",
        )


@router.post("/mcp/rest/{server_id}")
async def rest_to_mcp_endpoint(
    server_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """MCP Streamable HTTP endpoint for OpenAPI-backed virtual MCP servers."""
    user_id, username, api_key_id = await authenticate_gateway_request(request, db)

    server = (await db.execute(select(McpServer).where(McpServer.id == server_id))).scalar_one_or_none()
    if not server:
        raise HTTPException(404, "Server not found")
    if not server.openapi_spec:
        raise HTTPException(400, "Server has no OpenAPI spec configured")

    return await handle_rest_to_mcp(server, request, user_id, username, api_key_id)
