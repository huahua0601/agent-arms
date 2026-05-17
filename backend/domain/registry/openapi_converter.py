"""OpenAPI-to-MCP converter — parse OpenAPI 3.x specs and generate MCP tool definitions.

Inspired by higress-group/openapi-to-mcpserver. Converts each OpenAPI path+method
into an MCP tool with proper parameter mapping (path/query/header/body -> tool args).
"""
import json
import logging
import re
from typing import Any, Optional

logger = logging.getLogger(__name__)


def parse_openapi(spec: dict) -> dict:
    """Parse an OpenAPI 3.x spec and return MCP-compatible server config.

    Returns:
        {
            "server_info": {"name": str, "version": str, "description": str},
            "base_url": str,
            "tools": [{"name", "description", "args", "request_template", "input_schema"}],
        }
    """
    info = spec.get("info", {})
    servers = spec.get("servers", [])
    base_url = servers[0]["url"].rstrip("/") if servers else ""

    result = {
        "server_info": {
            "name": info.get("title", "openapi-server"),
            "version": info.get("version", "1.0.0"),
            "description": info.get("description", ""),
        },
        "base_url": base_url,
        "tools": [],
    }

    paths = spec.get("paths", {})
    components = spec.get("components", {})
    schemas = components.get("schemas", {})

    for path, path_item in paths.items():
        for method in ("get", "post", "put", "patch", "delete"):
            if method not in path_item:
                continue
            op = path_item[method]
            tool = _convert_operation(path, method, op, schemas, base_url)
            if tool:
                result["tools"].append(tool)

    return result


def _convert_operation(path: str, method: str, op: dict, schemas: dict, base_url: str) -> Optional[dict]:
    op_id = op.get("operationId")
    if not op_id:
        op_id = _generate_operation_id(method, path)

    description = op.get("summary", "") or op.get("description", "") or f"{method.upper()} {path}"

    args = []
    input_properties = {}
    required_fields = []

    for param in op.get("parameters", []):
        param = _resolve_ref(param, schemas)
        name = param.get("name", "")
        schema = param.get("schema", {})
        param_type = schema.get("type", "string")
        param_desc = param.get("description", "")
        is_required = param.get("required", False)
        position = param.get("in", "query")

        args.append({
            "name": name,
            "description": param_desc,
            "type": param_type,
            "required": is_required,
            "position": position,
        })

        input_properties[name] = {"type": param_type}
        if param_desc:
            input_properties[name]["description"] = param_desc
        if is_required:
            required_fields.append(name)

    request_body = op.get("requestBody", {})
    if request_body:
        request_body = _resolve_ref(request_body, schemas)
        content = request_body.get("content", {})
        json_content = content.get("application/json", {})
        body_schema = json_content.get("schema", {})
        body_schema = _resolve_ref(body_schema, schemas)
        body_required = request_body.get("required", False)

        body_props = body_schema.get("properties", {})
        body_req_fields = body_schema.get("required", [])

        for prop_name, prop_schema in body_props.items():
            prop_schema = _resolve_ref(prop_schema, schemas)
            prop_type = prop_schema.get("type", "string")
            prop_desc = prop_schema.get("description", "")
            is_req = prop_name in body_req_fields

            args.append({
                "name": prop_name,
                "description": prop_desc,
                "type": prop_type,
                "required": is_req,
                "position": "body",
            })

            input_properties[prop_name] = {"type": prop_type}
            if prop_desc:
                input_properties[prop_name]["description"] = prop_desc
            if is_req:
                required_fields.append(prop_name)

    headers = []
    if method in ("post", "put", "patch") and request_body:
        headers.append({"key": "Content-Type", "value": "application/json"})

    request_template = {
        "url": path,
        "method": method.upper(),
    }
    if headers:
        request_template["headers"] = headers

    input_schema = {
        "type": "object",
        "properties": input_properties,
    }
    if required_fields:
        input_schema["required"] = required_fields

    output_schema = _extract_output_schema(op, schemas)

    tool = {
        "name": op_id,
        "description": description,
        "args": args,
        "request_template": request_template,
        "input_schema": input_schema,
    }
    if output_schema:
        tool["output_schema"] = output_schema

    return tool


def _extract_output_schema(op: dict, schemas: dict) -> Optional[dict]:
    responses = op.get("responses", {})
    for code in ("200", "201", "202"):
        if code not in responses:
            continue
        resp = _resolve_ref(responses[code], schemas)
        content = resp.get("content", {})
        json_content = content.get("application/json", {})
        schema = json_content.get("schema", {})
        if schema:
            schema = _resolve_ref(schema, schemas)
            if schema.get("type") == "object":
                return _simplify_schema(schema, schemas)
    return None


def _simplify_schema(schema: dict, schemas: dict, depth: int = 0) -> dict:
    if depth > 5:
        return {"type": "object"}
    schema = _resolve_ref(schema, schemas)
    result = {"type": schema.get("type", "object")}
    if "description" in schema:
        result["description"] = schema["description"]

    if schema.get("type") == "object" and "properties" in schema:
        props = {}
        for name, prop in schema["properties"].items():
            props[name] = _simplify_schema(prop, schemas, depth + 1)
        result["properties"] = props
        if "required" in schema:
            result["required"] = schema["required"]
    elif schema.get("type") == "array" and "items" in schema:
        result["items"] = _simplify_schema(schema["items"], schemas, depth + 1)

    return result


def _resolve_ref(obj: Any, schemas: dict) -> Any:
    if not isinstance(obj, dict):
        return obj
    ref = obj.get("$ref")
    if not ref:
        return obj
    parts = ref.split("/")
    if len(parts) >= 4 and parts[1] == "components" and parts[2] == "schemas":
        return schemas.get(parts[3], obj)
    return obj


def _generate_operation_id(method: str, path: str) -> str:
    clean = re.sub(r'\{[^}]+\}', '', path)
    parts = [p for p in clean.split("/") if p]
    if parts:
        name = "_".join(parts)
        return f"{method}_{name}"
    return f"{method}_root"


def openapi_to_mcp_tools(spec_text: str) -> dict:
    """High-level entry: accept raw OpenAPI JSON or YAML text, return parsed result."""
    try:
        spec = json.loads(spec_text)
    except json.JSONDecodeError:
        try:
            import yaml
            spec = yaml.safe_load(spec_text)
        except Exception:
            raise ValueError("Invalid OpenAPI spec: not valid JSON or YAML")

    if "openapi" not in spec and "swagger" not in spec:
        raise ValueError("Not a valid OpenAPI document (missing 'openapi' or 'swagger' field)")

    return parse_openapi(spec)
