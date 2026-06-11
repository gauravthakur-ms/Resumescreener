"""
Azure AD JWT token validation middleware for Azure Functions.
Validates Bearer tokens from the frontend against the backend app registration.
"""
import os
import json
import logging
import urllib.request
from functools import wraps

import jwt
from jwt import PyJWKClient
import azure.functions as func

logger = logging.getLogger(__name__)

# Configuration from environment
TENANT_ID = os.environ.get("AZURE_AD_TENANT_ID", "")
CLIENT_ID = os.environ.get("AZURE_AD_CLIENT_ID", "")  # Backend app registration client ID
AUDIENCE = os.environ.get("AZURE_AD_AUDIENCE", CLIENT_ID)
ENABLE_AUTH = os.environ.get("ENABLE_AUTH", "true").lower() == "true"

ISSUER = f"https://login.microsoftonline.com/{TENANT_ID}/v2.0"
JWKS_URL = f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"

# Cache the JWKS client
_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(JWKS_URL)
    return _jwks_client


def validate_token(auth_header: str) -> dict:
    """
    Validate a Bearer token and return decoded claims.
    Raises ValueError on invalid tokens.
    """
    if not auth_header or not auth_header.startswith("Bearer "):
        raise ValueError("Missing or invalid Authorization header")

    token = auth_header.split(" ", 1)[1]

    jwks_client = _get_jwks_client()
    signing_key = jwks_client.get_signing_key_from_jwt(token)

    decoded = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=AUDIENCE,
        issuer=ISSUER,
        options={"verify_exp": True},
    )
    return decoded


def get_user_id(req: func.HttpRequest) -> str:
    """Extract the user_id (Azure AD object ID) from a validated request.
    
    Returns the 'oid' claim from the JWT token. Falls back to 'sub' claim.
    When auth is disabled (local dev), returns a default dev user ID.
    """
    if not ENABLE_AUTH:
        return "dev-user-local"
    
    claims = getattr(req, "_user_claims", None)
    if not claims:
        return "anonymous"
    return claims.get("oid") or claims.get("sub") or "anonymous"


def require_auth(func_handler):
    """
    Decorator for Azure Function HTTP triggers that enforces Azure AD authentication.
    Skips validation when ENABLE_AUTH is false (for local development).
    """
    @wraps(func_handler)
    def wrapper(req: func.HttpRequest, *args, **kwargs):
        if not ENABLE_AUTH:
            return func_handler(req, *args, **kwargs)

        auth_header = req.headers.get("Authorization", "")
        try:
            claims = validate_token(auth_header)
            # Attach claims to request for downstream use
            req._user_claims = claims
        except Exception as e:
            logger.warning(f"Auth failed: {e}")
            return func.HttpResponse(
                json.dumps({"error": "Unauthorized", "detail": str(e)}),
                status_code=401,
                mimetype="application/json",
            )

        return func_handler(req, *args, **kwargs)

    return wrapper
