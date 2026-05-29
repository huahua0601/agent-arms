"""AgentCore Memory Adapter - manages short-term and long-term agent memory.

AgentCore Memory provides:
- Short-term memory: multi-turn conversation context within a session
- Long-term memory: semantic/episodic memory that persists across sessions,
  enabling agents to learn from past interactions.
"""
import logging
from typing import Any, Optional

import boto3

from core import settings

logger = logging.getLogger(__name__)


class MemoryAdapter:
    """Manages agent memory through AgentCore Memory service."""

    def __init__(self):
        self._client = boto3.client(
            "bedrock-agentcore",
            region_name=settings.AWS_REGION,
        )
        self._namespace = settings.AGENTCORE_MEMORY_NAMESPACE

    async def create_memory_store(
        self,
        name: str,
        strategies: Optional[list[str]] = None,
    ) -> dict:
        """Create a memory store for an agent.

        Strategies can include: 'semantic', 'summarization', 'user_preference'
        """
        try:
            kwargs = {
                "name": name,
                "namespace": self._namespace,
            }
            if strategies:
                kwargs["memoryStrategies"] = [
                    {"strategyType": s} for s in strategies
                ]

            response = self._client.create_memory(
                **kwargs,
            )
            memory_id = response.get("memoryId")
            logger.info(f"Created memory store '{name}': {memory_id}")
            return {
                "memory_id": memory_id,
                "name": name,
                "status": response.get("status", "CREATING"),
            }
        except Exception as e:
            logger.error(f"Failed to create memory store '{name}': {e}")
            return {"error": str(e), "status": "FAILED"}

    async def add_session_event(
        self,
        memory_id: str,
        session_id: str,
        role: str,
        content: str,
    ) -> dict:
        """Add a conversation event to short-term memory."""
        try:
            response = self._client.add_memory_event(
                memoryId=memory_id,
                sessionId=session_id,
                event={
                    "role": role,
                    "content": content,
                },
            )
            return {"status": "added", "event_id": response.get("eventId")}
        except Exception as e:
            logger.error(f"Failed to add memory event: {e}")
            return {"error": str(e)}

    async def get_session_context(
        self,
        memory_id: str,
        session_id: str,
        max_events: int = 20,
    ) -> list[dict]:
        """Retrieve short-term conversation context for a session."""
        try:
            response = self._client.get_memory_session(
                memoryId=memory_id,
                sessionId=session_id,
                maxEvents=max_events,
            )
            return response.get("events", [])
        except Exception as e:
            logger.error(f"Failed to get session context: {e}")
            return []

    async def search_long_term_memory(
        self,
        memory_id: str,
        query: str,
        max_results: int = 5,
    ) -> list[dict]:
        """Search long-term semantic memory for relevant past experiences."""
        try:
            response = self._client.search_memory(
                memoryId=memory_id,
                query=query,
                maxResults=max_results,
            )
            return response.get("memories", [])
        except Exception as e:
            logger.error(f"Failed to search long-term memory: {e}")
            return []

    async def delete_memory_store(self, memory_id: str) -> bool:
        """Delete a memory store."""
        try:
            self._client.delete_memory(memoryId=memory_id)
            logger.info(f"Deleted memory store: {memory_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete memory store {memory_id}: {e}")
            return False

    async def list_memory_stores(self) -> list[dict]:
        """List all memory stores in the namespace."""
        try:
            response = self._client.list_memories(namespace=self._namespace)
            return [
                {
                    "memory_id": m.get("memoryId"),
                    "name": m.get("name"),
                    "status": m.get("status"),
                }
                for m in response.get("memories", [])
            ]
        except Exception as e:
            logger.error(f"Failed to list memory stores: {e}")
            return []


_memory_adapter: Optional[MemoryAdapter] = None


def get_memory_adapter() -> MemoryAdapter:
    global _memory_adapter
    if _memory_adapter is None:
        _memory_adapter = MemoryAdapter()
    return _memory_adapter
