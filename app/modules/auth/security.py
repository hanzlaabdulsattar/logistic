from datetime import timedelta

from pydantic_settings import BaseSettings


class AuthSettings(BaseSettings):
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    model_config = {"env_prefix": "AUTH_"}


auth_settings = AuthSettings()


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    from datetime import datetime, timezone

    from jose import jwt

    to_encode = data.copy()
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=auth_settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, auth_settings.secret_key, algorithm=auth_settings.algorithm)
