from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    # Use str (not EmailStr) so admin@gstv.local and other reserved-TLD addresses
    # are accepted — email-validator rejects .local domains.
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class UserRead(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    is_admin: bool
    subscription_tier: str = "free"
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class AdminPasswordResetRequestSchema(BaseModel):
    """Request a one-time admin password reset. Token is returned in the response (no email server on free tier)."""
    email: str = Field(min_length=5, max_length=255)


class AdminPasswordResetResponseSchema(BaseModel):
    detail: str
    # Present only in development or when settings.debug; otherwise use reset_token
    reset_token: str | None = None
    token_expires_in_minutes: int


class AdminPasswordResetConfirmSchema(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    token: str = Field(min_length=20, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)
