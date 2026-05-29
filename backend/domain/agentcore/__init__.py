"""AgentCore adapter layer - bridges Agent-Arms with AWS Bedrock AgentCore services."""
from core import settings


def is_agentcore_enabled() -> bool:
    return settings.AGENTCORE_ENABLED
