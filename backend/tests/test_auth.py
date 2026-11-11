import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import jwt
import pytest
from jwt.algorithms import OKPAlgorithm

from app import auth
from app.config import settings
from app.errors import ApiError
from tests.conftest import mint


async def test_valid_token_gets_through_and_creates_account(client, headers):
    r = await client.get("/v1/credits", headers=headers("user_a"))
    assert r.status_code == 200
    assert r.json()["current_balance"] == settings.SIGNUP_CREDITS


async def test_missing_and_malformed_header(client):
    assert (await client.get("/v1/credits")).status_code == 401
    r = await client.get("/v1/credits", headers={"Authorization": "Token abc"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


async def test_garbage_token(client):
    r = await client.get("/v1/credits", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "INVALID_TOKEN"


async def test_bad_signature(client, keypair):
    token = mint(keypair["other"], "user_a")  # signed by a key the verifier does not trust
    r = await client.get("/v1/credits", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "INVALID_TOKEN"


async def test_expired(client, keypair):
    token = mint(keypair["private"], "user_a", exp_in=-120)
    r = await client.get("/v1/credits", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "TOKEN_EXPIRED"


async def test_wrong_issuer_and_audience(client, keypair):
    for kw in ({"iss": "http://evil.example"}, {"aud": "http://other.example"}):
        token = mint(keypair["private"], "user_a", **kw)
        r = await client.get("/v1/credits", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401, kw


async def test_missing_required_claims(client, keypair):
    token = jwt.encode({"sub": "user_a"}, keypair["private"], algorithm="EdDSA")
    r = await client.get("/v1/credits", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


async def test_alg_none_rejected(client):
    token = jwt.encode({"sub": "user_a", "iss": settings.jwt_issuer, "aud": settings.jwt_audience, "exp": 9999999999}, None, algorithm="none")
    r = await client.get("/v1/credits", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


@pytest.mark.parametrize("sub", ["../etc", "a/b", "", "x" * 200, "a b"])
async def test_unsafe_subject_rejected(client, keypair, sub):
    token = mint(keypair["private"], sub)
    r = await client.get("/v1/credits", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


async def test_jwks_endpoint_flow(keypair, monkeypatch):
    """Verify through a real JWKS fetch (OKP/Ed25519 key, as Better Auth publishes)."""
    jwk = json.loads(OKPAlgorithm.to_jwk(keypair["private"].public_key()))
    jwk.update({"kid": "test-key", "alg": "EdDSA", "use": "sig"})
    body = json.dumps({"keys": [jwk]}).encode()

    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):
            pass

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        monkeypatch.setattr(settings, "JWT_DEV_PUBLIC_KEY_FILE", "")
        monkeypatch.setattr(settings, "JWT_JWKS_URL", f"http://127.0.0.1:{srv.server_port}/api/auth/jwks")
        auth.reset_auth_state()
        assert await auth.verify_token(mint(keypair["private"], "user_jwks")) == "user_jwks"
        with pytest.raises(ApiError):
            await auth.verify_token(mint(keypair["other"], "user_jwks"))  # same kid, wrong signature
    finally:
        srv.shutdown()


def test_dev_key_refused_in_production(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    auth.reset_auth_state()
    with pytest.raises(RuntimeError):
        auth._signing_key("x.y.z")
