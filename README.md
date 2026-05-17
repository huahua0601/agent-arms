# AgentHub — Enterprise AI Agent Capability Hub

AgentHub is an enterprise-grade platform for discovering, registering, managing and monitoring **MCP (Model Context Protocol) servers**, **Agent Skills**, and **REST API-based tools** — with built-in governance, access control and observability.

## Key Features

- **Public Marketplace** — Anonymous browsing of reviewed MCP servers and Agent Skills
- **MCP Server Registry** — Register native MCP servers with auto tool/resource/prompt discovery
- **Agent Skills** — Markdown-based skill packages with versioning and file uploads
- **OpenAPI → MCP** — Convert any REST API to a virtual MCP server with one paste
- **MCP Gateway** — Unified endpoint proxy with API Key auth, header-based routing
- **Review & Governance** — Draft → Pending Review → Active workflow, admin approval required
- **Team Namespaces** — Owner/Admin/Member roles with scoped publishing policies
- **OAuth SSO** — GitHub / Google / custom OIDC login
- **Pluggable Storage** — Local filesystem or S3/MinIO
- **CLI-Compatible API** — ClawHub/OpenClaw-style REST API for command-line tools
- **Full Observability** — Audit logs, Gateway call analytics, health checks

## Architecture

```
                          ┌─────────────────┐
                          │  Next.js App    │
                          │  Public + Auth  │
                          └────────┬────────┘
                                   │
                         ┌─────────▼─────────┐
                         │   FastAPI Backend │
                         │                   │
      ┌──────────────────┼───────────────────┼─────────────────┐
      │                  │                   │                 │
 ┌────▼─────┐    ┌──────▼──────┐     ┌───────▼──────┐  ┌──────▼──────┐
 │ Registry │    │   Gateway   │     │ REST-to-MCP  │  │ Marketplace │
 │ (CRUD)   │    │ /gateway/mcp│     │ /mcp/rest/{} │  │ public API  │
 └──────────┘    └──────┬──────┘     └──────┬───────┘  └─────────────┘
                        │                   │
                  ┌─────▼─────┐       ┌─────▼──────┐
                  │ MCP Server│       │ REST API   │
                  │ (native)  │       │ (OpenAPI)  │
                  └───────────┘       └────────────┘

  Data: PostgreSQL 15 · Redis 7 · Local FS / S3
```

## Quick Start

```bash
git clone <repo-url> agenthub && cd agenthub
docker-compose up -d
```

Access:
- **Marketplace** (public): http://localhost:3000/
- **Login** (admin): http://localhost:3000/login — `admin` / `admin123`
- **API**: http://localhost:3000/api/*

## Tech Stack

**Backend**: Python 3.11 · FastAPI · SQLAlchemy · PostgreSQL 15 · Redis 7 · Alembic

**Frontend**: Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · ApexCharts

**Infrastructure**: Docker Compose · Nginx (optional)

## License

MIT
