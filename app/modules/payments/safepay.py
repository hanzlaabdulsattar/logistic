"""Minimal SafePay client (mirrors the official @sfpy/node-sdk v3 contract).

Flow:
1) create_tracker()        POST {api}/order/v1/init → tracker token ("beacon")
2) build_checkout_url()    {checkout}/pay?beacon=…&order_id=…&redirect_url=…&cancel_url=…
3) SafePay redirects back  POST redirect_url with tracker + sig
   verify_redirect_signature(): sig == HMAC-SHA256(secret_key, tracker)
4) SafePay webhook         header X-SFPY-SIGNATURE
   verify_webhook():        sig == HMAC-SHA512(webhook_secret, JSON(body["data"]))
"""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from app.core.config import settings


def create_tracker(amount: float, currency: str) -> str:
    """Create a SafePay payment tracker and return its token."""
    try:
        res = httpx.post(
            f"{settings.safepay_api_url}/order/v1/init",
            json={
                "amount": amount,
                "client": settings.safepay_public_key,
                "currency": currency,
                "environment": settings.safepay_env,
            },
            timeout=15,
        )
        res.raise_for_status()
        token = (res.json().get("data") or {}).get("token")
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"SafePay is unavailable: {exc}") from exc
    if not token:
        raise HTTPException(status_code=502, detail="SafePay did not return a tracker token")
    return str(token)


def build_checkout_url(
    *, tracker: str, order_ref: str, redirect_url: str, cancel_url: str
) -> str:
    params = urlencode(
        {
            "beacon": tracker,
            "cancel_url": cancel_url,
            "env": settings.safepay_env,
            "order_id": order_ref,
            "redirect_url": redirect_url,
            "source": "custom",
            "webhooks": "true",
        }
    )
    return f"{settings.safepay_checkout_url}?{params}"


def verify_redirect_signature(tracker: str | None, sig: str | None) -> bool:
    if not tracker or not sig or not settings.safepay_secret_key:
        return False
    expected = hmac.new(
        settings.safepay_secret_key.encode(), tracker.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, sig)


def verify_webhook(data: Any, signature: str | None) -> bool:
    if not signature or not settings.safepay_webhook_secret:
        return False
    # Same bytes as JS JSON.stringify(body.data): compact, key order preserved
    payload = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode()
    expected = hmac.new(
        settings.safepay_webhook_secret.encode(), payload, hashlib.sha512
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
