from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth import crud
from app.modules.auth.dependencies import get_current_user, verify_password
from app.modules.auth.schemas import TokenResponse, UserCreate, UserResponse
from app.modules.auth.security import create_access_token
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    email = user_in.email.strip().lower()
    if crud.get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = crud.create_user(db, user_in.model_copy(update={"email": email}))
    return user


async def _extract_login_credentials(request: Request) -> tuple[str, str]:
    """Accept JSON {email,password} and Swagger OAuth2 form {username,password}."""
    content_type = (request.headers.get("content-type") or "").lower()

    if content_type.startswith("application/json"):
        payload = await request.json()
        if not isinstance(payload, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Body must be a JSON object",
            )
        email = payload.get("email") or payload.get("username")
        password = payload.get("password")
    elif content_type.startswith("application/x-www-form-urlencoded") or content_type.startswith(
        "multipart/form-data"
    ):
        form = await request.form()
        email = form.get("email") or form.get("username")
        password = form.get("password")
    else:
        # Fallback: try JSON first (Postman/Swagger "Example Value" often still JSON)
        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Send JSON {email, password} or OAuth2 form {username, password}",
            )
        if not isinstance(payload, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Body must be a JSON object",
            )
        email = payload.get("email") or payload.get("username")
        password = payload.get("password")

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="email (or username) and password are required",
        )
    return str(email).strip().lower(), str(password)


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, db: Session = Depends(get_db)):
    email, password = await _extract_login_credentials(request)

    user = crud.get_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token = create_access_token(data={"sub": user.id})
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
