"""Backend configuration."""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://mcp_registry:mcp_registry_dev_123@localhost:5432/mcp_registry"
    SYNC_DATABASE_URL: str = "postgresql://mcp_registry:mcp_registry_dev_123@localhost:5432/mcp_registry"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET_KEY: str = "dev-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"
    DEFAULT_ADMIN_EMAIL: str = "admin@agenthub.local"
    RATE_LIMIT_PER_MINUTE: int = 120

    # OAuth
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    OIDC_DISCOVERY_URL: str = ""
    OIDC_CLIENT_ID: str = ""
    OIDC_CLIENT_SECRET: str = ""
    OAUTH_REDIRECT_BASE: str = "http://localhost:3000"

    # Storage
    STORAGE_TYPE: str = "local"
    STORAGE_LOCAL_PATH: str = "./data/uploads"
    STORAGE_S3_ENDPOINT: str = ""
    STORAGE_S3_ACCESS_KEY: str = ""
    STORAGE_S3_SECRET_KEY: str = ""
    STORAGE_S3_BUCKET: str = "mcp-registry"
    STORAGE_S3_REGION: str = "us-east-1"

    # AWS AgentCore
    AWS_REGION: str = "us-east-1"
    AGENTCORE_ENABLED: bool = False
    AGENTCORE_GATEWAY_ENDPOINT: str = ""
    AGENTCORE_RUNTIME_ENDPOINT: str = ""
    AGENTCORE_MEMORY_NAMESPACE: str = "agent-arms"
    AGENTCORE_IDENTITY_WORKLOAD_ID: str = ""
    AGENTCORE_OBSERVABILITY_ENABLED: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
