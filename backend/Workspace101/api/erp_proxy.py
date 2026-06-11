"""Authenticated pass-through proxy to the Salesgent ERP API."""

import logging
import secrets
from typing import Optional

import requests
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from rest_framework.permissions import BasePermission
from rest_framework.views import APIView

from api.models import ErpProxyApiKey, SalesgentToken

logger = logging.getLogger(__name__)

ERP_BASE = "https://erp.101distributorsga.com"
FORWARD_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}


def _extract_api_key(request) -> Optional[str]:
    header = request.headers.get("X-API-Key", "").strip()
    if header:
        return header

    auth = request.headers.get("Authorization", "").strip()
    if auth.lower().startswith("api-key "):
        return auth[8:].strip()
    return None


class ErpProxyApiKeyPermission(BasePermission):
    message = "Valid API key required. Send X-API-Key or Authorization: Api-Key <key>."

    def has_permission(self, request, view):
        raw_key = _extract_api_key(request)
        if not raw_key:
            return False

        api_key = ErpProxyApiKey.objects.filter(key=raw_key, is_active=True).first()
        if not api_key:
            return False

        ErpProxyApiKey.objects.filter(pk=api_key.pk).update(last_used_at=timezone.now())
        request.erp_proxy_api_key = api_key
        return True


def _get_salesgent_token() -> str:
    entry = SalesgentToken.objects.filter(id=1).first()
    return entry.accessToken if entry else ""


def _build_erp_url(route: str) -> str:
    route = route.lstrip("/")
    if route.startswith("api/"):
        path = f"/{route}"
    else:
        path = f"/api/{route}"
    return f"{ERP_BASE}{path}"


def _erp_headers(referer_path: str = "/product") -> dict:
    token = _get_salesgent_token()
    referer = referer_path if referer_path.startswith("http") else f"{ERP_BASE}{referer_path}"
    return {
        "Accept": "application/json, text/plain",
        "Accept-Language": "en-US,en;q=0.9",
        "Authorization": f"Bearer {token}",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "application/json",
        "Pragma": "no-cache",
        "Referer": referer,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
        ),
        "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }


class ErpProxyView(APIView):
    """
    Pass-through proxy to Salesgent ERP.

    Clients call ``/api/proxy/<route>`` with an API key created in Django admin.
    The route is forwarded to ``https://erp.101distributorsga.com/api/<route>``
    (or ``/api/`` is skipped if the route already starts with ``api/``).
    The raw ERP JSON response is returned unchanged.
    """

    permission_classes = [ErpProxyApiKeyPermission]
    authentication_classes = []

    def _proxy(self, request, route: str):
        if request.method not in FORWARD_METHODS:
            return JsonResponse({"error": "Method not allowed"}, status=405)

        token = _get_salesgent_token()
        if not token:
            return JsonResponse(
                {"error": "ERP token not configured. Sync Salesgent token first."},
                status=503,
            )

        erp_url = _build_erp_url(route)
        referer = request.headers.get("X-ERP-Referer", "/product")
        headers = _erp_headers(referer)

        body = request.body if request.method in {"POST", "PUT", "PATCH"} else None
        if body:
            headers["Content-Length"] = str(len(body))

        try:
            erp_response = requests.request(
                method=request.method,
                url=erp_url,
                headers=headers,
                params=request.GET,
                data=body,
                timeout=120,
            )
        except requests.RequestException as exc:
            logger.exception("ERP proxy request failed: %s %s", request.method, erp_url)
            return JsonResponse({"error": f"ERP request failed: {exc}"}, status=502)

        content_type = erp_response.headers.get("Content-Type", "application/json")
        response = HttpResponse(
            erp_response.content,
            status=erp_response.status_code,
            content_type=content_type,
        )
        response["Access-Control-Allow-Origin"] = "*"
        return response

    def get(self, request, route):
        return self._proxy(request, route)

    def post(self, request, route):
        return self._proxy(request, route)

    def put(self, request, route):
        return self._proxy(request, route)

    def patch(self, request, route):
        return self._proxy(request, route)

    def delete(self, request, route):
        return self._proxy(request, route)

    def head(self, request, route):
        return self._proxy(request, route)

    def options(self, request, route):
        response = HttpResponse(status=204)
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD"
        response["Access-Control-Allow-Headers"] = "X-API-Key, Authorization, Content-Type, X-ERP-Referer"
        return response


def generate_proxy_api_key() -> str:
    return secrets.token_urlsafe(32)
