from datetime import datetime

from pydantic import BaseModel


class CustomerUserOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str | None
    role: str


class ProfileResponse(BaseModel):
    id: int
    user_id: int
    address: str | None
    user: CustomerUserOut
    created_at: datetime
    updated_at: datetime


class ProfileUpdate(BaseModel):
    address: str | None = None
    full_name: str | None = None
    phone: str | None = None
