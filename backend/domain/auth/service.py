"""Auth service layer."""
import secrets, hashlib, datetime
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from domain.auth.models import User, Role, Permission, ApiKey, user_roles, role_permissions
from core.security import hash_password, verify_password
from core import settings


def _hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

def _collect_permissions(user: User) -> list[str]:
    perms: set[str] = set()
    for role in user.roles:
        for p in role.permissions:
            perms.add(f"{p.resource}:{p.action}")
    return sorted(perms)


async def authenticate_user(db: AsyncSession, username: str, password: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.username == username).options(selectinload(User.roles).selectinload(Role.permissions)))
    user = result.scalar_one_or_none()
    if user and verify_password(password, user.hashed_password) and user.is_active:
        return user
    return None

def build_token_payload(user: User) -> dict:
    return {"sub": str(user.id), "username": user.username, "is_superadmin": user.is_superadmin, "roles": [r.name for r in user.roles], "permissions": _collect_permissions(user)}

async def create_user(db: AsyncSession, data: dict) -> User:
    role_ids = data.pop("role_ids", [])
    password = data.pop("password")
    user = User(**data, hashed_password=hash_password(password))
    if role_ids:
        user.roles = list((await db.execute(select(Role).where(Role.id.in_(role_ids)))).scalars().all())
    db.add(user); await db.commit(); await db.refresh(user); return user

async def get_user(db: AsyncSession, user_id: int) -> Optional[User]:
    return (await db.execute(select(User).where(User.id == user_id).options(selectinload(User.roles).selectinload(Role.permissions)))).scalar_one_or_none()

async def list_users(db: AsyncSession, page: int = 1, page_size: int = 20, search: Optional[str] = None):
    base = select(User).options(selectinload(User.roles))
    count_q = select(func.count(User.id))
    if search:
        like = f"%{search}%"
        filt = (User.username.ilike(like)) | (User.email.ilike(like))
        base = base.where(filt); count_q = count_q.where(filt)
    total = (await db.execute(count_q)).scalar()
    items = (await db.execute(base.order_by(User.id).offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return list(items), total

async def update_user(db: AsyncSession, user_id: int, data: dict) -> Optional[User]:
    user = await get_user(db, user_id)
    if not user: return None
    role_ids = data.pop("role_ids", None)
    password = data.pop("password", None)
    for k, v in data.items():
        if v is not None: setattr(user, k, v)
    if password: user.hashed_password = hash_password(password)
    if role_ids is not None:
        user.roles = list((await db.execute(select(Role).where(Role.id.in_(role_ids)))).scalars().all())
    user.updated_at = datetime.datetime.utcnow()
    await db.commit(); await db.refresh(user); return user

async def delete_user(db: AsyncSession, user_id: int) -> bool:
    user = await get_user(db, user_id)
    if not user: return False
    await db.delete(user); await db.commit(); return True

async def list_roles(db: AsyncSession) -> list[Role]:
    return list((await db.execute(select(Role).options(selectinload(Role.permissions)).order_by(Role.id))).scalars().all())

async def get_role(db: AsyncSession, role_id: int) -> Optional[Role]:
    return (await db.execute(select(Role).where(Role.id == role_id).options(selectinload(Role.permissions)))).scalar_one_or_none()

async def create_role(db: AsyncSession, data: dict) -> Role:
    perm_ids = data.pop("permission_ids", [])
    role = Role(**data)
    if perm_ids: role.permissions = list((await db.execute(select(Permission).where(Permission.id.in_(perm_ids)))).scalars().all())
    db.add(role); await db.commit(); await db.refresh(role); return role

async def update_role(db: AsyncSession, role_id: int, data: dict) -> Optional[Role]:
    role = await get_role(db, role_id)
    if not role or role.is_system: return None
    perm_ids = data.pop("permission_ids", None)
    for k, v in data.items():
        if v is not None: setattr(role, k, v)
    if perm_ids is not None:
        role.permissions = list((await db.execute(select(Permission).where(Permission.id.in_(perm_ids)))).scalars().all())
    await db.commit(); await db.refresh(role); return role

async def delete_role(db: AsyncSession, role_id: int) -> bool:
    role = await get_role(db, role_id)
    if not role or role.is_system: return False
    await db.delete(role); await db.commit(); return True

async def list_permissions(db: AsyncSession) -> list[Permission]:
    return list((await db.execute(select(Permission).order_by(Permission.resource, Permission.action))).scalars().all())

async def create_api_key(db: AsyncSession, user_id: int, data: dict) -> tuple[ApiKey, str]:
    raw_key = f"mcp_{secrets.token_urlsafe(32)}"
    expires_in_days = data.pop("expires_in_days", None)
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=expires_in_days) if expires_in_days else None
    api_key = ApiKey(user_id=user_id, name=data["name"], key_hash=_hash_api_key(raw_key), key_prefix=raw_key[:12], scopes=data.get("scopes", []), expires_at=expires_at)
    db.add(api_key); await db.commit(); await db.refresh(api_key); return api_key, raw_key

async def list_api_keys(db: AsyncSession, user_id: int) -> list[ApiKey]:
    return list((await db.execute(select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.created_at.desc()))).scalars().all())

async def delete_api_key(db: AsyncSession, key_id: int, user_id: int) -> bool:
    key = (await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id))).scalar_one_or_none()
    if not key: return False
    await db.delete(key); await db.commit(); return True


SEED_PERMISSIONS = [
    ("user", "create"), ("user", "read"), ("user", "update"), ("user", "delete"),
    ("role", "create"), ("role", "read"), ("role", "update"), ("role", "delete"),
    ("mcp_server", "create"), ("mcp_server", "read"), ("mcp_server", "update"), ("mcp_server", "delete"),
    ("mcp_instance", "create"), ("mcp_instance", "read"), ("mcp_instance", "update"), ("mcp_instance", "delete"),
    ("audit_log", "read"), ("audit_log", "export"),
    ("api_key", "create"), ("api_key", "read"), ("api_key", "delete"),
]
SEED_ROLES = {
    "superadmin": {"description": "Full access", "perms": "*"},
    "admin": {"description": "Administrator", "perms": ["user:read","user:update","role:read","mcp_server:create","mcp_server:read","mcp_server:update","mcp_server:delete","mcp_instance:create","mcp_instance:read","mcp_instance:update","mcp_instance:delete","audit_log:read","audit_log:export","api_key:create","api_key:read","api_key:delete"]},
    "developer": {"description": "Developer", "perms": ["mcp_server:create","mcp_server:read","mcp_server:update","mcp_instance:create","mcp_instance:read","mcp_instance:update","api_key:create","api_key:read","api_key:delete"]},
    "viewer": {"description": "Read-only", "perms": ["mcp_server:read","mcp_instance:read","audit_log:read"]},
}

async def seed_data(db: AsyncSession):
    if (await db.execute(select(func.count(Permission.id)))).scalar() > 0:
        return
    perm_objs: dict[str, Permission] = {}
    for resource, action in SEED_PERMISSIONS:
        p = Permission(resource=resource, action=action, description=f"{action} {resource}")
        db.add(p); perm_objs[f"{resource}:{action}"] = p
    await db.flush()
    all_perms = list(perm_objs.values())
    for role_name, cfg in SEED_ROLES.items():
        role = Role(name=role_name, description=cfg["description"], is_system=True)
        role.permissions = all_perms if cfg["perms"] == "*" else [perm_objs[p] for p in cfg["perms"] if p in perm_objs]
        db.add(role)
    await db.flush()
    if not (await db.execute(select(User).where(User.username == settings.DEFAULT_ADMIN_USERNAME))).scalar_one_or_none():
        superadmin_role = (await db.execute(select(Role).where(Role.name == "superadmin"))).scalar_one()
        admin = User(username=settings.DEFAULT_ADMIN_USERNAME, email=settings.DEFAULT_ADMIN_EMAIL, hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD), display_name="Administrator", is_superadmin=True)
        admin.roles = [superadmin_role]; db.add(admin)
    await db.commit()
