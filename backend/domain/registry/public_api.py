"""Public MCP Server Registry API — for agents to discover and connect to MCP servers.

Endpoints:
  GET  /registry/v1/mcp                          — search MCP servers
  GET  /registry/v1/mcp/{namespace}               — get server manifest (endpoint, auth, tools)
  GET  /registry/v1/mcp/{namespace}/cursor.json   — Cursor IDE mcp.json config snippet
  GET  /registry/v1/mcp/{namespace}/claude.json   — Claude Desktop config snippet
  GET  /registry/v1/mcp/{namespace}/tools         — list discovered tools

No authentication required for public/active servers.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from core.database import get_db
from domain.registry.models import McpServer

router = APIRouter(prefix="/registry/v1/mcp", tags=["public-mcp-registry"])


async def _find_server(db: AsyncSession, namespace: str) -> Optional[McpServer]:
    result = await db.execute(
        select(McpServer)
        .where(McpServer.namespace == namespace, McpServer.status == "active")
        .options(selectinload(McpServer.tags), selectinload(McpServer.tools),
                 selectinload(McpServer.resources), selectinload(McpServer.prompts))
    )
    return result.scalar_one_or_none()


@router.get("")
async def search_servers(
    q: Optional[str] = None,
    transport: Optional[str] = None,
    tag: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Search registered MCP servers. No auth required."""
    from domain.registry.service import list_servers
    tag_list = [tag] if tag else None
    items, total = await list_servers(db, page, page_size, q, tag_list, None, "active")
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [{
            "name": s.name, "namespace": s.namespace, "description": s.description,
            "version": s.version, "transport_type": s.transport_type,
            "endpoint_url": s.endpoint_url, "auth_type": s.auth_type or "none",
            "health_status": s.health_status or "unknown",
            "tags": [t.name for t in s.tags],
            "tool_count": len(s.tools) if s.tools else 0,
            "manifest_url": f"/registry/v1/mcp/{s.namespace}",
            "cursor_config_url": f"/registry/v1/mcp/{s.namespace}/cursor.json",
        } for s in items],
    }


@router.get("/{ns:path}/cursor.json")
async def cursor_config(ns: str, db: AsyncSession = Depends(get_db)):
    """Generate Cursor IDE mcp.json config for this server.

    Usage: curl https://registry/registry/v1/mcp/test.com/ses/cursor.json >> .cursor/mcp.json
    """
    server = await _find_server(db, ns)
    if not server: raise HTTPException(404, f"Server '{ns}' not found")
    if not server.endpoint_url: raise HTTPException(400, "No endpoint configured")

    config: dict = {"url": server.endpoint_url}

    if server.auth_type and server.auth_type != "none" and server.auth_config:
        headers = {}
        header_name = server.auth_config.get("header_name", "")
        header_value = server.auth_config.get("header_value", "")
        if header_name and header_value:
            headers[header_name] = header_value
        if headers:
            config["headers"] = headers

    return JSONResponse({
        "mcpServers": {
            server.name.lower().replace(" ", "-"): config
        }
    })


@router.get("/{ns:path}/claude.json")
async def claude_config(ns: str, db: AsyncSession = Depends(get_db)):
    """Generate Claude Desktop config snippet for this server."""
    server = await _find_server(db, ns)
    if not server: raise HTTPException(404, f"Server '{ns}' not found")
    if not server.endpoint_url: raise HTTPException(400, "No endpoint configured")

    config: dict = {"url": server.endpoint_url, "transport": server.transport_type}

    if server.auth_type and server.auth_type != "none" and server.auth_config:
        header_name = server.auth_config.get("header_name", "")
        header_value = server.auth_config.get("header_value", "")
        if header_name and header_value:
            config["headers"] = {header_name: header_value}

    return JSONResponse({
        "mcpServers": {
            server.name.lower().replace(" ", "-"): config
        }
    })


@router.get("/{ns:path}/tools")
async def list_tools(ns: str, db: AsyncSession = Depends(get_db)):
    """List all discovered tools for this server."""
    server = await _find_server(db, ns)
    if not server: raise HTTPException(404, f"Server '{ns}' not found")
    return [{
        "name": t.name, "description": t.description, "input_schema": t.input_schema
    } for t in (server.tools or [])]


@router.get("/{ns:path}")
async def get_manifest(ns: str, db: AsyncSession = Depends(get_db)):
    """Full server manifest with connection info and capabilities."""
    server = await _find_server(db, ns)
    if not server: raise HTTPException(404, f"Server '{ns}' not found")

    auth_info = None
    if server.auth_type and server.auth_type != "none":
        auth_info = {"type": server.auth_type, "header": server.auth_config.get("header_name", "") if server.auth_config else ""}

    return {
        "schema_version": "1.0",
        "name": server.name,
        "namespace": server.namespace,
        "description": server.description,
        "version": server.version,
        "transport_type": server.transport_type,
        "endpoint_url": server.endpoint_url,
        "auth": auth_info,
        "health_status": server.health_status,
        "health_latency_ms": server.health_latency_ms,
        "tags": [t.name for t in server.tags],
        "tools": [{"name": t.name, "description": t.description} for t in (server.tools or [])],
        "resources": [{"name": r.name, "uri_template": r.uri_template} for r in (server.resources or [])],
        "prompts": [{"name": p.name, "description": p.description} for p in (server.prompts or [])],
        "config_urls": {
            "cursor": f"/registry/v1/mcp/{server.namespace}/cursor.json",
            "claude": f"/registry/v1/mcp/{server.namespace}/claude.json",
        },
    }
