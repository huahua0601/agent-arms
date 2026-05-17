"""Gateway API Key authentication — reuses auth_api_keys table."""
import hashlib
import datetime
from typing import Optional, Tuple

from fastapi import Request, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from domain.auth.models import ApiKey, User


def _hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def authenticate_gateway_request(
    request: Request, db: AsyncSession
) -> Tuple[int, str, int]:
    """Validate API Key from Authorization header.

    Returns (user_id, username, api_key_id) on success.
    Raises HTTPException on failure.
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header. Use: Bearer <api_key>")

    raw_key = auth_header[7:].strip()
    if not raw_key:
        raise HTTPException(status_code=401, detail="Empty API key")

    key_hash = _hash_api_key(raw_key)
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)
        .options(selectinload(ApiKey.user))
    )
    api_key: Optional[ApiKey] = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")

    if api_key.expires_at and api_key.expires_at < datetime.datetime.utcnow():
        raise HTTPException(status_code=401, detail="API key expired")

    if not api_key.user or not api_key.user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")

    api_key.last_used_at = datetime.datetime.utcnow()
    await db.commit()

    return api_key.user_id, api_key.user.username, api_key.id
