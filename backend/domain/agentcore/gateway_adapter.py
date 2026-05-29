"""AgentCore Gateway Adapter - registers tools and routes MCP requests through AWS AgentCore Gateway.

AgentCore Gateway transforms APIs, Lambda functions, and existing MCP servers into
unified MCP-compatible tool endpoints with built-in auth, throttling, and multitenancy.
"""
import logging
from typing import Any, Optional

import boto3
import httpx

from core import settings

logger = logging.getLogger(__name__)


class GatewayAdapter:
    """Manages MCP tools through AgentCore Gateway."""

    def __init__(self):
        self._client = boto3.client(
            "bedrock-agentcore",
            region_name=settings.AWS_REGION,
        )
        self._gateway_endpoint = settings.AGENTCORE_GATEWAY_ENDPOINT

    async def register_tool(
        self,
        tool_name: str,
        description: str,
        endpoint_url: str,
        auth_type: str = "none",
        auth_config: Optional[dict] = None,
    ) -> dict:
        """Register a tool (MCP server endpoint) with AgentCore Gateway.

        This makes the tool discoverable and accessible through the Gateway's
        unified MCP interface.
        """
        try:
            response = self._client.create_gateway_tool(
                gatewayEndpoint=self._gateway_endpoint,
                toolName=tool_name,
                description=description,
                targetEndpoint=endpoint_url,
                protocol="MCP",
                authType=auth_type,
                authConfig=auth_config or {},
            )
            logger.info(f"Registered tool '{tool_name}' with AgentCore Gateway: {response.get('toolArn')}")
            return {"tool_arn": response.get("toolArn"), "status": "registered"}
        except Exception as e:
            logger.error(f"Failed to register tool '{tool_name}' with AgentCore Gateway: {e}")
            return {"error": str(e), "status": "failed"}

    async def unregister_tool(self, tool_name: str) -> bool:
        """Remove a tool from AgentCore Gateway."""
        try:
            self._client.delete_gateway_tool(
                gatewayEndpoint=self._gateway_endpoint,
                toolName=tool_name,
            )
            logger.info(f"Unregistered tool '{tool_name}' from AgentCore Gateway")
            return True
        except Exception as e:
            logger.error(f"Failed to unregister tool '{tool_name}': {e}")
            return False

    async def invoke_tool(self, tool_name: str, arguments: dict) -> dict:
        """Invoke a tool through AgentCore Gateway using JSON-RPC over HTTP."""
        jsonrpc_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                self._gateway_endpoint,
                json=jsonrpc_request,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            return resp.json()

    async def list_tools(self) -> list[dict]:
        """List all tools registered in AgentCore Gateway."""
        try:
            response = self._client.list_gateway_tools(
                gatewayEndpoint=self._gateway_endpoint,
            )
            return response.get("tools", [])
        except Exception as e:
            logger.error(f"Failed to list Gateway tools: {e}")
            return []

    async def route_mcp_request(self, server_namespace: str, request_body: dict) -> dict:
        """Route an MCP JSON-RPC request through AgentCore Gateway to the target server."""
        headers = {
            "Content-Type": "application/json",
            "X-MCP-Server": server_namespace,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                self._gateway_endpoint,
                json=request_body,
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()


_gateway_adapter: Optional[GatewayAdapter] = None


def get_gateway_adapter() -> GatewayAdapter:
    global _gateway_adapter
    if _gateway_adapter is None:
        _gateway_adapter = GatewayAdapter()
    return _gateway_adapter
