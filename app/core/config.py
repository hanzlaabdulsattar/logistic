from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Common local frontend ports (React/Vite/Next/Angular/etc.)
_DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:8888",
    "http://127.0.0.1:8888",
]


class Settings(BaseSettings):
    app_name: str = "Logistics Platform"
    environment: str = "development"
    database_url: str
    redis_url: str

    # CORS for React frontend on a different port than the API (8000)
    # Comma-separated origins, or CORS_ALLOW_ALL=true for local debugging
    cors_origins: str = Field(
        default=",".join(_DEFAULT_ORIGINS),
        validation_alias="CORS_ORIGINS",
    )
    cors_allow_all: bool = Field(default=False, validation_alias="CORS_ALLOW_ALL")

    # SafePay. Public key = merchant API key ("client" in /order/v1/init).
    # Secret key verifies the redirect signature; webhook secret verifies webhooks.
    # Without a real public + secret key the app runs in demo mode (local checkout page).
    safepay_env: str = Field(default="sandbox", validation_alias="SAFEPAY_ENV")
    safepay_public_key: str = Field(
        default="sp_public_demo_key_replace_me",
        validation_alias="SAFEPAY_PUBLIC_KEY",
    )
    safepay_secret_key: str = Field(default="", validation_alias="SAFEPAY_SECRET_KEY")
    safepay_webhook_secret: str = Field(default="", validation_alias="SAFEPAY_WEBHOOK_SECRET")
    safepay_merchant_code: str = Field(
        default="DEMO_MERCHANT",
        validation_alias="SAFEPAY_MERCHANT_CODE",
    )
    # Where SafePay sends the browser back (must reach this API: /payments/safepay/return)
    api_base_url: str = Field(
        default="http://127.0.0.1:8000",
        validation_alias="API_BASE_URL",
    )
    # Frontend origin used for the payment result page
    frontend_base_url: str = Field(
        default="http://127.0.0.1:5173",
        validation_alias="FRONTEND_BASE_URL",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def safepay_live(self) -> bool:
        """True when real SafePay credentials are configured (otherwise demo checkout)."""
        key = self.safepay_public_key.strip()
        return bool(key) and "demo" not in key and bool(self.safepay_secret_key.strip())

    @property
    def safepay_api_url(self) -> str:
        if self.safepay_env == "production":
            return "https://api.getsafepay.com"
        return "https://sandbox.api.getsafepay.com"

    @property
    def safepay_checkout_url(self) -> str:
        if self.safepay_env == "production":
            return "https://getsafepay.com/checkout/pay"
        return "https://sandbox.api.getsafepay.com/checkout/pay"

    @property
    def cors_origin_list(self) -> list[str]:
        raw = str(self.cors_allow_all).strip().lower()
        if self.cors_allow_all or raw in {"1", "true", "yes"}:
            return ["*"]
        origins = [o.strip() for o in str(self.cors_origins).split(",") if o.strip()]
        # Always include common local dev origins so unknown frontend ports still work
        for origin in _DEFAULT_ORIGINS:
            if origin not in origins:
                origins.append(origin)
        return origins or ["*"]


settings = Settings()
