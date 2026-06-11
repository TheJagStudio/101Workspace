#!/usr/bin/env python3
"""
Extract API endpoints from minified ERP JavaScript (erp-all.js).

Handles patterns found in the bundle:
  - url: "/path"  and  url: "/path/".concat(var, "?q=").concat(n)
  - await client.get/post/put/patch/delete("/path", ...)
  - WebSocket paths like /api/ws-app
  - method: "GET" paired with url in the same config object
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent

HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}

# Paths that look like frontend routes or static assets, not REST APIs.
SKIP_PATH_PREFIXES = (
    "/favicon",
    "/static/",
    "/assets/",
)
SKIP_PATH_SUFFIXES = (
    ".ico",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".css",
    ".js",
    ".woff",
    ".woff2",
)


@dataclass(frozen=True)
class ApiEndpoint:
    method: str
    path: str
    line: int
    source: str
    raw: str

    def key(self) -> tuple[str, str]:
        return (self.method.upper(), self.path)


@dataclass
class ExtractionResult:
    endpoints: list[ApiEndpoint] = field(default_factory=list)

    def deduplicated(self) -> list[ApiEndpoint]:
        seen: dict[tuple[str, str], ApiEndpoint] = {}
        for ep in sorted(self.endpoints, key=lambda e: (e.path, e.method, e.line)):
            k = ep.key()
            if k not in seen:
                seen[k] = ep
        return list(seen.values())


def split_concat_args(args_str: str) -> list[str]:
    """Split comma-separated .concat() arguments, respecting nested parens."""
    args: list[str] = []
    current: list[str] = []
    depth = 0
    for ch in args_str:
        if ch == "(":
            depth += 1
            current.append(ch)
        elif ch == ")":
            depth -= 1
            current.append(ch)
        elif ch == "," and depth == 0:
            args.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    if current:
        args.append("".join(current).strip())
    return args


def normalize_path_expression(raw: str) -> str | None:
    """
    Turn a JS path expression into a normalized template path.
    Examples:
      "/authenticate"                         -> /authenticate
      "/role/".concat(t, "/update")           -> /role/{param}/update
      "".concat(n, "/api/invoice/scan")       -> /api/invoice/scan
      "product/image?x=".concat(t)            -> /product/image?x={param}
    """
    expr = raw.strip()
    if not expr:
        return None

    result = ""

    # Leading string literal
    str_match = re.match(r'^["\']([^"\']*)["\']', expr)
    if str_match:
        result += str_match.group(1)
        expr = expr[str_match.end() :]

    # Process .concat(...) chains
    while True:
        concat_match = re.search(r"\.concat\(([^)]*)\)", expr)
        if not concat_match:
            break
        for arg in split_concat_args(concat_match.group(1)):
            arg = arg.strip()
            lit = re.fullmatch(r'["\']([^"\']*)["\']', arg)
            if lit:
                result += lit.group(1)
            elif arg:
                result += "{param}"
        expr = expr[concat_match.end() :]

    # Remaining plain literal (no concat)
    if not result:
        lit = re.fullmatch(r'["\']([^"\']*)["\']', raw.strip())
        if lit:
            result = lit.group(1)

    if not result:
        return None

    # Ensure API-style leading slash (bundle sometimes omits it)
    if not result.startswith("/") and not result.startswith("{"):
        if "?" in result or "/" in result:
            result = "/" + result

    # Collapse duplicate slashes (except after protocol)
    result = re.sub(r"/{2,}", "/", result)
    return result


def is_likely_api_path(path: str) -> bool:
    if not path or path in ("/", "*"):
        return False
    if len(path) < 2:
        return False
    # Real API paths are absolute; skip validation messages and format strings
    if not path.startswith("/"):
        return False
    if any(ch in path for ch in (" ", "${", "%s", "\n", "\t")):
        return False
    if any(path.startswith(p) for p in SKIP_PATH_PREFIXES):
        return False
    if any(path.endswith(s) for s in SKIP_PATH_SUFFIXES):
        return False
    # Skip bare template placeholders
    if path in ("{param}", "/{param}"):
        return False
    # Must contain at least one letter (filters symbols-only noise)
    if not re.search(r"[A-Za-z]", path):
        return False
    return True


def find_method_near(text: str, url_pos: int) -> str:
    """Look for method: "..." within ~400 chars of a url: occurrence."""
    window_start = max(0, url_pos - 400)
    window_end = min(len(text), url_pos + 400)
    window = text[window_start:window_end]

    methods_found: list[tuple[int, str]] = []
    for m in re.finditer(
        r'method:\s*(?:\([^)]+\)\s*\?\s*)?["\'](\w+)["\']',
        window,
        re.IGNORECASE,
    ):
        methods_found.append((window_start + m.start(), m.group(1).upper()))

    if not methods_found:
        return "GET"

    # Prefer method closest to url position
    methods_found.sort(key=lambda item: abs(item[0] - url_pos))
    return methods_found[0][1]


def extract_url_config_objects(content: str) -> Iterable[ApiEndpoint]:
    """Extract url: "..." entries from API config objects."""
    for m in re.finditer(
        r'url:\s*((?:["\'][^"\']*["\']|""\.concat\([^)]+\))(?:\.concat\([^)]+\))*)',
        content,
    ):
        raw = m.group(1)
        path = normalize_path_expression(raw)
        if not path or not is_likely_api_path(path):
            continue

        # Skip when this is a frontend router link (to:, not url:)
        line_start = content.rfind("\n", 0, m.start()) + 1
        line_prefix = content[line_start : m.start()]
        if re.search(r"\bto:\s*$", line_prefix):
            continue

        line_no = content.count("\n", 0, m.start()) + 1
        method = find_method_near(content, m.start())

        yield ApiEndpoint(
            method=method,
            path=path,
            line=line_no,
            source="url_config",
            raw=raw[:200],
        )


def extract_direct_http_calls(content: str) -> Iterable[ApiEndpoint]:
    """
    Extract patterns like:
      .get("/path")
      .post("/path/".concat(id), body, ...)

    Requires a leading slash in the first literal segment to avoid matching
    DOM/cache .get() calls (e.g. .get("*")).
    """
    pattern = re.compile(
        r"\.(get|post|put|patch|delete)\(\s*"
        r'((?:"/[^"]*"|\'/[^\']*\'|""\.concat\([^)]+\))(?:\.concat\([^)]+\))*)',
        re.IGNORECASE,
    )
    for m in pattern.finditer(content):
        method = m.group(1).upper()
        raw = m.group(2)
        path = normalize_path_expression(raw)
        if not path or not is_likely_api_path(path):
            continue

        line_no = content.count("\n", 0, m.start()) + 1
        yield ApiEndpoint(
            method=method,
            path=path,
            line=line_no,
            source="direct_call",
            raw=raw[:200],
        )


def extract_websocket_paths(content: str) -> Iterable[ApiEndpoint]:
    for m in re.finditer(
        r'new\s+\w+\.a\(\s*["\'](/api/[^"\']+)["\']',
        content,
    ):
        path = m.group(1)
        line_no = content.count("\n", 0, m.start()) + 1
        yield ApiEndpoint(
            method="WS",
            path=path,
            line=line_no,
            source="websocket",
            raw=path,
        )


def extract_apis_from_file(file_path: Path) -> ExtractionResult:
    content = file_path.read_text(encoding="utf-8", errors="replace")
    result = ExtractionResult()

    for extractor in (
        extract_url_config_objects,
        extract_direct_http_calls,
        extract_websocket_paths,
    ):
        result.endpoints.extend(extractor(content))

    return result


def write_json(endpoints: list[ApiEndpoint], out_path: Path) -> None:
    payload = [
        {
            "method": ep.method,
            "path": ep.path,
            "line": ep.line,
            "source": ep.source,
            "raw": ep.raw,
        }
        for ep in sorted(endpoints, key=lambda e: (e.path, e.method))
    ]
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_csv(endpoints: list[ApiEndpoint], out_path: Path) -> None:
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["method", "path", "line", "source"])
        writer.writeheader()
        for ep in sorted(endpoints, key=lambda e: (e.path, e.method)):
            writer.writerow(
                {"method": ep.method, "path": ep.path, "line": ep.line, "source": ep.source}
            )


def write_markdown(endpoints: list[ApiEndpoint], out_path: Path) -> None:
    by_method: dict[str, list[str]] = defaultdict(list)
    for ep in endpoints:
        by_method[ep.method].append(ep.path)

    lines = ["# ERP API Endpoints", "", f"Total unique endpoints: **{len(endpoints)}**", ""]
    for method in sorted(by_method.keys()):
        paths = sorted(set(by_method[method]))
        lines.append(f"## {method} ({len(paths)})")
        lines.append("")
        for path in paths:
            lines.append(f"- `{method}` `{path}`")
        lines.append("")

    out_path.write_text("\n".join(lines), encoding="utf-8")


def print_summary(endpoints: list[ApiEndpoint], total_raw: int) -> None:
    by_method: dict[str, int] = defaultdict(int)
    by_source: dict[str, int] = defaultdict(int)
    for ep in endpoints:
        by_method[ep.method] += 1
        by_source[ep.source] += 1

    print(f"Raw matches:  {total_raw}")
    print(f"Unique APIs:  {len(endpoints)}")
    print("\nBy method:")
    for method, count in sorted(by_method.items()):
        print(f"  {method:8} {count}")
    print("\nBy source:")
    for source, count in sorted(by_source.items()):
        print(f"  {source:14} {count}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Extract API endpoints from ERP JavaScript bundle (erp-all.js)."
    )
    parser.add_argument(
        "input",
        nargs="?",
        default=str(ROOT / "erp-all.js"),
        help="Path to erp-all.js (default: erpAPI/erp-all.js)",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default=str(ROOT),
        help="Directory for output files (default: current directory)",
    )
    parser.add_argument(
        "--json",
        default="erp-apis.json",
        help="JSON output filename (default: erp-apis.json)",
    )
    parser.add_argument(
        "--csv",
        default="erp-apis.csv",
        help="CSV output filename (default: erp-apis.csv)",
    )
    parser.add_argument(
        "--md",
        default="erp-apis.md",
        help="Markdown output filename (default: erp-apis.md)",
    )
    parser.add_argument(
        "--no-files",
        action="store_true",
        help="Only print summary to stdout, do not write output files",
    )
    args = parser.parse_args(argv)

    input_path = Path(args.input)
    if not input_path.is_file():
        print(f"Error: file not found: {input_path}", file=sys.stderr)
        return 1

    result = extract_apis_from_file(input_path)
    unique = result.deduplicated()
    print_summary(unique, len(result.endpoints))

    if not args.no_files:
        out_dir = Path(args.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        write_json(unique, out_dir / args.json)
        write_csv(unique, out_dir / args.csv)
        write_markdown(unique, out_dir / args.md)
        print(f"\nWrote:")
        print(f"  {out_dir / args.json}")
        print(f"  {out_dir / args.csv}")
        print(f"  {out_dir / args.md}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
