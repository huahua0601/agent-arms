"""Runtime service layer - supports both local Docker and AWS AgentCore Runtime.

When AGENTCORE_ENABLED=true, instances are deployed via AgentCore Runtime (serverless).
Otherwise, falls back to local Docker container management.
"""
import datetime
import random
import time
import asyncio
import logging
from typing import Optional, List

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from domain.runtime.models import Instance, HealthCheck
from domain.agentcore import is_agentcore_enabled

logger = logging.getLogger(__name__)


# --- Local Docker backend ---

async def _docker_run(image, name, port, cpu_limit, memory_limit, env_vars, command):
    def _run():
        import docker
        client = docker.from_env()
        mem = memory_limit.strip().lower()
        mem_bytes = int(float(mem[:-1]) * 1024 * 1024) if mem.endswith("m") else int(float(mem[:-1]) * 1024**3) if mem.endswith("g") else int(mem)
        kwargs = {"image": image, "name": name, "detach": True, "ports": {"8080/tcp": port}, "environment": env_vars or {},
                  "nano_cpus": int(float(cpu_limit) * 1e9), "mem_limit": mem_bytes, "restart_policy": {"Name": "unless-stopped"}, "labels": {"agenthub": "true"}}
        if command:
            kwargs["command"] = command
        try:
            client.images.get(image)
        except Exception:
            client.images.pull(image)
        return client.containers.run(**kwargs).id
    return await asyncio.to_thread(_run)


async def _docker_action(container_id, action):
    def _run():
        import docker
        client = docker.from_env()
        try:
            c = client.containers.get(container_id)
            getattr(c, action)(timeout=10) if action != "remove" else c.remove(force=True)
            return True
        except Exception as e:
            logger.error(f"Docker {action} failed: {e}")
            return False
    return await asyncio.to_thread(_run)


async def _docker_logs(container_id, tail=200):
    def _run():
        import docker
        try:
            return docker.from_env().containers.get(container_id).logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")
        except Exception as e:
            return f"Error: {e}"
    return await asyncio.to_thread(_run)


async def _docker_status(container_id):
    def _run():
        import docker
        try:
            return docker.from_env().containers.get(container_id).status
        except Exception:
            return None
    return await asyncio.to_thread(_run)


# --- AgentCore Runtime backend ---

async def _agentcore_create(image, name, env_vars, cpu_limit, memory_limit):
    """Deploy via AgentCore Runtime - creates a runtime + endpoint."""
    from domain.agentcore.runtime_adapter import get_runtime_adapter

    adapter = get_runtime_adapter()
    result = await adapter.create_runtime(
        name=name,
        image_uri=image,
        environment=env_vars or {},
        cpu=cpu_limit,
        memory=memory_limit,
    )

    if "error" in result:
        raise RuntimeError(f"AgentCore Runtime creation failed: {result['error']}")

    runtime_id = result["runtime_id"]

    endpoint_result = await adapter.create_endpoint(runtime_id, f"{name}-default")
    if "error" in endpoint_result:
        raise RuntimeError(f"AgentCore endpoint creation failed: {endpoint_result['error']}")

    return {
        "runtime_id": runtime_id,
        "endpoint_id": endpoint_result.get("endpoint_id"),
        "endpoint_url": endpoint_result.get("endpoint_url", ""),
    }


async def _agentcore_delete(runtime_id):
    """Delete an AgentCore Runtime."""
    from domain.agentcore.runtime_adapter import get_runtime_adapter
    adapter = get_runtime_adapter()
    return await adapter.delete_runtime(runtime_id)


# --- Service layer ---

async def create_instance(db: AsyncSession, data: dict) -> Instance:
    """Create and deploy an MCP server instance."""
    if is_agentcore_enabled():
        return await _create_instance_agentcore(db, data)
    return await _create_instance_docker(db, data)


async def _create_instance_docker(db: AsyncSession, data: dict) -> Instance:
    """Create instance using local Docker."""
    used = set((await db.execute(
        select(Instance.port).where(Instance.status.in_(["running", "pending"]), Instance.port.isnot(None))
    )).scalars().all())
    port = next((p for p in random.sample(range(9000, 9999), min(100, 999)) if p not in used), None)
    if not port:
        raise RuntimeError("No available ports")

    inst = Instance(
        server_id=data["server_id"],
        server_name=data.get("server_name"),
        image=data["image"],
        command=data.get("command"),
        cpu_limit=data.get("cpu_limit", "0.5"),
        memory_limit=data.get("memory_limit", "256m"),
        env_vars=data.get("env_vars"),
        port=port,
        status="pending",
        runtime_type="docker",
    )
    db.add(inst)
    await db.commit()
    await db.refresh(inst)

    try:
        cid = await _docker_run(
            inst.image, f"mcp-instance-{inst.id}", inst.port,
            inst.cpu_limit or "0.5", inst.memory_limit or "256m",
            inst.env_vars, inst.command,
        )
        inst.container_id = cid
        inst.status = "running"
        inst.started_at = datetime.datetime.utcnow()
    except Exception as e:
        inst.status = "error"
        inst.env_vars = {**(inst.env_vars or {}), "_error": str(e)}

    await db.commit()
    await db.refresh(inst)
    return inst


async def _create_instance_agentcore(db: AsyncSession, data: dict) -> Instance:
    """Create instance using AgentCore Runtime (serverless)."""
    name = f"mcp-{data.get('server_name', 'instance')}-{random.randint(1000, 9999)}"

    inst = Instance(
        server_id=data["server_id"],
        server_name=data.get("server_name"),
        image=data["image"],
        command=data.get("command"),
        cpu_limit=data.get("cpu_limit", "0.5"),
        memory_limit=data.get("memory_limit", "512m"),
        env_vars=data.get("env_vars"),
        port=None,
        status="pending",
        runtime_type="agentcore",
    )
    db.add(inst)
    await db.commit()
    await db.refresh(inst)

    try:
        result = await _agentcore_create(
            image=inst.image,
            name=name,
            env_vars=inst.env_vars,
            cpu_limit=inst.cpu_limit or "0.5",
            memory_limit=inst.memory_limit or "512m",
        )
        inst.container_id = result["runtime_id"]
        inst.status = "running"
        inst.started_at = datetime.datetime.utcnow()
        inst.env_vars = {
            **(inst.env_vars or {}),
            "_agentcore_runtime_id": result["runtime_id"],
            "_agentcore_endpoint_id": result.get("endpoint_id", ""),
            "_agentcore_endpoint_url": result.get("endpoint_url", ""),
        }
    except Exception as e:
        inst.status = "error"
        inst.env_vars = {**(inst.env_vars or {}), "_error": str(e)}

    await db.commit()
    await db.refresh(inst)
    return inst


async def get_instance(db: AsyncSession, iid: int) -> Optional[Instance]:
    return (await db.execute(select(Instance).where(Instance.id == iid))).scalar_one_or_none()


async def list_instances(db: AsyncSession, page=1, page_size=20, server_id=None, status=None):
    base = select(Instance)
    count_q = select(func.count(Instance.id))
    if server_id:
        base = base.where(Instance.server_id == server_id)
        count_q = count_q.where(Instance.server_id == server_id)
    if status:
        base = base.where(Instance.status == status)
        count_q = count_q.where(Instance.status == status)
    total = (await db.execute(count_q)).scalar()
    items = (await db.execute(base.order_by(Instance.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return list(items), total


async def stop_instance(db, iid):
    inst = await get_instance(db, iid)
    if not inst or not inst.container_id:
        return None
    if getattr(inst, "runtime_type", None) == "agentcore":
        inst.status = "stopped"
        inst.stopped_at = datetime.datetime.utcnow()
    else:
        await _docker_action(inst.container_id, "stop")
        inst.status = "stopped"
        inst.stopped_at = datetime.datetime.utcnow()
    await db.commit()
    await db.refresh(inst)
    return inst


async def start_instance(db, iid):
    inst = await get_instance(db, iid)
    if not inst or not inst.container_id:
        return None
    if getattr(inst, "runtime_type", None) == "agentcore":
        inst.status = "running"
        inst.started_at = datetime.datetime.utcnow()
        inst.stopped_at = None
    else:
        await _docker_action(inst.container_id, "start")
        inst.status = "running"
        inst.started_at = datetime.datetime.utcnow()
        inst.stopped_at = None
    await db.commit()
    await db.refresh(inst)
    return inst


async def restart_instance(db, iid):
    inst = await get_instance(db, iid)
    if not inst or not inst.container_id:
        return None
    if getattr(inst, "runtime_type", None) == "agentcore":
        inst.status = "running"
        inst.started_at = datetime.datetime.utcnow()
        inst.stopped_at = None
    else:
        await _docker_action(inst.container_id, "restart")
        inst.status = "running"
        inst.started_at = datetime.datetime.utcnow()
        inst.stopped_at = None
    await db.commit()
    await db.refresh(inst)
    return inst


async def delete_instance(db, iid):
    inst = await get_instance(db, iid)
    if not inst:
        return False
    if getattr(inst, "runtime_type", None) == "agentcore":
        if inst.container_id:
            await _agentcore_delete(inst.container_id)
    else:
        if inst.container_id:
            await _docker_action(inst.container_id, "remove")
    await db.delete(inst)
    await db.commit()
    return True


async def get_logs(db, iid, tail=200):
    inst = await get_instance(db, iid)
    if not inst or not inst.container_id:
        return None
    if getattr(inst, "runtime_type", None) == "agentcore":
        return "[AgentCore Runtime] Logs available via AWS CloudWatch. Runtime ID: " + inst.container_id
    return await _docker_logs(inst.container_id, tail)


async def check_health(db, iid):
    inst = await get_instance(db, iid)
    if not inst:
        return None

    hc = HealthCheck(instance_id=iid, status="unhealthy")

    if getattr(inst, "runtime_type", None) == "agentcore":
        endpoint_url = (inst.env_vars or {}).get("_agentcore_endpoint_url", "")
        if endpoint_url:
            start = time.time()
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(f"{endpoint_url}/health")
                    hc.status = "healthy" if resp.status_code < 400 else "unhealthy"
                    hc.response_time_ms = round((time.time() - start) * 1000, 2)
            except Exception as e:
                hc.status = "timeout"
                hc.detail = str(e)
    else:
        if inst.container_id and await _docker_status(inst.container_id) == "running" and inst.port:
            start = time.time()
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(f"http://localhost:{inst.port}/health")
                    hc.status = "healthy" if resp.status_code < 400 else "unhealthy"
                    hc.response_time_ms = round((time.time() - start) * 1000, 2)
            except Exception as e:
                hc.status = "timeout"
                hc.detail = str(e)

    db.add(hc)
    await db.commit()
    await db.refresh(hc)
    inst.status = "running" if hc.status == "healthy" else ("error" if inst.status == "running" else inst.status)
    await db.commit()
    return hc
