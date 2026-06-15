"""Skill models — Agent Skills that provide instructions for AI agents."""
import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, Text, JSON, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from core.database import Base

skill_tags = Table("skill_tags", Base.metadata,
    Column("skill_id", Integer, ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("skill_tag_list.id", ondelete="CASCADE"), primary_key=True))


class Skill(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False, index=True)
    namespace = Column(String(256), unique=True, nullable=False, index=True)
    description = Column(Text)
    content = Column(Text, nullable=False)
    category = Column(String(64), default="general", index=True)
    version = Column(String(32), default="1.0.0")
    author_id = Column(Integer, nullable=False, index=True)
    author_name = Column(String(128))
    icon_url = Column(String(512))
    package_path = Column(String(512))
    status = Column(String(32), default="active", index=True)
    is_public = Column(Boolean, default=True)
    downloads = Column(Integer, default=0)
    parameters = Column(JSON)
    trigger_pattern = Column(String(512))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tags = relationship("SkillTag", secondary=skill_tags, back_populates="skills", lazy="selectin")
    versions = relationship("SkillVersion", back_populates="skill", lazy="selectin", cascade="all, delete-orphan")


class SkillTag(Base):
    __tablename__ = "skill_tag_list"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), unique=True, nullable=False)
    skills = relationship("Skill", secondary=skill_tags, back_populates="tags")


class SkillVersion(Base):
    __tablename__ = "skill_versions"
    __table_args__ = (UniqueConstraint("skill_id", "version", name="uq_skill_version"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(32), nullable=False)
    content = Column(Text, nullable=False)
    changelog = Column(Text)
    published_at = Column(DateTime, default=datetime.datetime.utcnow)
    skill = relationship("Skill", back_populates="versions")
