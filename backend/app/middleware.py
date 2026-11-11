"""Request body cap enforced while the body streams in, so oversized uploads are cut off early."""

from __future__ import annotations

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings

SMALL_BODY_LIMIT = 1024 * 1024  # every non-upload endpoint


class BodyTooLarge(Exception):
    pass


class BodyLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    def _limit(self, scope: Scope) -> int:
        if scope["method"] == "POST" and scope["path"].rstrip("/") == "/v1/documents":
            return settings.max_upload_request_bytes
        return SMALL_BODY_LIMIT

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        limit = self._limit(scope)
        started = False

        async def too_large() -> None:
            body = json.dumps(
                {"error": {"code": "REQUEST_TOO_LARGE", "message": f"Request body exceeds {limit // (1024 * 1024)} MB."}}
            ).encode()
            await send({"type": "http.response.start", "status": 413, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), (b"connection", b"close")]})
            await send({"type": "http.response.body", "body": body})

        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    if int(value) > limit:
                        await too_large()
                        return
                except ValueError:
                    pass

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise BodyTooLarge
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except BodyTooLarge:
            if not started:
                await too_large()
