"""Tunnel API — WebSocket for agents + REST for tunnel token management."""
import asyncio
import base64
import datetime
import hashlib
import json
import logging
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db, async_session
from middleware.auth import get_current_user, PermissionChecker
from domain.tunnel.models import TunnelToken
from domain.tunnel.manager import TunnelConnection, tunnel_registry
from domain.registry.models import McpServer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tunnel", tags=["tunnel"])
ws_router = APIRouter(tags=["tunnel"])


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ------- Schemas -------

class TunnelTokenCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    server_id: int


class TunnelTokenResponse(BaseModel):
    id: int
    name: str
    token_prefix: str
    server_id: int
    is_active: bool
    last_connected_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    full_token: Optional[str] = None
    is_connected: bool = False


# ------- REST API -------

@router.post("/tokens", response_model=TunnelTokenResponse, status_code=201)
async def create_token(
    body: TunnelTokenCreate,
    current=Depends(PermissionChecker(["mcp_server:update"])),
    db: AsyncSession = Depends(get_db),
):
    server = (await db.execute(select(McpServer).where(McpServer.id == body.server_id))).scalar_one_or_none()
    if not server:
        raise HTTPException(404, "Server not found")

    server.tunnel_enabled = True

    raw = f"tnl_{secrets.token_urlsafe(32)}"
    tok = TunnelToken(
        name=body.name, token_hash=_hash_token(raw), token_prefix=raw[:12],
        server_id=body.server_id, created_by=int(current["sub"]),
    )
    db.add(tok)
    await db.commit()
    await db.refresh(tok)

    return TunnelTokenResponse(
        id=tok.id, name=tok.name, token_prefix=tok.token_prefix,
        server_id=tok.server_id, is_active=tok.is_active,
        last_connected_at=tok.last_connected_at,
        created_at=tok.created_at, full_token=raw,
        is_connected=tunnel_registry.is_connected(tok.server_id),
    )


@router.get("/tokens", response_model=list[TunnelTokenResponse])
async def list_tokens(
    server_id: Optional[int] = None,
    current=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(TunnelToken).order_by(TunnelToken.created_at.desc())
    if server_id:
        q = q.where(TunnelToken.server_id == server_id)
    tokens = (await db.execute(q)).scalars().all()
    return [
        TunnelTokenResponse(
            id=t.id, name=t.name, token_prefix=t.token_prefix,
            server_id=t.server_id, is_active=t.is_active,
            last_connected_at=t.last_connected_at,
            created_at=t.created_at,
            is_connected=tunnel_registry.is_connected(t.server_id),
        )
        for t in tokens
    ]


@router.delete("/tokens/{token_id}", status_code=204)
async def delete_token(
    token_id: int,
    current=Depends(PermissionChecker(["mcp_server:update"])),
    db: AsyncSession = Depends(get_db),
):
    tok = (await db.execute(select(TunnelToken).where(TunnelToken.id == token_id))).scalar_one_or_none()
    if not tok:
        raise HTTPException(404)
    await tunnel_registry.unregister(tok.server_id)
    await db.delete(tok)
    await db.commit()


@router.get("/connections")
async def list_connections(current=Depends(get_current_user)):
    return tunnel_registry.list_connections()


# ------- ES / Generic HTTP Reverse Proxy via Tunnel -------

es_proxy_router = APIRouter(tags=["tunnel"])

# Hop-by-hop headers that must not be forwarded.
_HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length",
}


@es_proxy_router.api_route(
    "/es-proxy/{namespace}/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
)
async def es_proxy(
    namespace: str,
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Generic HTTP reverse proxy to a private backend (e.g. ElasticSearch) via tunnel.

    A MCP server running in AgentCore (PUBLIC network) hits this endpoint; the request
    is forwarded over the reverse WebSocket tunnel to the private-network tunnel-agent
    (running in `http-proxy` mode), which calls the real backend and returns the response.

    Auth: Authorization: Bearer <api_key> using registry API keys.
    """
    from domain.gateway.auth import authenticate_gateway_request

    await authenticate_gateway_request(request, db)

    server = (await db.execute(
        select(McpServer).where(McpServer.namespace == namespace)
    )).scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail=f"MCP server '{namespace}' not found")

    conn = tunnel_registry.get(server.id)
    if not conn:
        raise HTTPException(status_code=503, detail=f"Tunnel agent for '{namespace}' is offline")

    body_bytes = await request.body()
    fwd_headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in _HOP_BY_HOP and k.lower() != "authorization"
    }

    payload = {
        "method": request.method,
        "path": "/" + path,
        "query": str(request.url.query or ""),
        "headers": fwd_headers,
        # body is base64-encoded to safely carry binary/utf8 over JSON
        "body_b64": base64.b64encode(body_bytes).decode("ascii") if body_bytes else "",
    }

    try:
        resp = await conn.send(payload, envelope_type="http_request", timeout=60.0)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Tunnel backend timed out")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tunnel error: {e}")

    if resp.get("error"):
        raise HTTPException(status_code=502, detail=f"Tunnel agent error: {resp['error']}")

    status_code = int(resp.get("status", 502))
    resp_body = base64.b64decode(resp.get("body_b64", "")) if resp.get("body_b64") else b""
    resp_headers = {
        k: v for k, v in (resp.get("headers", {}) or {}).items()
        if k.lower() not in _HOP_BY_HOP
    }
    media_type = resp_headers.pop("content-type", None) or resp_headers.pop("Content-Type", None)

    return Response(
        content=resp_body,
        status_code=status_code,
        headers=resp_headers,
        media_type=media_type,
    )


# ------- WebSocket Endpoint -------

@ws_router.websocket("/tunnel/connect")
async def tunnel_connect(ws: WebSocket, token: str = Query(...)):
    """Tunnel agent connects here via WebSocket with an auth token.

    Protocol:
        Server -> Agent: {"type": "request", "req_id": "...", "payload": <json-rpc>}
        Agent  -> Server: {"type": "response", "req_id": "...", "payload": <json-rpc>}
        Agent  -> Server: {"type": "ping"} / Server pong
    """
    await ws.accept()

    token_hash = _hash_token(token)
    async with async_session() as db:
        tok = (await db.execute(
            select(TunnelToken).where(TunnelToken.token_hash == token_hash, TunnelToken.is_active == True)
        )).scalar_one_or_none()
        if not tok:
            await ws.send_text(json.dumps({"type": "error", "error": "Invalid tunnel token"}))
            await ws.close(code=4001)
            return

        server = (await db.execute(select(McpServer).where(McpServer.id == tok.server_id))).scalar_one_or_none()
        if not server:
            await ws.send_text(json.dumps({"type": "error", "error": "Server not found"}))
            await ws.close(code=4004)
            return

        tok.last_connected_at = datetime.datetime.utcnow()
        await db.commit()

    # Read hello message with agent info
    try:
        hello_raw = await asyncio.wait_for(ws.receive_text(), timeout=5.0)
        hello = json.loads(hello_raw)
        agent_info = hello.get("agent_info", {})
    except Exception as e:
        await ws.close(code=4002)
        return

    conn = TunnelConnection(server.id, server.namespace, ws, agent_info)
    await tunnel_registry.register(conn)

    await ws.send_text(json.dumps({
        "type": "welcome",
        "server_id": server.id,
        "namespace": server.namespace,
        "message": f"Tunnel established for {server.namespace}",
    }))

    logger.info("Tunnel agent connected: server=%s agent=%s", server.namespace, agent_info)

    try:
        while True:
            raw = await ws.receive_text()
            try:
                envelope = json.loads(raw)
            except json.JSONDecodeError:
                continue

            etype = envelope.get("type")
            if etype == "response":
                conn.handle_response(envelope)
            elif etype == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
            elif etype == "register":
                pass
    except WebSocketDisconnect:
        logger.info("Tunnel agent disconnected: server=%s", server.namespace)
    except Exception as e:
        logger.warning("Tunnel error: %s", e)
    finally:
        await tunnel_registry.unregister(server.id)
