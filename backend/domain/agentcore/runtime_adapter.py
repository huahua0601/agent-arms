"""AgentCore Runtime Adapter - deploys and manages AI agents/tools as serverless containers.

AgentCore Runtime provides session-isolated, serverless execution environments
with fast cold starts, supporting any framework and model.
"""
import logging
from typing import Any, Optional

import boto3

from core import settings

logger = logging.getLogger(__name__)


class RuntimeAdapter:
    """Manages agent/tool deployments through AgentCore Runtime."""

    def __init__(self):
        self._client = boto3.client(
            "bedrock-agentcore",
            region_name=settings.AWS_REGION,
        )

    async def create_runtime(
        self,
        name: str,
        image_uri: str,
        environment: Optional[dict] = None,
        cpu: str = "0.5",
        memory: str = "512",
        network_mode: str = "PUBLIC",
    ) -> dict:
        """Create an AgentCore Runtime from a container image.

        This pushes the agent/tool to AWS and creates a managed runtime environment.
        """
        try:
            response = self._client.create_agent_runtime(
                agentRuntimeName=name,
                containerConfig={
                    "imageUri": image_uri,
                    "environmentVariables": environment or {},
                },
                networkMode=network_mode,
            )
            runtime_id = response.get("agentRuntimeId")
            logger.info(f"Created AgentCore Runtime '{name}': {runtime_id}")
            return {
                "runtime_id": runtime_id,
                "status": response.get("status", "CREATING"),
                "arn": response.get("agentRuntimeArn", ""),
            }
        except Exception as e:
            logger.error(f"Failed to create runtime '{name}': {e}")
            return {"error": str(e), "status": "FAILED"}

    async def create_endpoint(self, runtime_id: str, name: str) -> dict:
        """Create an endpoint for an existing runtime, making it accessible."""
        try:
            response = self._client.create_agent_runtime_endpoint(
                agentRuntimeId=runtime_id,
                name=name,
            )
            endpoint_id = response.get("endpointId")
            logger.info(f"Created endpoint '{name}' for runtime {runtime_id}: {endpoint_id}")
            return {
                "endpoint_id": endpoint_id,
                "endpoint_url": response.get("endpointUrl", ""),
                "status": response.get("status", "CREATING"),
            }
        except Exception as e:
            logger.error(f"Failed to create endpoint for runtime {runtime_id}: {e}")
            return {"error": str(e), "status": "FAILED"}

    async def get_runtime(self, runtime_id: str) -> dict:
        """Get the status and details of a runtime."""
        try:
            response = self._client.get_agent_runtime(agentRuntimeId=runtime_id)
            return {
                "runtime_id": runtime_id,
                "name": response.get("agentRuntimeName"),
                "status": response.get("status"),
                "arn": response.get("agentRuntimeArn"),
                "created_at": str(response.get("createdAt", "")),
            }
        except Exception as e:
            logger.error(f"Failed to get runtime {runtime_id}: {e}")
            return {"error": str(e)}

    async def list_runtimes(self) -> list[dict]:
        """List all AgentCore Runtimes."""
        try:
            response = self._client.list_agent_runtimes()
            return [
                {
                    "runtime_id": r.get("agentRuntimeId"),
                    "name": r.get("agentRuntimeName"),
                    "status": r.get("status"),
                }
                for r in response.get("agentRuntimes", [])
            ]
        except Exception as e:
            logger.error(f"Failed to list runtimes: {e}")
            return []

    async def delete_runtime(self, runtime_id: str) -> bool:
        """Delete a runtime and its resources."""
        try:
            self._client.delete_agent_runtime(agentRuntimeId=runtime_id)
            logger.info(f"Deleted AgentCore Runtime: {runtime_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete runtime {runtime_id}: {e}")
            return False

    async def get_endpoint(self, runtime_id: str, endpoint_id: str) -> dict:
        """Get endpoint details including URL and status."""
        try:
            response = self._client.get_agent_runtime_endpoint(
                agentRuntimeId=runtime_id,
                endpointId=endpoint_id,
            )
            return {
                "endpoint_id": endpoint_id,
                "endpoint_url": response.get("endpointUrl", ""),
                "status": response.get("status"),
            }
        except Exception as e:
            logger.error(f"Failed to get endpoint {endpoint_id}: {e}")
            return {"error": str(e)}

    async def invoke_endpoint(self, endpoint_url: str, payload: dict, session_id: Optional[str] = None) -> dict:
        """Invoke a runtime endpoint with optional session isolation."""
        import httpx
        headers = {"Content-Type": "application/json"}
        if session_id:
            headers["X-Session-Id"] = session_id

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(endpoint_url, json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()


_runtime_adapter: Optional[RuntimeAdapter] = None


def get_runtime_adapter() -> RuntimeAdapter:
    global _runtime_adapter
    if _runtime_adapter is None:
        _runtime_adapter = RuntimeAdapter()
    return _runtime_adapter
