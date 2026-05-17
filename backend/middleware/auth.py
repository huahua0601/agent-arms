"""JWT authentication middleware."""
from datetime import datetime, timedelta
from typing import Optional, List

import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core import settings

security_scheme = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_minutes: int = 0) -> str:
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": expire, "type": "access"}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict, expires_days: int = 0) -> str:
    expire = datetime.utcnow() + timedelta(days=expires_days or settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode({**data, "exp": expire, "type": "refresh"}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload


class PermissionChecker:
    def __init__(self, required: List[str]):
        self.required = required

    async def __call__(self, credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme)) -> dict:
        user = await get_current_user(credentials)
        if user.get("is_superadmin"):
            return user
        if not set(self.required).issubset(set(user.get("permissions", []))):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
