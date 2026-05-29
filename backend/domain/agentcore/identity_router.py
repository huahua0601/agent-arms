"""Identity management router - integrates AgentCore Identity for tool credentials.

Provides endpoints for managing:
- Agent workload identities
- OAuth tool credentials (token vault)
- API key storage for third-party tools
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from middleware.auth import PermissionChecker
from domain.agentcore import is_agentcore_enabled
from domain.agentcore.identity_adapter import get_identity_adapter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/identity", tags=["Identity"])


class WorkloadIdentityCreate(BaseModel):
    name: str
    description: str = ""


class OAuthToolRegister(BaseModel):
    tool_name: str
    client_id: str
    client_secret: str
    authorization_url: str
    token_url: str
    scopes: List[str] = []


class ApiKeyStore(BaseModel):
    tool_name: str
    api_key: str


class UserAuthRequest(BaseModel):
    tool_name: str
    user_id: str
    callback_url: str


@router.post("/workloads", status_code=201)
async def create_workload_identity(
    body: WorkloadIdentityCreate,
    current=Depends(PermissionChecker(["mcp_server:create"])),
):
    """Create a workload identity for an agent."""
    if not is_agentcore_enabled():
        raise HTTPException(status_code=503, detail="AgentCore Identity not enabled")

    adapter = get_identity_adapter()
    result = await adapter.create_workload_identity(body.name, body.description)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/tools/oauth")
async def register_oauth_tool(
    body: OAuthToolRegister,
    current=Depends(PermissionChecker(["mcp_server:create"])),
):
    """Register an OAuth-protected tool's credentials in the token vault."""
    if not is_agentcore_enabled():
        raise HTTPException(status_code=503, detail="AgentCore Identity not enabled")

    adapter = get_identity_adapter()
    result = await adapter.register_oauth_tool(
        body.tool_name,
        {
            "client_id": body.client_id,
            "client_secret": body.client_secret,
            "authorization_url": body.authorization_url,
            "token_url": body.token_url,
            "scopes": body.scopes,
        },
    )
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/tools/api-key")
async def store_tool_api_key(
    body: ApiKeyStore,
    current=Depends(PermissionChecker(["api_key:create"])),
):
    """Store an API key for a tool in the secure token vault."""
    if not is_agentcore_enabled():
        raise HTTPException(status_code=503, detail="AgentCore Identity not enabled")

    adapter = get_identity_adapter()
    result = await adapter.store_api_key(body.tool_name, body.api_key)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.get("/tools/credentials")
async def list_tool_credentials(
    current=Depends(PermissionChecker(["api_key:read"])),
):
    """List all registered tool credentials (without revealing secrets)."""
    if not is_agentcore_enabled():
        raise HTTPException(status_code=503, detail="AgentCore Identity not enabled")

    adapter = get_identity_adapter()
    return await adapter.list_tool_credentials()


@router.post("/tools/authorize")
async def get_user_authorization_url(
    body: UserAuthRequest,
    current=Depends(PermissionChecker(["mcp_server:read"])),
):
    """Get OAuth authorization URL for user consent flow.

    Used when an agent needs user permission to access a third-party service.
    """
    if not is_agentcore_enabled():
        raise HTTPException(status_code=503, detail="AgentCore Identity not enabled")

    adapter = get_identity_adapter()
    url = await adapter.get_user_authorization_url(body.tool_name, body.user_id, body.callback_url)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to get authorization URL")
    return {"authorization_url": url}
