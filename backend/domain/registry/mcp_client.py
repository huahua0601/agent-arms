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


async def _get_runtime_arn(server_id: int) -> Optional[str]:
    """Look up the AgentCore Runtime ARN for a managed server."""
    from sqlalchemy import select
    from core.database import async_session
    from domain.runtime.models import Instance
    from core import settings as _settings

    async with async_session() as db:
        result = await db.execute(
            select(Instance).where(
                Instance.server_id == server_id,
                Instance.status == "running",
                Instance.runtime_type == "agentcore",
            )
        )
        inst = result.scalar_one_or_none()
        if inst and inst.container_id:
            region = _settings.AWS_REGION
            account = "715371302281"
            return f"arn:aws:bedrock-agentcore:{region}:{account}:runtime/{inst.container_id}"
    return None


async def _invoke_agentcore(runtime_arn: str, rpc_body: dict, session_id: Optional[str] = None) -> tuple[Optional[dict], Optional[str]]:
    """Invoke AgentCore Runtime with an MCP JSON-RPC request. Returns (parsed_response, session_id)."""
    import asyncio
    import boto3
    from core import settings as _settings

    client = boto3.client("bedrock-agentcore", region_name=_settings.AWS_REGION)
    payload = json.dumps(rpc_body).encode()

    invoke_params = {
        "agentRuntimeArn": runtime_arn,
        "contentType": "application/json",
        "accept": "application/json, text/event-stream",
        "mcpProtocolVersion": "2024-11-05",
        "payload": payload,
    }
    if session_id:
        invoke_params["mcpSessionId"] = session_id

    resp = await asyncio.to_thread(lambda: client.invoke_agent_runtime(**invoke_params))
    resp_body = resp["response"].read().decode("utf-8", errors="replace")
    resp_headers = resp["ResponseMetadata"]["HTTPHeaders"]
    new_session_id = resp_headers.get("mcp-session-id", session_id)
    parsed = _parse_sse(resp_body)
    return parsed, new_session_id


async def health_check_via_agentcore(server_id: int) -> dict:
    """Health check a managed AgentCore MCP server via invoke_agent_runtime."""
    import time as _time
    start = _time.time()

    runtime_arn = await _get_runtime_arn(server_id)
    if not runtime_arn:
        return {"status": "offline", "latency_ms": None, "error": "No running AgentCore runtime found"}

    try:
        body, _ = await _invoke_agentcore(runtime_arn, {
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                       "clientInfo": {"name": "agenthub", "version": "1.0.0"}}
        })
        latency = round((_time.time() - start) * 1000, 2)

        if not body:
            return {"status": "unhealthy", "latency_ms": latency, "error": "Invalid response from runtime"}
        if "result" in body:
            return {"status": "healthy", "latency_ms": latency, "server_info": body["result"].get("serverInfo")}
        if "error" in body:
            msg = body["error"].get("message", str(body["error"])) if isinstance(body["error"], dict) else str(body["error"])
            return {"status": "unhealthy", "latency_ms": latency, "error": msg}
        return {"status": "unhealthy", "latency_ms": latency, "error": "Unexpected response"}

    except Exception as e:
        latency = round((_time.time() - start) * 1000, 2)
        return {"status": "error", "latency_ms": latency, "error": str(e)[:300]}


async def discover_capabilities_via_agentcore(server_id: int) -> dict:
    """Discover tools/resources/prompts from a managed AgentCore MCP server."""
    result = {"tools": [], "resources": [], "prompts": [], "server_info": None, "error": None}

    runtime_arn = await _get_runtime_arn(server_id)
    if not runtime_arn:
        result["error"] = "No running AgentCore runtime found"
        return result

    try:
        # Step 1: Initialize
        init_body, session_id = await _invoke_agentcore(runtime_arn, {
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {"protocolVersion": "2024-11-05",
                       "capabilities": {"tools": {}, "resources": {}, "prompts": {}},
                       "clientInfo": {"name": "agenthub", "version": "1.0.0"}}
        })

        if not init_body or "error" in (init_body or {}):
            err = init_body.get("error", "No response") if init_body else "No response"
            result["error"] = f"Initialize error: {err}"
            return result

        server_result = init_body.get("result", {})
        result["server_info"] = server_result.get("serverInfo")
        capabilities = server_result.get("capabilities", {})
        logger.info("AgentCore MCP init OK: server=%s, caps=%s", result["server_info"], list(capabilities.keys()))

        # Step 2: Send initialized notification
        try:
            await _invoke_agentcore(runtime_arn, {
                "jsonrpc": "2.0", "method": "notifications/initialized"
            }, session_id)
        except Exception:
            pass

        # Step 3: List tools
        if "tools" in capabilities:
            try:
                body, session_id = await _invoke_agentcore(runtime_arn, {
                    "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}
                }, session_id)
                if body and "result" in body:
                    result["tools"] = body["result"].get("tools", [])
                    logger.info("AgentCore: discovered %d tools", len(result["tools"]))
            except Exception as e:
                logger.warning("AgentCore tools/list failed: %s", e)

        # Step 4: List resources
        if "resources" in capabilities:
            try:
                body, session_id = await _invoke_agentcore(runtime_arn, {
                    "jsonrpc": "2.0", "id": 3, "method": "resources/list", "params": {}
                }, session_id)
                if body and "result" in body:
                    result["resources"] = body["result"].get("resources", [])
            except Exception as e:
                logger.warning("AgentCore resources/list failed: %s", e)

        # Step 5: List prompts
        if "prompts" in capabilities:
            try:
                body, session_id = await _invoke_agentcore(runtime_arn, {
                    "jsonrpc": "2.0", "id": 4, "method": "prompts/list", "params": {}
                }, session_id)
                if body and "result" in body:
                    result["prompts"] = body["result"].get("prompts", [])
            except Exception as e:
                logger.warning("AgentCore prompts/list failed: %s", e)

    except Exception as e:
        result["error"] = str(e)[:300]

    return result
