#!/usr/bin/env python3
"""Generate OpenAPI 3.0 (Swagger) spec from extracted and probed ERP API data."""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

ROOT = Path(__file__).resolve().parent
DOCS_DIR = ROOT / "docs"

BASE_URL = "https://erp.101distributorsga.com/api"
SERVER_URL = "https://erp.101distributorsga.com"


def path_template_to_openapi(template: str) -> tuple[str, list[dict[str, Any]]]:
    """
    Convert bundle path template to OpenAPI path + parameters.
    /product/{param}?storeIds={param} -> /product/{id}, params for path + query
    """
    path_part, _, query_part = template.partition("?")
    path_params: list[dict[str, Any]] = []
    query_params: list[dict[str, Any]] = []
    path_idx = 0

    segments: list[str] = []
    for seg in path_part.split("/"):
        if not seg:
            continue
        if seg == "{param}":
            name = f"id{path_idx}" if path_idx else "id"
            path_idx += 1
            segments.append("{" + name + "}")
            path_params.append(
                {
                    "name": name,
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string"},
                    "description": "Dynamic path parameter",
                }
            )
        elif m := re.fullmatch(r"\{(\w+)\}", seg):
            name = m.group(1)
            segments.append("{" + name + "}")
            path_params.append(
                {
                    "name": name,
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string"},
                }
            )
        else:
            segments.append(seg)

    oa_path = "/" + "/".join(segments)

    if query_part:
        for pair in query_part.split("&"):
            if not pair:
                continue
            key, _, val = pair.partition("=")
            is_dynamic = val == "{param}" or bool(re.fullmatch(r"\{(\w+)\}", val or ""))
            schema: dict[str, Any] = {"type": "string"}
            if key in ("page", "size") and not is_dynamic:
                schema = {"type": "integer"}
            elif key == "storeIds":
                schema = {"type": "string", "example": "1,2,3,4,5"}
            query_params.append(
                {
                    "name": key,
                    "in": "query",
                    "required": is_dynamic,
                    "schema": schema,
                    **({"example": val} if val and not is_dynamic else {}),
                }
            )

    return oa_path, path_params + query_params


def probe_params_to_openapi(requirements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    params: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for req in requirements:
        loc = "query" if req["location"] == "query" else "path"
        key = (req["name"], loc)
        if key in seen:
            continue
        seen.add(key)
        schema: dict[str, Any] = {"type": "string"}
        if req["name"] in ("page", "size"):
            schema = {"type": "integer"}
        if req.get("default_used") is not None:
            schema["example"] = req["default_used"]
        entry: dict[str, Any] = {
            "name": req["name"],
            "in": loc,
            "required": bool(req.get("required")),
            "schema": schema,
        }
        if req.get("description"):
            entry["description"] = req["description"]
        params.append(entry)
    return params


def convert_schema(node: Any) -> dict[str, Any]:
    """Convert inferred JSON schema to OpenAPI-compatible schema."""
    if not isinstance(node, dict):
        return {"type": "string"}

    t = node.get("type", "string")
    if t in ("...", "unknown"):
        return {"type": "object", "additionalProperties": True}

    if t == "object":
        props = node.get("properties", {})
        result: dict[str, Any] = {"type": "object", "properties": {}}
        for k, v in props.items():
            if k == "...":
                result["additionalProperties"] = True
                continue
            result["properties"][k] = convert_schema(v)
        return result

    if t == "array":
        items = node.get("items", {"type": "object"})
        return {"type": "array", "items": convert_schema(items)}

    if t == "null":
        return {"type": "string", "nullable": True}

    return {"type": t}


def operation_id(method: str, oa_path: str) -> str:
    slug = re.sub(r"[{}]", "", oa_path).strip("/").replace("/", "_").replace("-", "_")
    slug = re.sub(r"[^a-zA-Z0-9_]", "_", slug)
    slug = re.sub(r"_+", "_", slug).strip("_") or "root"
    return f"{method.lower()}_{slug}"


def build_openapi(
    all_apis: list[dict[str, Any]],
    probed: dict[tuple[str, str], dict[str, Any]],
) -> dict[str, Any]:
    paths: dict[str, dict[str, Any]] = defaultdict(dict)
    tags: set[str] = set()

    for api in all_apis:
        method = api["method"].upper()
        if method == "WS":
            continue

        template = api["path"]
        oa_path, default_params = path_template_to_openapi(template)
        tag = oa_path.strip("/").split("/")[0] or "general"
        tags.add(tag)

        probe = probed.get((template, method))
        params = default_params
        if probe and probe.get("input_requirements"):
            params = probe_params_to_openapi(probe["input_requirements"])

        op: dict[str, Any] = {
            "tags": [tag],
            "summary": f"{method} {template}",
            "operationId": operation_id(method, oa_path),
            "parameters": params,
            "responses": {
                "200": {
                    "description": "Successful response",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/ErpResponse"}
                        }
                    },
                },
                "400": {"description": "Bad request"},
                "401": {"description": "Unauthorized"},
                "403": {"description": "Forbidden"},
                "404": {"description": "Not found"},
                "500": {"description": "Server error"},
            },
            "security": [{"bearerAuth": []}],
        }

        if probe:
            op["x-probed"] = True
            op["x-tested-url"] = probe.get("tested_url")
            if probe.get("output_format"):
                schema = convert_schema(probe["output_format"])
                op["responses"]["200"]["content"]["application/json"]["schema"] = schema
            if probe.get("sample_response") is not None:
                op["responses"]["200"]["content"]["application/json"]["example"] = probe[
                    "sample_response"
                ]
        else:
            op["x-probed"] = False

        if method == "GET":
            paths[oa_path]["get"] = op
        elif method == "POST":
            paths[oa_path]["post"] = {
                **op,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"type": "object", "additionalProperties": True}
                        }
                    },
                },
            }
        elif method == "PUT":
            paths[oa_path]["put"] = {
                **op,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"type": "object", "additionalProperties": True}
                        }
                    },
                },
            }
        elif method == "PATCH":
            paths[oa_path]["patch"] = {
                **op,
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"type": "object", "additionalProperties": True}
                        }
                    },
                },
            }
        elif method == "DELETE":
            paths[oa_path]["delete"] = op

    spec: dict[str, Any] = {
        "openapi": "3.0.3",
        "info": {
            "title": "101 Distributors GA ERP API",
            "description": (
                "Auto-generated OpenAPI specification from the ERP frontend bundle (`erp-all.js`).\n\n"
                "GET endpoints marked `x-probed: true` were tested against the live server and include "
                "sample responses and inferred schemas. Other endpoints are extracted from the bundle only.\n\n"
                "**Authentication:** Bearer JWT token (employee login via `/authenticate`)."
            ),
            "version": "1.0.0",
            "contact": {"name": "101 Distributors GA ERP"},
        },
        "servers": [{"url": BASE_URL, "description": "Production ERP API"}],
        "tags": [{"name": t, "description": f"{t} endpoints"} for t in sorted(tags)],
        "paths": dict(sorted(paths.items())),
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "Employee access token from POST /authenticate",
                }
            },
            "schemas": {
                "ErpResponse": {
                    "type": "object",
                    "description": "Standard ERP API wrapper",
                    "properties": {
                        "hasError": {"type": "boolean"},
                        "status": {"type": "integer"},
                        "result": {"type": "object", "additionalProperties": True},
                        "error": {
                            "type": "object",
                            "properties": {"message": {"type": "string"}},
                        },
                    },
                },
                "ErrorResponse": {
                    "type": "object",
                    "properties": {
                        "hasError": {"type": "boolean", "example": True},
                        "status": {"type": "integer"},
                        "error": {
                            "type": "object",
                            "properties": {"message": {"type": "string"}},
                        },
                    },
                },
            },
        },
        "security": [{"bearerAuth": []}],
    }
    return spec


def load_probed(path: Path) -> dict[tuple[str, str], dict[str, Any]]:
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    apis = data.get("apis") or data.get("working_apis") or []
    return {(a["path_template"], a["method"].upper()): a for a in apis}


def write_yaml(spec: dict[str, Any], path: Path) -> None:
    if yaml is None:
        # Minimal YAML writer fallback for openapi without PyYAML
        path.write_text(json.dumps(spec, indent=2), encoding="utf-8")
        return
    path.write_text(yaml.dump(spec, sort_keys=False, allow_unicode=True, width=120), encoding="utf-8")


def write_swagger_ui(docs_dir: Path) -> None:
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>101 Distributors GA ERP API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "./openapi.yaml",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIStandalonePreset,
      ],
      plugins: [SwaggerUIBundle.plugins.DownloadUrl],
      layout: "StandaloneLayout",
    });
  </script>
</body>
</html>
"""
    (docs_dir / "index.html").write_text(html, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate OpenAPI spec for ERP APIs.")
    parser.add_argument("--apis", default=str(ROOT / "erp-apis.json"))
    parser.add_argument("--probed", default=str(ROOT / "erp-get-apis-working.json"))
    parser.add_argument("--out-dir", default=str(DOCS_DIR))
    args = parser.parse_args()

    all_apis = json.loads(Path(args.apis).read_text(encoding="utf-8"))
    probed = load_probed(Path(args.probed))
    spec = build_openapi(all_apis, probed)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "openapi.json"
    yaml_path = out_dir / "openapi.yaml"

    json_path.write_text(json.dumps(spec, indent=2, ensure_ascii=False), encoding="utf-8")

    if yaml is not None:
        write_yaml(spec, yaml_path)
    else:
        # Duplicate JSON as fallback; install PyYAML for real YAML
        import shutil
        shutil.copy(json_path, yaml_path)
        print("Note: PyYAML not installed; openapi.yaml is JSON format. Run: pip install pyyaml")

    write_swagger_ui(out_dir)

    probed_ops = sum(
        1
        for p in spec["paths"].values()
        for op in p.values()
        if isinstance(op, dict) and op.get("x-probed")
    )
    print(f"OpenAPI spec generated:")
    print(f"  Paths: {len(spec['paths'])}")
    print(f"  Probed operations documented: {probed_ops}")
    print(f"  {json_path}")
    print(f"  {yaml_path}")
    print(f"  {out_dir / 'index.html'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
