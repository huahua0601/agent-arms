"""AgentArms — unified backend entry point."""
import uuid
import logging
import time
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis

from core import settings
from core.database import engine, async_session, Base

from domain.auth.models import *      # noqa: F401, F403
from domain.registry.models import *  # noqa: F401, F403
from domain.runtime.models import *   # noqa: F401, F403
from domain.audit.models import *     # noqa: F401, F403
from domain.skill.models import *     # noqa: F401, F403
from domain.gateway.models import *   # noqa: F401, F403
from domain.team.models import *      # noqa: F401, F403
from domain.review.models import *    # noqa: F401, F403
from domain.tunnel.models import *    # noqa: F401, F403

from domain.auth.router import router as auth_router
from domain.auth.oauth import router as oauth_router
from domain.registry.router import router as registry_router
from domain.runtime.router import router as runtime_router
from domain.audit.router import router as audit_router
from domain.skill.router import router as skill_router
from domain.skill.public_api import router as public_registry_router
from domain.registry.public_api import router as public_mcp_router
from domain.gateway.router import router as gateway_proxy_router
from domain.gateway.service import stats_router as gateway_stats_router
from domain.team.router import router as team_router
from domain.review.router import router as review_router
from domain.cli.router import router as cli_router
from domain.registry.rest_to_mcp import router as rest_to_mcp_router
from domain.tunnel.router import router as tunnel_router, ws_router as tunnel_ws_router
from domain.memory.router import router as memory_router
from domain.agentcore.identity_router import router as identity_router
from domain.auth.service import seed_data
from domain.registry.seed_aiops import seed_aiops_servers
from domain.audit.service import create_log

logger = logging.getLogger(__name__)

redis_client: aioredis.Redis = None


def _run_alembic_sync():
    """Run Alembic upgrade as a subprocess to avoid event loop blocking."""
    import subprocess
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True, text=True, timeout=30,
        env={**__import__("os").environ, "SYNC_DATABASE_URL": settings.SYNC_DATABASE_URL},
    )
    if result.stdout:
        logger.info(result.stdout.strip())
    if result.returncode != 0:
        logger.error("Alembic failed: %s", result.stderr)
    else:
        logger.info("Alembic upgrade complete")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client

    await asyncio.to_thread(_run_alembic_sync)
    logger.info("DB migration complete")

    async with async_session() as db:
        await seed_data(db)
    logger.info("Seed data initialized")

    async with async_session() as db:
        await seed_aiops_servers(db)
    logger.info("AIOps MCP servers registered")

    # Initialize AgentCore Observability (OTEL)
    from domain.agentcore.observability_adapter import init_observability
    init_observability()
    logger.info("Observability initialized")

    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    yield
    await redis_client.close()
    await engine.dispose()


app = FastAPI(title="AgentArms", version="1.0.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def rate_limit_and_audit(request: Request, call_next):
    trace_id = str(uuid.uuid4())

    if request.url.path.startswith("/api/") and redis_client:
        ip = request.client.host if request.client else "unknown"
        key = f"rl:{ip}:{int(time.time()) // 60}"
        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, 120)
        results = await pipe.execute()
        if results[0] > settings.RATE_LIMIT_PER_MINUTE:
            return Response(content='{"detail":"Rate limit exceeded"}', status_code=429, media_type="application/json")

    response = await call_next(request)
    response.headers["X-Trace-Id"] = trace_id

    if request.url.path.startswith("/api/") and request.url.path not in ("/api/auth/login", "/api/auth/refresh", "/health") and not request.url.path.startswith("/gateway/"):
        try:
            async with async_session() as db:
                await create_log(
                    db,
                    action=f"{request.method} {request.url.path}",
                    resource_type="api_request",
                    resource_id=trace_id,
                    detail={"method": request.method, "path": str(request.url.path), "status": response.status_code},
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    status="success" if response.status_code < 400 else "failure",
                )
        except Exception:
            pass

    return response


app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(registry_router)
app.include_router(runtime_router)
app.include_router(audit_router)
app.include_router(skill_router)
app.include_router(public_registry_router)
app.include_router(public_mcp_router)
app.include_router(gateway_proxy_router)
app.include_router(gateway_stats_router)
app.include_router(team_router)
app.include_router(review_router)
app.include_router(cli_router)
app.include_router(rest_to_mcp_router)
app.include_router(tunnel_router)
app.include_router(tunnel_ws_router)
app.include_router(memory_router)
app.include_router(identity_router)


@app.get("/health")
async def health():
    from domain.agentcore import is_agentcore_enabled
    return {
        "status": "ok",
        "service": "agent-arms",
        "agentcore_enabled": is_agentcore_enabled(),
    }
