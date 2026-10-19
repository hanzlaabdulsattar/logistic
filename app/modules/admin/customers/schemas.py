from datetime import datetime

from pydantic import BaseModel


class CustomerCreate(BaseModel):
    user_id: int
    address: str | None = None


class CustomerUpdate(BaseModel):
    address: str | None = None


class CustomerResponse(BaseModel):
    id: int
    user_id: int
    address: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
