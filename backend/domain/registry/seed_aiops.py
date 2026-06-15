"""Seed AIOps MCP Servers into the registry on first startup."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.registry.models import McpServer, Tag


# NOTE: namespaces MUST stay in sync with the aiops orchestrator's
# MCP_SERVER_NAMESPACES (aiops/backend/src/claude_code_orchestrator.py), which
# sends them in the X-MCP-Server routing header. The canonical form is
# "aiops/<source_type>", where <source_type> matches the aiops DATASOURCE_SCHEMAS
# keys: opensearch / codecommit / gitlab / aws / grafana.
AIOPS_SERVERS = [
    {
        "name": "AIOps OpenSearch",
        "namespace": "aiops/opensearch",
        "description": "OpenSearch 日志搜索 MCP Server。提供错误日志搜索、上下文获取、错误统计、trace_id 关联查询等工具。",
        "version": "0.1.0",
        "transport_type": "sse",
        "endpoint_url": "http://localhost:9001/mcp",
        "source_type": "external",
        "auth_type": "none",
        "readme": "# AIOps OpenSearch MCP Server\n\n## Tools\n- search_error_logs\n- get_log_context\n- get_error_statistics\n- search_correlated_logs",
        "tags": ["aiops", "logging", "opensearch", "observability"],
    },
    {
        "name": "AIOps CodeCommit",
        "namespace": "aiops/codecommit",
        "description": "AWS CodeCommit 代码仓库 MCP Server。提供仓库列表、文件内容获取、commit 查询、diff 查看、代码搜索、PR 查询等工具。",
        "version": "0.1.0",
        "transport_type": "sse",
        "endpoint_url": "http://localhost:9004/mcp",
        "source_type": "external",
        "auth_type": "none",
        "readme": "# AIOps CodeCommit MCP Server\n\n## Tools\n- list_repositories\n- get_file_content\n- get_recent_commits\n- get_commit_diff\n- search_code\n- get_pull_requests",
        "tags": ["aiops", "codecommit", "aws", "code", "scm"],
    },
    {
        "name": "AIOps GitLab",
        "namespace": "aiops/gitlab",
        "description": "GitLab 代码仓库 MCP Server。提供代码搜索、commit 查询、MR 查询、文件内容获取、diff 查看等工具。",
        "version": "0.1.0",
        "transport_type": "sse",
        "endpoint_url": "http://localhost:9002/mcp",
        "source_type": "external",
        "auth_type": "none",
        "readme": "# AIOps GitLab MCP Server\n\n## Tools\n- get_recent_commits\n- get_merge_requests\n- get_file_content\n- get_diff\n- search_code",
        "tags": ["aiops", "gitlab", "code", "scm"],
    },
    {
        "name": "AIOps AWS ECS/EKS",
        "namespace": "aiops/aws",
        "description": "AWS ECS/EKS 容器服务 MCP Server。提供 ECS 服务状态查询、Task Definition、部署历史、服务事件等工具。",
        "version": "0.1.0",
        "transport_type": "sse",
        "endpoint_url": "http://localhost:9003/mcp",
        "source_type": "external",
        "auth_type": "none",
        "readme": "# AIOps AWS ECS/EKS MCP Server\n\n## Tools\n- describe_service\n- get_task_definition\n- list_recent_deployments\n- get_service_events\n- describe_eks_pod",
        "tags": ["aiops", "aws", "ecs", "eks", "container"],
    },
    {
        "name": "AIOps Grafana",
        "namespace": "aiops/grafana",
        "description": "Grafana 监控 MCP Server。提供 Dashboard 查询、数据源查询（PromQL）、Annotations 获取、告警规则查询等工具。",
        "version": "0.1.0",
        "transport_type": "sse",
        "endpoint_url": "http://localhost:9005/mcp",
        "source_type": "external",
        "auth_type": "none",
        "readme": "# AIOps Grafana MCP Server\n\n## Tools\n- list_dashboards\n- query_datasource\n- get_annotations\n- get_alert_rules",
        "tags": ["aiops", "grafana", "monitoring", "prometheus", "observability"],
    },
    {
        "name": "AIOps Dynatrace",
        "namespace": "aiops/dynatrace",
        "description": "Dynatrace APM MCP Server。提供问题检测、服务调用链、性能指标查询、分布式链路追踪等工具。",
        "version": "0.1.0",
        "transport_type": "sse",
        "endpoint_url": "http://localhost:9007/mcp",
        "source_type": "external",
        "auth_type": "none",
        "readme": "# AIOps Dynatrace MCP Server\n\n## Tools\n- get_problems\n- get_service_flow\n- get_metrics\n- get_traces",
        "tags": ["aiops", "dynatrace", "apm", "tracing", "observability"],
    },
    {
        "name": "AIOps CodeRepo",
        "namespace": "aiops/coderepo",
        "description": "统一代码仓库 MCP Server。完整 clone GitHub/GitLab/CodeCommit 仓库到本地，提供全仓搜索、文件读取、目录树、commit 历史、diff 等工具，用于代码级根因分析。",
        "version": "0.1.0",
        "transport_type": "sse",
        "endpoint_url": "http://localhost:9006/mcp",
        "source_type": "external",
        "auth_type": "none",
        "readme": "# AIOps CodeRepo MCP Server\n\n## Tools\n- clone_or_update\n- repo_search\n- repo_read_file\n- repo_tree\n- repo_log\n- repo_diff\n- repo_commit_diff",
        "tags": ["aiops", "code", "github", "gitlab", "codecommit", "clone"],
    },
    {
        "name": "AIOps EKS",
        "namespace": "aiops/eks",
        "description": "AWS EKS / Kubernetes MCP Server（由官方 awslabs.eks-mcp-server 提供）。查询 deployments/pods/replicasets、pod 日志、K8s 事件、CloudWatch 日志与指标、EKS insights，用于部署级根因分析。只读模式。",
        "version": "0.1.0",
        "transport_type": "sse",
        "endpoint_url": "http://localhost:9008/mcp",
        "source_type": "external",
        "auth_type": "none",
        "readme": "# AIOps EKS MCP Server (awslabs.eks-mcp-server)\n\n只读运行（--allow-sensitive-data-access 读取日志/事件）。\n\n## Tools\n- list_k8s_resources / manage_k8s_resource (read)\n- get_pod_logs / get_k8s_events\n- get_cloudwatch_logs / get_cloudwatch_metrics\n- get_eks_insights / get_eks_vpc_config / manage_eks_stacks (describe)",
        "tags": ["aiops", "eks", "kubernetes", "aws", "deployment"],
    },
]


async def seed_aiops_servers(db: AsyncSession):
    """Register AIOps MCP servers if they don't already exist."""
    from domain.auth.models import User
    from sqlalchemy import select as sel

    try:
        # Get admin user as the owner
        admin = (await db.execute(sel(User).where(User.is_superadmin == True))).scalars().first()
        if not admin:
            return

        owner_id = admin.id

        for server_def in AIOPS_SERVERS:
            # Check if already exists
            existing = (await db.execute(
                select(McpServer).where(McpServer.namespace == server_def["namespace"])
            )).scalar_one_or_none()

            if existing:
                continue

            # Separate tags from server fields
            tag_names = server_def.get("tags", [])
            fields = {k: v for k, v in server_def.items() if k != "tags"}

            # Get or create tags
            tag_objects = []
            for tag_name in tag_names:
                tag = (await db.execute(
                    select(Tag).where(Tag.name == tag_name)
                )).scalar_one_or_none()
                if not tag:
                    tag = Tag(name=tag_name)
                    db.add(tag)
                    await db.flush()
                tag_objects.append(tag)

            # Create server
            server = McpServer(
                **fields,
                owner_id=owner_id,
                status="active",
            )
            server.tags = tag_objects
            db.add(server)

        await db.commit()
    except Exception as e:
        await db.rollback()
        import logging
        logging.getLogger(__name__).warning(f"seed_aiops_servers: {e}")
