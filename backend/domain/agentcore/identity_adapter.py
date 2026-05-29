"""AgentCore Identity Adapter - manages agent workload identities and OAuth token vaults.

AgentCore Identity provides:
- Workload Identity: unique agent identifiers for secure service-to-service auth
- Token Vault: secure storage for OAuth tokens (user consent flow) and API keys
- OAuth Proxy: enables agents to access third-party services on behalf of users
"""
import logging
from typing import Any, Optional

import boto3

from core import settings

logger = logging.getLogger(__name__)


class IdentityAdapter:
    """Manages agent identities and credentials through AgentCore Identity."""

    def __init__(self):
        self._client = boto3.client(
            "bedrock-agentcore",
            region_name=settings.AWS_REGION,
        )
        self._workload_id = settings.AGENTCORE_IDENTITY_WORKLOAD_ID

    async def create_workload_identity(self, name: str, description: str = "") -> dict:
        """Create a workload identity for an agent.

        A workload identity uniquely identifies the agent in the AgentCore Identity system
        and is used for authentication when calling tools.
        """
        try:
            response = self._client.create_workload_identity(
                name=name,
                description=description,
            )
            workload_id = response.get("workloadIdentityId")
            logger.info(f"Created workload identity '{name}': {workload_id}")
            return {
                "workload_id": workload_id,
                "name": name,
                "arn": response.get("workloadIdentityArn", ""),
            }
        except Exception as e:
            logger.error(f"Failed to create workload identity '{name}': {e}")
            return {"error": str(e)}

    async def register_oauth_tool(
        self,
        tool_name: str,
        oauth_config: dict,
    ) -> dict:
        """Register an OAuth-protected tool with AgentCore Identity.

        The oauth_config should contain:
        - client_id: OAuth client ID
        - client_secret: OAuth client secret
        - authorization_url: OAuth authorization endpoint
        - token_url: OAuth token endpoint
        - scopes: list of OAuth scopes
        """
        try:
            response = self._client.create_oauth_tool_credential(
                workloadIdentityId=self._workload_id,
                toolName=tool_name,
                oauthConfig={
                    "clientId": oauth_config["client_id"],
                    "clientSecret": oauth_config["client_secret"],
                    "authorizationUrl": oauth_config["authorization_url"],
                    "tokenUrl": oauth_config["token_url"],
                    "scopes": oauth_config.get("scopes", []),
                },
            )
            logger.info(f"Registered OAuth tool '{tool_name}' with Identity")
            return {"credential_id": response.get("credentialId"), "status": "registered"}
        except Exception as e:
            logger.error(f"Failed to register OAuth tool '{tool_name}': {e}")
            return {"error": str(e)}

    async def store_api_key(self, tool_name: str, api_key: str) -> dict:
        """Store an API key in the secure token vault for a tool."""
        try:
            response = self._client.store_tool_credential(
                workloadIdentityId=self._workload_id,
                toolName=tool_name,
                credentialType="API_KEY",
                credentialValue=api_key,
            )
            logger.info(f"Stored API key for tool '{tool_name}'")
            return {"credential_id": response.get("credentialId"), "status": "stored"}
        except Exception as e:
            logger.error(f"Failed to store API key for '{tool_name}': {e}")
            return {"error": str(e)}

    async def get_tool_credential(self, tool_name: str) -> Optional[str]:
        """Retrieve a tool's credential from the token vault."""
        try:
            response = self._client.get_tool_credential(
                workloadIdentityId=self._workload_id,
                toolName=tool_name,
            )
            return response.get("credentialValue")
        except Exception as e:
            logger.error(f"Failed to retrieve credential for '{tool_name}': {e}")
            return None

    async def get_user_authorization_url(self, tool_name: str, user_id: str, callback_url: str) -> Optional[str]:
        """Get OAuth authorization URL for user consent flow.

        When a user needs to grant an agent access to their resources on a
        third-party service, this generates the authorization URL.
        """
        try:
            response = self._client.get_authorization_url(
                workloadIdentityId=self._workload_id,
                toolName=tool_name,
                userId=user_id,
                callbackUrl=callback_url,
            )
            return response.get("authorizationUrl")
        except Exception as e:
            logger.error(f"Failed to get auth URL for tool '{tool_name}': {e}")
            return None

    async def list_tool_credentials(self) -> list[dict]:
        """List all registered tool credentials."""
        try:
            response = self._client.list_tool_credentials(
                workloadIdentityId=self._workload_id,
            )
            return [
                {
                    "tool_name": c.get("toolName"),
                    "credential_type": c.get("credentialType"),
                    "created_at": str(c.get("createdAt", "")),
                }
                for c in response.get("credentials", [])
            ]
        except Exception as e:
            logger.error(f"Failed to list tool credentials: {e}")
            return []


_identity_adapter: Optional[IdentityAdapter] = None


def get_identity_adapter() -> IdentityAdapter:
    global _identity_adapter
    if _identity_adapter is None:
        _identity_adapter = IdentityAdapter()
    return _identity_adapter
