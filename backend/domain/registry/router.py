"""Registry API router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from middleware.auth import get_current_user, PermissionChecker
from middleware import PaginatedResponse
from domain.registry import schemas as S, service as svc

router = APIRouter(prefix="/api", tags=["registry"])

@router.post("/servers", response_model=S.McpServerResponse, status_code=201)
async def create_server(body: S.McpServerCreate, current=Depends(PermissionChecker(["mcp_server:create"])), db: AsyncSession = Depends(get_db)):
    return await svc.create_server(db, body.model_dump(), owner_id=int(current["sub"]), is_superadmin=current.get("is_superadmin", False))

@router.get("/servers", response_model=PaginatedResponse[S.McpServerListItem])
async def list_servers(page: int = 1, page_size: int = 20, search: Optional[str] = None, tags: Optional[str] = Query(None), source_type: Optional[str] = None, status: Optional[str] = None, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tag_list = [t.strip() for t in tags.split(",")] if tags else None
    items, total = await svc.list_servers(db, page, page_size, search, tag_list, source_type, status)
    result = []
    for s in items:
        item = S.McpServerListItem.model_validate(s)
        item.tool_count = len(s.tools) if s.tools else 0
        item.resource_count = len(s.resources) if s.resources else 0
        item.prompt_count = len(s.prompts) if s.prompts else 0
        result.append(item)
    return PaginatedResponse(items=result, total=total, page=page, page_size=page_size, pages=(total + page_size - 1) // page_size if total else 0)

@router.get("/servers/{server_id}", response_model=S.McpServerResponse)
async def get_server(server_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await svc.get_server(db, server_id)
    if not s: raise HTTPException(404)
    return s

@router.put("/servers/{server_id}", response_model=S.McpServerResponse)
async def update_server(server_id: int, body: S.McpServerUpdate, current=Depends(PermissionChecker(["mcp_server:update"])), db: AsyncSession = Depends(get_db)):
    s = await svc.update_server(db, server_id, body.model_dump(exclude_unset=True), int(current["sub"]), current.get("is_superadmin", False))
    if not s: raise HTTPException(404)
    return s

@router.delete("/servers/{server_id}", status_code=204)
async def delete_server(server_id: int, current=Depends(PermissionChecker(["mcp_server:delete"])), db: AsyncSession = Depends(get_db)):
    if not await svc.delete_server(db, server_id, int(current["sub"]), current.get("is_superadmin", False)): raise HTTPException(404)

@router.get("/servers/{server_id}/tools", response_model=list[S.McpToolResponse])
async def get_tools(server_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await svc.get_server(db, server_id)
    if not s: raise HTTPException(404)
    return s.tools

@router.get("/servers/{server_id}/resources", response_model=list[S.McpResourceResponse])
async def get_resources(server_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await svc.get_server(db, server_id)
    if not s: raise HTTPException(404)
    return s.resources

@router.get("/servers/{server_id}/versions", response_model=list[S.ServerVersionResponse])
async def get_versions(server_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.get_versions(db, server_id)

@router.post("/servers/{server_id}/versions", response_model=S.ServerVersionResponse, status_code=201)
async def create_version(server_id: int, body: S.VersionCreate, current=Depends(PermissionChecker(["mcp_server:update"])), db: AsyncSession = Depends(get_db)):
    ver = await svc.create_version(db, server_id, body.model_dump())
    if not ver: raise HTTPException(404)
    return ver

@router.post("/servers/{server_id}/discover")
async def discover(server_id: int, current=Depends(PermissionChecker(["mcp_server:update"])), db: AsyncSession = Depends(get_db)):
    """Auto-discover tools/resources/prompts by connecting to the MCP server."""
    from domain.registry.mcp_client import discover_capabilities
    server = await svc.get_server(db, server_id)
    if not server: raise HTTPException(404)
    if not server.endpoint_url: raise HTTPException(400, "No endpoint URL configured")
    caps = await discover_capabilities(server.endpoint_url, server.auth_type, server.auth_config)
    if caps.get("error"):
        return {"success": False, "error": caps["error"], "tools": 0, "resources": 0, "prompts": 0}
    result = await svc.discover_server(db, server_id, caps["tools"], caps["resources"], caps["prompts"])
    if not result: raise HTTPException(500)
    return {"success": True, "tools": len(caps["tools"]), "resources": len(caps["resources"]), "prompts": len(caps["prompts"])}


@router.post("/servers/{server_id}/health")
async def check_health(server_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Health check — uses MCP handshake for native MCP servers, HTTP GET for OpenAPI servers."""
    from domain.registry.mcp_client import health_check, _resolve_url
    import datetime, time as _time
    server = await svc.get_server(db, server_id)
    if not server: raise HTTPException(404)
    if not server.endpoint_url: raise HTTPException(400, "No endpoint URL configured")

    if server.source_type == "openapi":
        import httpx
        url = _resolve_url(server.endpoint_url.rstrip("/"))
        start = _time.time()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url + "/openapi.json")
                latency = round((_time.time() - start) * 1000, 2)
                if resp.status_code < 400:
                    result = {"status": "healthy", "latency_ms": latency}
                else:
                    result = {"status": "unhealthy", "latency_ms": latency, "error": f"HTTP {resp.status_code}"}
        except httpx.ConnectError:
            result = {"status": "offline", "latency_ms": None, "error": "Connection refused"}
        except httpx.TimeoutException:
            result = {"status": "timeout", "latency_ms": None, "error": "Timeout"}
        except Exception as e:
            result = {"status": "error", "latency_ms": None, "error": str(e)}
    else:
        result = await health_check(server.endpoint_url, server.auth_type, server.auth_config)

    server.health_status = result["status"]
    server.last_health_check = datetime.datetime.utcnow()
    server.health_latency_ms = result.get("latency_ms")
    await db.commit()
    return result

@router.get("/tags", response_model=list[S.TagResponse])
async def list_tags(current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.list_tags(db)


@router.post("/servers/{server_id}/openapi")
async def upload_openapi(server_id: int, body: dict, current=Depends(PermissionChecker(["mcp_server:update"])), db: AsyncSession = Depends(get_db)):
    """Upload/paste an OpenAPI spec and convert it to MCP tools.

    Body: {"spec": <OpenAPI JSON object or string>}
    """
    from domain.registry.openapi_converter import parse_openapi, openapi_to_mcp_tools
    from sqlalchemy import select as sa_select

    server = await svc.get_server(db, server_id)
    if not server:
        raise HTTPException(404)

    spec_input = body.get("spec")
    if not spec_input:
        raise HTTPException(400, "Missing 'spec' field")

    try:
        if isinstance(spec_input, str):
            parsed = openapi_to_mcp_tools(spec_input)
            spec_dict = __import__("json").loads(spec_input) if spec_input.strip().startswith("{") else __import__("yaml").safe_load(spec_input)
        else:
            parsed = parse_openapi(spec_input)
            spec_dict = spec_input
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(400, f"Failed to parse OpenAPI spec: {e}")

    server.openapi_spec = spec_dict
    server.source_type = "openapi"
    if not server.endpoint_url and parsed.get("base_url"):
        server.endpoint_url = parsed["base_url"]

    from domain.registry.models import McpTool
    existing_tools = list(server.tools or [])
    for t in existing_tools:
        await db.delete(t)
    await db.flush()

    for tool_def in parsed.get("tools", []):
        tool = McpTool(
            server_id=server.id,
            name=tool_def["name"],
            description=tool_def.get("description", ""),
            input_schema=tool_def.get("input_schema"),
        )
        db.add(tool)

    await db.commit()
    await db.refresh(server)

    return {
        "success": True,
        "server_info": parsed.get("server_info"),
        "base_url": parsed.get("base_url"),
        "tools_count": len(parsed.get("tools", [])),
        "tools": [{"name": t["name"], "description": t.get("description", "")} for t in parsed.get("tools", [])],
        "mcp_endpoint": f"/mcp/rest/{server.id}",
    }


@router.get("/servers/{server_id}/openapi")
async def get_openapi(server_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get the stored OpenAPI spec for a server."""
    server = await svc.get_server(db, server_id)
    if not server:
        raise HTTPException(404)
    if not server.openapi_spec:
        raise HTTPException(404, "No OpenAPI spec configured")
    return {"spec": server.openapi_spec, "source_type": server.source_type}


@router.post("/openapi/preview")
async def preview_openapi(body: dict, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Preview OpenAPI-to-MCP conversion without saving. Body: {"spec": ...}"""
    from domain.registry.openapi_converter import parse_openapi, openapi_to_mcp_tools

    spec_input = body.get("spec")
    if not spec_input:
        raise HTTPException(400, "Missing 'spec' field")
    try:
        if isinstance(spec_input, str):
            parsed = openapi_to_mcp_tools(spec_input)
        else:
            parsed = parse_openapi(spec_input)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(400, f"Failed to parse: {e}")

    return {
        "server_info": parsed.get("server_info"),
        "base_url": parsed.get("base_url"),
        "tools": parsed.get("tools", []),
    }
