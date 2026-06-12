"""
Middleware to add Content-Security-Policy (CSP) and Strict-Transport-Security (HSTS)
headers to all responses.
"""

# CSP policy: restricts which resources the browser is allowed to load.
# Adjust sources as needed when adding new external services.
CSP_DIRECTIVES = {
    "default-src": "'self'",
    "script-src": "'self'",
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: https:",
    "font-src": "'self' data:",
    "connect-src": "'self' https://workspace.101distributors.com https://purityai-typesense.hf.space https://thejagstudio-typesense.hf.space https://thejagstudio-ntfy.hf.space https://*.supabase.co https://*.supabase.in",
    "frame-ancestors": "'self'",
    "base-uri": "'self'",
    "form-action": "'self'",
}


class SecurityHeadersMiddleware:
    """Adds CSP and HSTS headers to every response passing through Django."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Build CSP header value
        csp_value = "; ".join(
            f"{directive} {sources}" for directive, sources in CSP_DIRECTIVES.items()
        )
        response["Content-Security-Policy"] = csp_value

        # HSTS — tell browsers to only use HTTPS for 1 year, including subdomains
        # Only send HSTS over actual HTTPS connections
        if request.is_secure():
            response["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Permissions-Policy (formerly Feature-Policy) — restrict browser features
        response["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(self), payment=()"
        )

        return response
