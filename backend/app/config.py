"""All tunables, from the environment (or backend/.env for local development)."""

from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENVIRONMENT: str = "development"  # "production" disables every dev/test auth shortcut

    # --- OpenAI -------------------------------------------------------------
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-6-luna"
    OPENAI_SERVICE_TIER: str = "flex"  # empty = default tier
    OPENAI_FLEX_FALLBACK_TIER: str = "default"  # used after flex retries; empty disables
    OPENAI_REASONING_EFFORT: str = "low"
    OPENAI_DECISIONS_MODEL: str = "gpt-6-luna"
    OPENAI_DECISIONS_SERVICE_TIER: str = ""  # Decisions API lists no tiers; unused unless set
    OPENAI_TIMEOUT_SECONDS: float = 900
    OPENAI_FLEX_MAX_RETRIES: int = 3  # attempts on the primary tier before falling back
    OPENAI_BACKOFF_BASE_SECONDS: float = 5
    OPENAI_BACKOFF_MAX_SECONDS: float = 120

    # --- Gate ---------------------------------------------------------------
    INVOICE_MIN_PROBABILITY: float = 0.5
    LEGIBILITY_MIN_SCORE: float = 1.0  # score runs 0 (unreadable) .. 3 (good)

    # --- Limits -------------------------------------------------------------
    MAX_FILE_MB: int = 10
    MAX_PDF_PAGES: int = 10
    MAX_IMAGE_PIXELS: int = 40_000_000
    MAX_FILES_PER_UPLOAD: int = 10
    MAX_INFLIGHT_PER_USER: int = 10
    UPLOADS_PER_HOUR: int = 30
    SIGNUP_CREDITS: int = 5
    EXPORT_MAX_DOCS: int = 200
    DELETE_MAX_IDS: int = 100

    # --- Rendering ----------------------------------------------------------
    RENDER_DPI: int = 150
    RENDER_MAX_EDGE: int = 2000
    TEXT_HINT_MAX_CHARS: int = 20_000

    # --- Web ----------------------------------------------------------------
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    BETTER_AUTH_URL: str = "http://localhost:3000"
    ADMIN_API_KEY: str = ""

    # --- JWT ----------------------------------------------------------------
    JWT_JWKS_URL: str = ""  # default <BETTER_AUTH_URL>/api/auth/jwks
    JWT_ISSUER: str = ""  # default BETTER_AUTH_URL (Better Auth jwt() plugin default)
    JWT_AUDIENCE: str = ""  # default BETTER_AUTH_URL
    JWT_ALGORITHMS: str = "EdDSA,RS256,ES256"
    JWT_LEEWAY_SECONDS: int = 10
    # Local testing only: path to a PEM public key. Ignored (and startup refused) in production.
    JWT_DEV_PUBLIC_KEY_FILE: str = ""

    # --- Database -----------------------------------------------------------
    DATABASE_URL: str = "postgresql+asyncpg://postgres:devpass@127.0.0.1:5434/invoicextract"
    DB_SCHEMA: str = "invoice_extract"

    # --- Storage ------------------------------------------------------------
    STORAGE_DRIVER: str = "local"  # local | s3
    STORAGE_LOCAL_DIR: str = "./.storage"
    S3_ENDPOINT: str = ""
    S3_BUCKET: str = "invoicextract"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = "us-east-1"

    # --- Email-in -----------------------------------------------------------
    INBOUND_EMAIL_DOMAIN: str = ""
    RESEND_API_KEY: str = ""
    RESEND_WEBHOOK_SECRET: str = ""
    RESEND_FROM_EMAIL: str = ""
    INBOUND_MAX_ATTACHMENTS: int = 5
    INBOUND_EMAILS_PER_DAY: int = 20
    INBOUND_MIN_IMAGE_BYTES: int = 15_000
    INBOUND_MIN_IMAGE_EDGE: int = 300

    # --- Retention ----------------------------------------------------------
    RETENTION_CHOICES_DAYS: str = "7,30,90"
    RETENTION_SWEEP_MINUTES: int = 60
    ORPHAN_MIN_AGE_MINUTES: int = 60

    # --- Worker -------------------------------------------------------------
    WORKER_ENABLED: bool = True
    WORKER_CONCURRENCY: int = 2
    WORKER_POLL_SECONDS: float = 2.0
    MAX_ATTEMPTS: int = 3

    @field_validator("DATABASE_URL")
    @classmethod
    def _async_driver(cls, v: str) -> str:
        # The Next.js app uses a plain postgres:// URL; accept it and switch to asyncpg.
        for prefix in ("postgresql://", "postgres://"):
            if v.startswith(prefix):
                return "postgresql+asyncpg://" + v[len(prefix) :]
        return v

    # ---- derived helpers ----
    @property
    def max_file_bytes(self) -> int:
        return self.MAX_FILE_MB * 1024 * 1024

    @property
    def max_upload_request_bytes(self) -> int:
        return self.max_file_bytes * self.MAX_FILES_PER_UPLOAD + 1024 * 1024

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def retention_choices(self) -> list[int]:
        return [int(x) for x in self.RETENTION_CHOICES_DAYS.split(",") if x.strip()]

    @property
    def jwt_issuer(self) -> str:
        return (self.JWT_ISSUER or self.BETTER_AUTH_URL).rstrip("/")

    @property
    def jwt_audience(self) -> str:
        return (self.JWT_AUDIENCE or self.BETTER_AUTH_URL).rstrip("/")

    @property
    def jwt_jwks_url(self) -> str:
        return self.JWT_JWKS_URL or f"{self.BETTER_AUTH_URL.rstrip('/')}/api/auth/jwks"

    @property
    def jwt_algorithms(self) -> list[str]:
        return [a.strip() for a in self.JWT_ALGORITHMS.split(",") if a.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
