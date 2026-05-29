"""Memory management router - exposes AgentCore Memory via REST API.

Provides endpoints for managing agent memory stores, session context,
and long-term semantic memory.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

from middleware.auth import PermissionChecker
from domain.agentcore import is_agentcore_enabled
from domain.agentcore.memory_adapter import get_memory_adapter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/memory", tags=["Memory"])


class MemoryStoreCreate(BaseModel):
    name: str
    strategies: List[str] = ["semantic"]


class MemoryEventCreate(BaseModel):
    session_id: str
    role: str
    content: str


class MemorySearchQuery(BaseModel):
    query: str
    max_results: int = 5


@router.post("/stores", status_code=201)
async def create_memory_store(
    body: MemoryStoreCreate,
    current=Depends(PermissionChecker(["mcp_server:create"])),
):
    """Create a new memory store for an agent."""
    if not is_agentcore_enabled():
        raise HTTPException(status_code=503, detail="AgentCore Memory not enabled. Set AGENTCORE_ENABLED=true.")

    adapter = get_memory_adapter()
    result = await adapter.create_memory_store(body.name, body.strategies)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.get("/stores")
async def list_memory_stores(
    current=Depends(PermissionChecker(["mcp_server:read"])),
):
    """List all memory stores."""
    if not is_agentcore_enabled():
        raise HTTPException(status_code=503, detail="AgentCore Memory not enabled")

    adapter = get_memory_adapter()
    return await adapter.list_memory_stores()


@router.delete("/stores/{memory_id}")
async def delete_memory_store(
    memory_id: str,
    current=Depends(PermissionChecker(["mcp_server:delete"])),
):
    """Delete a memory store."""
    if not is_agentcore_enabled():
        raise HTTPException(status_code=503, detail="AgentCore Memory not enabled")

    adapter = get_memory_adapter()
    success = await adapter.delete_memory_store(memory_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete memory store")
    return {"status": "deleted"}


@router.post("/stores/{memory_id}/events")
async def add_memory_event(
    memory_id: str,
    body: MemoryEventCreate,
    current=Depends(PermissionChecker(["mcp_server:create"])),
):
    """Add a conversation event to session memory."""
    if not is_agentcore_enabled():
        raise HTTPException(status_code=503, detail="AgentCore Memory not enabled")

    adapter = get_memory_adapter()
    result = await adapter.add_session_event(memory_id, body.session_id, body.role, body.content)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.get("/stores/{memory_id}/sessions/{session_id}")
async def get_session_context(
    memory_id: str,
    session_id: str,
    max_events: int = Query(default=20, ge=1, le=100),
    current=Depends(PermissionChecker(["mcp_server:read"])),
):
    """Retrieve short-term conversation context for a session."""
    if not is_agentcore_enabled():
        raise HTTPException(status_code=503, detail="AgentCore Memory not enabled")

    adapter = get_memory_adapter()
    return await adapter.get_session_context(memory_id, session_id, max_events)


@router.post("/stores/{memory_id}/search")
async def search_memory(
    memory_id: str,
    body: MemorySearchQuery,
    current=Depends(PermissionChecker(["mcp_server:read"])),
):
    """Search long-term semantic memory for relevant past experiences."""
    if not is_agentcore_enabled():
        raise HTTPException(status_code=503, detail="AgentCore Memory not enabled")

    adapter = get_memory_adapter()
    return await adapter.search_long_term_memory(memory_id, body.query, body.max_results)
