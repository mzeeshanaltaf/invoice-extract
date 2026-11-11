"""Object storage for source files. Local filesystem driver for dev, S3/MinIO for production.

Keys look like ``{user_id}/{document_id}/original.{ext}``. Bytes never enter Postgres.
"""

from __future__ import annotations

import asyncio
import logging
import shutil
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from app.config import settings

log = logging.getLogger(__name__)

CHUNK = 64 * 1024


@dataclass
class StoredObject:
    key: str
    last_modified: datetime


class Storage(Protocol):
    def put(self, key: str, data: bytes, content_type: str) -> None: ...
    def get(self, key: str) -> bytes: ...
    def stream(self, key: str) -> Iterator[bytes]: ...
    def exists(self, key: str) -> bool: ...
    def delete(self, key: str) -> None: ...
    def delete_prefix(self, prefix: str) -> int: ...
    def list_objects(self) -> Iterator[StoredObject]: ...


def build_key(user_id: str, document_id: str, ext: str) -> str:
    return f"{user_id}/{document_id}/original.{ext}"


class LocalStorage:
    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if self.root not in p.parents:
            raise ValueError("invalid storage key")
        return p

    def put(self, key: str, data: bytes, content_type: str) -> None:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    def get(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def stream(self, key: str) -> Iterator[bytes]:
        with self._path(key).open("rb") as f:
            while chunk := f.read(CHUNK):
                yield chunk

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def delete(self, key: str) -> None:
        p = self._path(key)
        p.unlink(missing_ok=True)
        # prune the now-empty document directory, then the user directory
        for parent in (p.parent, p.parent.parent):
            try:
                if parent != self.root:
                    parent.rmdir()
            except OSError:
                break

    def delete_prefix(self, prefix: str) -> int:
        base = self._path(prefix.rstrip("/"))
        if not base.exists():
            return 0
        count = sum(1 for f in base.rglob("*") if f.is_file())
        shutil.rmtree(base, ignore_errors=True)
        return count

    def list_objects(self) -> Iterator[StoredObject]:
        for f in self.root.rglob("*"):
            if f.is_file():
                yield StoredObject(
                    key=f.relative_to(self.root).as_posix(),
                    last_modified=datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc),
                )


class S3Storage:
    def __init__(self) -> None:
        import boto3
        from botocore.config import Config

        self.bucket = settings.S3_BUCKET
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT or None,
            aws_access_key_id=settings.S3_ACCESS_KEY or None,
            aws_secret_access_key=settings.S3_SECRET_KEY or None,
            region_name=settings.S3_REGION,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}, retries={"max_attempts": 3}),
        )

    def ensure_bucket(self) -> None:
        from botocore.exceptions import ClientError

        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError:
            self.client.create_bucket(Bucket=self.bucket)

    def put(self, key: str, data: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def get(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def stream(self, key: str) -> Iterator[bytes]:
        body = self.client.get_object(Bucket=self.bucket, Key=key)["Body"]
        try:
            yield from body.iter_chunks(CHUNK)
        finally:
            body.close()

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def delete_prefix(self, prefix: str) -> int:
        deleted = 0
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            keys = [{"Key": o["Key"]} for o in page.get("Contents", [])]
            if keys:
                self.client.delete_objects(Bucket=self.bucket, Delete={"Objects": keys, "Quiet": True})
                deleted += len(keys)
        return deleted

    def list_objects(self) -> Iterator[StoredObject]:
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket):
            for o in page.get("Contents", []):
                yield StoredObject(key=o["Key"], last_modified=o["LastModified"])


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        if settings.STORAGE_DRIVER == "s3":
            s3 = S3Storage()
            s3.ensure_bucket()
            _storage = s3
        else:
            _storage = LocalStorage(settings.STORAGE_LOCAL_DIR)
    return _storage


def set_storage(storage: Storage | None) -> None:
    """Test hook."""
    global _storage
    _storage = storage


# ---- async wrappers (boto3 / disk I/O are blocking) -------------------------


async def put(key: str, data: bytes, content_type: str) -> None:
    await asyncio.to_thread(get_storage().put, key, data, content_type)


async def get(key: str) -> bytes:
    return await asyncio.to_thread(get_storage().get, key)


async def delete(key: str | None) -> bool:
    """Best-effort delete. Returns False (and logs) on failure so the sweep can retry."""
    if not key:
        return True
    try:
        await asyncio.to_thread(get_storage().delete, key)
        return True
    except Exception:  # noqa: BLE001
        log.exception("storage delete failed for %s; the retention sweep will retry", key)
        return False


async def delete_prefix(prefix: str) -> int:
    return await asyncio.to_thread(get_storage().delete_prefix, prefix)
