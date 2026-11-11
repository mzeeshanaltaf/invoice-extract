"""Mint a local test JWT for curl / manual testing. NEVER use against production.

    python scripts/mint_token.py --user test_user_1

First run creates an Ed25519 keypair in backend/.devkeys/ (gitignored). Start the API with
JWT_DEV_PUBLIC_KEY_FILE=.devkeys/public.pem so it trusts tokens minted here (the setting is
refused when ENVIRONMENT=production). Issuer and audience default to BETTER_AUTH_URL, exactly
what the Better Auth jwt() plugin issues.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

BACKEND = Path(__file__).resolve().parent.parent
KEYDIR = BACKEND / ".devkeys"
sys.path.insert(0, str(BACKEND))


def load_or_create_key() -> Ed25519PrivateKey:
    KEYDIR.mkdir(exist_ok=True)
    priv_path, pub_path = KEYDIR / "private.pem", KEYDIR / "public.pem"
    if priv_path.exists():
        return serialization.load_pem_private_key(priv_path.read_bytes(), password=None)  # type: ignore[return-value]
    key = Ed25519PrivateKey.generate()
    priv_path.write_bytes(
        key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    )
    pub_path.write_bytes(key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
    return key


def mint(user: str, minutes: int = 60) -> str:
    from app.config import settings

    now = int(time.time())
    claims = {"sub": user, "iss": settings.jwt_issuer, "aud": settings.jwt_audience, "iat": now, "exp": now + minutes * 60}
    return jwt.encode(claims, load_or_create_key(), algorithm="EdDSA", headers={"kid": "dev-key"})


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", default="test_user_1", help="becomes the JWT `sub` (the user_id)")
    ap.add_argument("--minutes", type=int, default=60)
    a = ap.parse_args()
    print(mint(a.user, a.minutes))
