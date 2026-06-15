"""Backend configuration."""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = ""
    SYNC_DATABASE_URL: str = ""
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET_KEY: str = "dev-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"
    DEFAULT_ADMIN_EMAIL: str = "admin@agenthub.local"
    RATE_LIMIT_PER_MINUTE: int = 120

    # DB components (used when DATABASE_URL is not set)
    DB_HOST: str = "localhost"
    DB_PORT: str = "5432"
    DB_NAME: str = "mcp_registry"
    DB_USERNAME: str = "mcp_registry"
    DB_PASSWORD: str = "mcp_registry_dev_123"

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
    AGENTCORE_RUNTIME_ROLE_ARN: str = ""
    AGENTCORE_MEMORY_NAMESPACE: str = "agent-arms"
    AGENTCORE_IDENTITY_WORKLOAD_ID: str = ""
    AGENTCORE_OBSERVABILITY_ENABLED: bool = False

    class Config:
        env_file = ".env"

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql+asyncpg://{self.DB_USERNAME}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    def get_sync_database_url(self) -> str:
        if self.SYNC_DATABASE_URL:
            return self.SYNC_DATABASE_URL
        return f"postgresql://{self.DB_USERNAME}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


settings = Settings()
