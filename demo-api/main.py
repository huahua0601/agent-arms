"""Demo REST API — 企业知识库 (Enterprise Knowledge Base)

A simple demo API to showcase OpenAPI-to-MCP integration.
Provides document management, search, and Q&A endpoints.
"""
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

app = FastAPI(
    title="Enterprise Knowledge Base API",
    description="企业知识库 REST API — 文档管理、智能搜索、问答",
    version="1.0.0",
    servers=[{"url": "http://localhost:9090", "description": "Local dev"}],
)

# --- In-memory storage ---
DOCS: dict[int, dict] = {
    1: {"id": 1, "title": "MCP 协议介绍", "content": "MCP (Model Context Protocol) 是 Anthropic 推出的模型上下文协议，用于连接 AI 模型与外部工具和数据源。它采用 JSON-RPC 2.0 协议，支持 Tools、Resources、Prompts 三种原语。", "category": "技术", "tags": ["mcp", "protocol", "ai"], "author": "admin", "created_at": "2026-04-20T10:00:00", "views": 156},
    2: {"id": 2, "title": "FastAPI 最佳实践", "content": "FastAPI 是一个高性能的 Python Web 框架。最佳实践包括：1) 使用 Pydantic 进行数据验证 2) 利用依赖注入系统 3) 异步处理 I/O 密集操作 4) 使用 OpenAPI 自动文档。", "category": "技术", "tags": ["python", "fastapi", "web"], "author": "dev-team", "created_at": "2026-04-18T14:30:00", "views": 89},
    3: {"id": 3, "title": "团队协作规范", "content": "团队协作规范：1) 代码提交前必须通过 CI 检查 2) PR 需要至少一人 review 3) 每周进行 code review session 4) 文档必须随代码同步更新。", "category": "流程", "tags": ["team", "process", "collaboration"], "author": "pm", "created_at": "2026-04-15T09:00:00", "views": 234},
    4: {"id": 4, "title": "Docker 部署指南", "content": "使用 Docker 部署服务的步骤：1) 编写 Dockerfile 2) 使用 docker-compose 编排多容器 3) 配置健康检查 4) 设置日志收集 5) 配置监控告警。", "category": "运维", "tags": ["docker", "devops", "deployment"], "author": "ops-team", "created_at": "2026-04-12T16:00:00", "views": 312},
    5: {"id": 5, "title": "API 安全最佳实践", "content": "API 安全要点：1) 使用 HTTPS 2) 实施身份认证（JWT/OAuth2）3) 输入验证和参数清洗 4) 速率限制 5) 日志审计 6) 敏感数据加密。", "category": "安全", "tags": ["security", "api", "best-practices"], "author": "sec-team", "created_at": "2026-04-10T11:00:00", "views": 178},
}
_next_id = 6


# --- Schemas ---
class DocCreate(BaseModel):
    title: str = Field(..., description="文档标题", min_length=1, max_length=200)
    content: str = Field(..., description="文档正文内容")
    category: str = Field("通用", description="文档分类，如：技术、流程、运维、安全")
    tags: list[str] = Field(default=[], description="标签列表")
    author: str = Field("anonymous", description="作者名称")

class DocUpdate(BaseModel):
    title: Optional[str] = Field(None, description="新标题")
    content: Optional[str] = Field(None, description="新内容")
    category: Optional[str] = Field(None, description="新分类")
    tags: Optional[list[str]] = Field(None, description="新标签列表")

class QARequest(BaseModel):
    question: str = Field(..., description="要查询的问题")
    top_k: int = Field(3, description="返回最相关的文档数量", ge=1, le=10)


# --- Endpoints ---
@app.get("/docs", summary="列出所有文档", operation_id="listDocs",
         description="获取知识库中的所有文档列表，支持按分类和关键词筛选")
def list_docs(
    category: Optional[str] = Query(None, description="按分类筛选"),
    keyword: Optional[str] = Query(None, description="按标题或内容关键词搜索"),
    limit: int = Query(20, description="返回数量限制", ge=1, le=100),
):
    results = list(DOCS.values())
    if category:
        results = [d for d in results if d["category"] == category]
    if keyword:
        kw = keyword.lower()
        results = [d for d in results if kw in d["title"].lower() or kw in d["content"].lower()]
    results.sort(key=lambda x: x["views"], reverse=True)
    return {"total": len(results), "docs": results[:limit]}


@app.get("/docs/{doc_id}", summary="获取文档详情", operation_id="getDoc",
         description="根据文档 ID 获取完整的文档内容")
def get_doc(doc_id: int):
    if doc_id not in DOCS:
        raise HTTPException(404, "Document not found")
    DOCS[doc_id]["views"] += 1
    return DOCS[doc_id]


@app.post("/docs", summary="创建新文档", operation_id="createDoc",
          description="向知识库中添加一篇新文档", status_code=201)
def create_doc(body: DocCreate):
    global _next_id
    doc = {
        "id": _next_id,
        "title": body.title,
        "content": body.content,
        "category": body.category,
        "tags": body.tags,
        "author": body.author,
        "created_at": datetime.utcnow().isoformat(),
        "views": 0,
    }
    DOCS[_next_id] = doc
    _next_id += 1
    return doc


@app.put("/docs/{doc_id}", summary="更新文档", operation_id="updateDoc",
         description="根据文档 ID 更新文档内容")
def update_doc(doc_id: int, body: DocUpdate):
    if doc_id not in DOCS:
        raise HTTPException(404, "Document not found")
    doc = DOCS[doc_id]
    if body.title is not None:
        doc["title"] = body.title
    if body.content is not None:
        doc["content"] = body.content
    if body.category is not None:
        doc["category"] = body.category
    if body.tags is not None:
        doc["tags"] = body.tags
    return doc


@app.delete("/docs/{doc_id}", summary="删除文档", operation_id="deleteDoc",
            description="根据文档 ID 删除一篇文档")
def delete_doc(doc_id: int):
    if doc_id not in DOCS:
        raise HTTPException(404, "Document not found")
    del DOCS[doc_id]
    return {"success": True, "message": f"Document {doc_id} deleted"}


@app.get("/docs/search/fulltext", summary="全文搜索", operation_id="searchDocs",
         description="在知识库中进行全文搜索，返回匹配的文档及相关度")
def search_docs(
    q: str = Query(..., description="搜索查询词"),
    category: Optional[str] = Query(None, description="限定搜索的分类"),
    limit: int = Query(5, description="最大返回数量", ge=1, le=20),
):
    q_lower = q.lower()
    scored = []
    for doc in DOCS.values():
        if category and doc["category"] != category:
            continue
        score = 0
        if q_lower in doc["title"].lower():
            score += 10
        if q_lower in doc["content"].lower():
            score += 5
        for tag in doc.get("tags", []):
            if q_lower in tag.lower():
                score += 3
        if score > 0:
            scored.append({**doc, "_score": score})
    scored.sort(key=lambda x: x["_score"], reverse=True)
    return {"query": q, "total": len(scored), "results": scored[:limit]}


@app.get("/categories", summary="获取所有分类", operation_id="listCategories",
         description="返回知识库中使用的所有文档分类及每个分类的文档数量")
def list_categories():
    cats: dict[str, int] = {}
    for doc in DOCS.values():
        cat = doc["category"]
        cats[cat] = cats.get(cat, 0) + 1
    return {"categories": [{"name": k, "count": v} for k, v in sorted(cats.items())]}


@app.get("/stats", summary="知识库统计", operation_id="getStats",
         description="获取知识库的整体统计数据，包括文档数量、总浏览量等")
def get_stats():
    total_docs = len(DOCS)
    total_views = sum(d["views"] for d in DOCS.values())
    categories = len(set(d["category"] for d in DOCS.values()))
    all_tags = set()
    for d in DOCS.values():
        all_tags.update(d.get("tags", []))
    return {
        "total_docs": total_docs,
        "total_views": total_views,
        "categories": categories,
        "unique_tags": len(all_tags),
        "top_docs": sorted(DOCS.values(), key=lambda x: x["views"], reverse=True)[:3],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9090)
