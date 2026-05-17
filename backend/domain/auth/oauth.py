"""OAuth authentication — GitHub, Google, custom OIDC."""
import datetime
import secrets
import logging
from typing import Optional

from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import settings
from core.database import get_db
from middleware.auth import create_access_token, create_refresh_token, get_current_user
from domain.auth.models import User, OAuthConnection, Role
from domain.auth.service import build_token_payload

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth/oauth", tags=["oauth"])

PROVIDERS = {
    "github": {
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scope": "read:user user:email",
    },
    "google": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
    },
}


def _get_provider_config(provider: str) -> dict:
    if provider == "github":
        if not settings.GITHUB_CLIENT_ID:
            raise HTTPException(400, "GitHub OAuth not configured")
        return {**PROVIDERS["github"], "client_id": settings.GITHUB_CLIENT_ID, "client_secret": settings.GITHUB_CLIENT_SECRET}
    elif provider == "google":
        if not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(400, "Google OAuth not configured")
        return {**PROVIDERS["google"], "client_id": settings.GOOGLE_CLIENT_ID, "client_secret": settings.GOOGLE_CLIENT_SECRET}
    elif provider == "oidc":
        if not settings.OIDC_CLIENT_ID:
            raise HTTPException(400, "OIDC not configured")
        return {
            "authorize_url": f"{settings.OIDC_DISCOVERY_URL.rstrip('/')}".replace("/.well-known/openid-configuration", "") + "/authorize",
            "token_url": f"{settings.OIDC_DISCOVERY_URL.rstrip('/')}".replace("/.well-known/openid-configuration", "") + "/token",
            "userinfo_url": f"{settings.OIDC_DISCOVERY_URL.rstrip('/')}".replace("/.well-known/openid-configuration", "") + "/userinfo",
            "scope": "openid email profile",
            "client_id": settings.OIDC_CLIENT_ID,
            "client_secret": settings.OIDC_CLIENT_SECRET,
        }
    else:
        raise HTTPException(400, f"Unknown provider: {provider}")


async def _fetch_user_info(provider: str, config: dict, token: dict) -> dict:
    """Fetch user info from provider and normalize to {id, username, email, avatar, raw}."""
    from httpx import AsyncClient
    async with AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token['access_token']}"}
        if provider == "github":
            headers["Accept"] = "application/json"
        resp = await client.get(config["userinfo_url"], headers=headers)
        resp.raise_for_status()
        data = resp.json()

    if provider == "github":
        email = data.get("email")
        if not email:
            async with AsyncClient() as client:
                resp2 = await client.get("https://api.github.com/user/emails", headers=headers)
                if resp2.status_code == 200:
                    for e in resp2.json():
                        if e.get("primary"):
                            email = e["email"]
                            break
        return {
            "id": str(data["id"]),
            "username": data.get("login", ""),
            "email": email or f'{data["id"]}@github.user',
            "avatar": data.get("avatar_url"),
            "display_name": data.get("name") or data.get("login", ""),
            "raw": data,
        }
    elif provider == "google":
        return {
            "id": data.get("sub", ""),
            "username": data.get("email", "").split("@")[0],
            "email": data.get("email", ""),
            "avatar": data.get("picture"),
            "display_name": data.get("name", ""),
            "raw": data,
        }
    else:
        return {
            "id": str(data.get("sub", data.get("id", ""))),
            "username": data.get("preferred_username", data.get("email", "").split("@")[0]),
            "email": data.get("email", ""),
            "avatar": data.get("picture"),
            "display_name": data.get("name", ""),
            "raw": data,
        }


@router.get("/providers")
async def list_providers():
    """Return which OAuth providers are configured."""
    available = []
    if settings.GITHUB_CLIENT_ID:
        available.append({"id": "github", "name": "GitHub"})
    if settings.GOOGLE_CLIENT_ID:
        available.append({"id": "google", "name": "Google"})
    if settings.OIDC_CLIENT_ID:
        available.append({"id": "oidc", "name": "SSO"})
    return available


@router.get("/{provider}/authorize")
async def oauth_authorize(provider: str):
    config = _get_provider_config(provider)
    redirect_uri = f"{settings.OAUTH_REDIRECT_BASE}/api/auth/oauth/{provider}/callback"
    client = AsyncOAuth2Client(
        client_id=config["client_id"],
        client_secret=config["client_secret"],
        redirect_uri=redirect_uri,
        scope=config["scope"],
    )
    url, _ = client.create_authorization_url(config["authorize_url"])
    return {"url": url}


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    config = _get_provider_config(provider)
    redirect_uri = f"{settings.OAUTH_REDIRECT_BASE}/api/auth/oauth/{provider}/callback"

    client = AsyncOAuth2Client(
        client_id=config["client_id"],
        client_secret=config["client_secret"],
        redirect_uri=redirect_uri,
    )
    token = await client.fetch_token(
        config["token_url"],
        code=code,
        grant_type="authorization_code",
    )

    user_info = await _fetch_user_info(provider, config, token)

    conn = (await db.execute(
        select(OAuthConnection).where(
            OAuthConnection.provider == provider,
            OAuthConnection.provider_user_id == user_info["id"]
        )
    )).scalar_one_or_none()

    if conn:
        user = (await db.execute(select(User).where(User.id == conn.user_id))).scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(403, "Account disabled")
        conn.provider_data = user_info["raw"]
        conn.provider_email = user_info["email"]
        await db.commit()
    else:
        existing = (await db.execute(select(User).where(User.email == user_info["email"]))).scalar_one_or_none()
        if existing:
            user = existing
        else:
            base_username = user_info["username"] or f"{provider}_{user_info['id'][:8]}"
            username = base_username
            suffix = 1
            while (await db.execute(select(User).where(User.username == username))).scalar_one_or_none():
                username = f"{base_username}_{suffix}"
                suffix += 1
            dev_role = (await db.execute(select(Role).where(Role.name == "developer"))).scalar_one_or_none()
            user = User(
                username=username,
                email=user_info["email"],
                display_name=user_info["display_name"],
                avatar_url=user_info["avatar"],
                auth_provider=provider,
                provider_id=user_info["id"],
                is_active=True,
            )
            if dev_role:
                user.roles = [dev_role]
            db.add(user)
            await db.flush()

        new_conn = OAuthConnection(
            user_id=user.id,
            provider=provider,
            provider_user_id=user_info["id"],
            provider_username=user_info["username"],
            provider_email=user_info["email"],
            provider_data=user_info["raw"],
        )
        db.add(new_conn)
        await db.commit()
        await db.refresh(user)

    from sqlalchemy.orm import selectinload
    user = (await db.execute(
        select(User).where(User.id == user.id).options(selectinload(User.roles))
    )).scalar_one()
    payload = build_token_payload(user)
    access = create_access_token(payload)
    refresh = create_refresh_token(payload)

    return RedirectResponse(
        f"{settings.OAUTH_REDIRECT_BASE}/login?access_token={access}&refresh_token={refresh}"
    )


@router.get("/connections")
async def list_connections(current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(OAuthConnection).where(OAuthConnection.user_id == int(current["sub"]))
    )
    conns = result.scalars().all()
    return [
        {
            "id": c.id, "provider": c.provider,
            "provider_username": c.provider_username,
            "provider_email": c.provider_email,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in conns
    ]


@router.delete("/connections/{conn_id}", status_code=204)
async def delete_connection(conn_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    conn = (await db.execute(
        select(OAuthConnection).where(OAuthConnection.id == conn_id, OAuthConnection.user_id == int(current["sub"]))
    )).scalar_one_or_none()
    if not conn:
        raise HTTPException(404)
    user = (await db.execute(select(User).where(User.id == int(current["sub"])))).scalar_one()
    other_conns = (await db.execute(
        select(OAuthConnection).where(OAuthConnection.user_id == user.id, OAuthConnection.id != conn_id)
    )).scalars().all()
    if not user.hashed_password and len(other_conns) == 0:
        raise HTTPException(400, "Cannot remove last login method. Set a password first.")
    await db.delete(conn)
    await db.commit()
