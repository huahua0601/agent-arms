"""AgentCore Observability Adapter - provides tracing, monitoring and debugging via OpenTelemetry.

AgentCore Observability offers:
- Step-by-step agent execution visualization
- Metadata tagging and custom scoring
- Trajectory inspection and debugging filters
- Integration with CloudWatch via OTEL-compatible telemetry
"""
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, Optional

from core import settings

logger = logging.getLogger(__name__)

_tracer = None
_meter = None


def init_observability():
    """Initialize OpenTelemetry tracing and metrics for AgentCore Observability.

    Should be called once during application startup.
    """
    global _tracer, _meter

    if not settings.AGENTCORE_OBSERVABILITY_ENABLED:
        logger.info("AgentCore Observability disabled, using no-op tracer")
        return

    try:
        from opentelemetry import trace, metrics
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

        resource = Resource.create({
            "service.name": "agent-arms",
            "service.version": "1.0.0",
            "deployment.environment": "production",
        })

        tracer_provider = TracerProvider(resource=resource)
        otlp_exporter = OTLPSpanExporter()
        tracer_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        trace.set_tracer_provider(tracer_provider)
        _tracer = trace.get_tracer("agent-arms")

        meter_provider = MeterProvider(resource=resource)
        metrics.set_meter_provider(meter_provider)
        _meter = metrics.get_meter("agent-arms")

        logger.info("AgentCore Observability (OTEL) initialized")
    except ImportError:
        logger.warning("OpenTelemetry packages not installed, observability disabled")
    except Exception as e:
        logger.error(f"Failed to initialize observability: {e}")


def get_tracer():
    """Get the OTEL tracer instance (may be None if not initialized)."""
    return _tracer


def get_meter():
    """Get the OTEL meter instance (may be None if not initialized)."""
    return _meter


@asynccontextmanager
async def trace_agent_execution(agent_name: str, session_id: str, **attributes):
    """Context manager to trace an agent's execution lifecycle.

    Usage:
        async with trace_agent_execution("rca-agent", session_id="abc123") as span:
            result = await run_analysis(...)
            span.set_attribute("tools_called", 5)
    """
    if _tracer is None:
        yield NoOpSpan()
        return

    with _tracer.start_as_current_span(
        f"agent.execute.{agent_name}",
        attributes={
            "agent.name": agent_name,
            "session.id": session_id,
            **{f"custom.{k}": str(v) for k, v in attributes.items()},
        },
    ) as span:
        start = time.time()
        try:
            yield span
            span.set_attribute("agent.status", "success")
        except Exception as e:
            span.set_attribute("agent.status", "error")
            span.set_attribute("agent.error", str(e))
            span.record_exception(e)
            raise
        finally:
            span.set_attribute("agent.duration_ms", int((time.time() - start) * 1000))


@asynccontextmanager
async def trace_tool_call(tool_name: str, server_namespace: str, **attributes):
    """Context manager to trace individual tool calls within an agent execution."""
    if _tracer is None:
        yield NoOpSpan()
        return

    with _tracer.start_as_current_span(
        f"tool.call.{tool_name}",
        attributes={
            "tool.name": tool_name,
            "tool.server": server_namespace,
            **{f"custom.{k}": str(v) for k, v in attributes.items()},
        },
    ) as span:
        start = time.time()
        try:
            yield span
            span.set_attribute("tool.status", "success")
        except Exception as e:
            span.set_attribute("tool.status", "error")
            span.record_exception(e)
            raise
        finally:
            span.set_attribute("tool.duration_ms", int((time.time() - start) * 1000))


class NoOpSpan:
    """No-op span for when tracing is disabled."""

    def set_attribute(self, key: str, value: Any):
        pass

    def record_exception(self, exception: Exception):
        pass

    def add_event(self, name: str, attributes: Optional[dict] = None):
        pass
