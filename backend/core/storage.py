"""Pluggable storage backend — local filesystem or S3/MinIO."""
import os
import logging
from abc import ABC, abstractmethod
from typing import Optional

from core import settings

logger = logging.getLogger(__name__)


class StorageBackend(ABC):
    @abstractmethod
    async def upload(self, path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        ...

    @abstractmethod
    async def download(self, path: str) -> bytes:
        ...

    @abstractmethod
    async def delete(self, path: str) -> None:
        ...

    @abstractmethod
    async def list_files(self, prefix: str) -> list[str]:
        ...

    @abstractmethod
    async def exists(self, path: str) -> bool:
        ...


class LocalStorage(StorageBackend):
    def __init__(self, base_path: str):
        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)

    def _full_path(self, path: str) -> str:
        return os.path.join(self.base_path, path.lstrip("/"))

    async def upload(self, path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        fp = self._full_path(path)
        os.makedirs(os.path.dirname(fp), exist_ok=True)
        with open(fp, "wb") as f:
            f.write(data)
        return path

    async def download(self, path: str) -> bytes:
        fp = self._full_path(path)
        if not os.path.exists(fp):
            raise FileNotFoundError(f"File not found: {path}")
        with open(fp, "rb") as f:
            return f.read()

    async def delete(self, path: str) -> None:
        fp = self._full_path(path)
        if os.path.exists(fp):
            os.remove(fp)

    async def list_files(self, prefix: str) -> list[str]:
        base = self._full_path(prefix)
        if not os.path.isdir(base):
            return []
        result = []
        for root, _, files in os.walk(base):
            for f in files:
                rel = os.path.relpath(os.path.join(root, f), self.base_path)
                result.append(rel)
        return sorted(result)

    async def exists(self, path: str) -> bool:
        return os.path.exists(self._full_path(path))


class S3Storage(StorageBackend):
    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str, region: str = "us-east-1"):
        import boto3
        kwargs = {"region_name": region, "aws_access_key_id": access_key, "aws_secret_access_key": secret_key}
        if endpoint:
            kwargs["endpoint_url"] = endpoint
        self.s3 = boto3.client("s3", **kwargs)
        self.bucket = bucket
        try:
            self.s3.head_bucket(Bucket=bucket)
        except Exception:
            try:
                self.s3.create_bucket(Bucket=bucket)
            except Exception as e:
                logger.warning("Could not create bucket %s: %s", bucket, e)

    async def upload(self, path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        import asyncio
        await asyncio.to_thread(
            self.s3.put_object, Bucket=self.bucket, Key=path, Body=data, ContentType=content_type
        )
        return path

    async def download(self, path: str) -> bytes:
        import asyncio
        resp = await asyncio.to_thread(self.s3.get_object, Bucket=self.bucket, Key=path)
        return resp["Body"].read()

    async def delete(self, path: str) -> None:
        import asyncio
        await asyncio.to_thread(self.s3.delete_object, Bucket=self.bucket, Key=path)

    async def list_files(self, prefix: str) -> list[str]:
        import asyncio
        resp = await asyncio.to_thread(
            self.s3.list_objects_v2, Bucket=self.bucket, Prefix=prefix
        )
        return sorted([obj["Key"] for obj in resp.get("Contents", [])])

    async def exists(self, path: str) -> bool:
        import asyncio
        try:
            await asyncio.to_thread(self.s3.head_object, Bucket=self.bucket, Key=path)
            return True
        except Exception:
            return False


def create_storage() -> StorageBackend:
    if settings.STORAGE_TYPE == "s3":
        logger.info("Using S3 storage: %s/%s", settings.STORAGE_S3_ENDPOINT or "AWS", settings.STORAGE_S3_BUCKET)
        return S3Storage(
            endpoint=settings.STORAGE_S3_ENDPOINT,
            access_key=settings.STORAGE_S3_ACCESS_KEY,
            secret_key=settings.STORAGE_S3_SECRET_KEY,
            bucket=settings.STORAGE_S3_BUCKET,
            region=settings.STORAGE_S3_REGION,
        )
    else:
        logger.info("Using local storage: %s", settings.STORAGE_LOCAL_PATH)
        return LocalStorage(settings.STORAGE_LOCAL_PATH)
