import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models import Annotator

# Initialize Firebase Admin SDK if not already initialized
if not settings.MOCK_AUTH:
    if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        try:
            import json
            if settings.FIREBASE_SERVICE_ACCOUNT_JSON.strip().startswith("{"):
                service_account_info = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
                cred = credentials.Certificate(service_account_info)
            else:
                cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
            firebase_admin.initialize_app(cred)
        except ValueError:
            # Already initialized
            pass
    else:
        try:
            firebase_admin.initialize_app()
        except ValueError:
            pass

security = HTTPBearer(auto_error=False)

async def get_current_user(
    auth_creds: HTTPAuthorizationCredentials | None = Security(security),
    db: AsyncSession = Depends(get_db)
) -> Annotator:
    """
    FastAPI dependency to extract and verify the Firebase token,
    returning the matching Annotator db object.
    Supports MOCK_AUTH for local development.
    """
    if not auth_creds:
        if settings.MOCK_AUTH:
            # Default to admin in mock mode if no header is provided
            uid = "mock_admin_uid"
            email = "admin@example.com"
            display_name = "Mock Admin"
            role = "admin"
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authorization credentials"
            )
    else:
        token = auth_creds.credentials

        if settings.MOCK_AUTH:
            # In mock mode, check the token string to mock roles
            uid = token
            if "admin" in token:
                email = "admin@example.com"
                display_name = "Mock Admin"
                role = "admin"
            elif "lead" in token:
                email = "lead@example.com"
                display_name = "Mock Lead"
                role = "lead"
            else:
                email = "annotator@example.com"
                display_name = "Mock Annotator"
                role = "annotator"
        else:
            try:
                decoded_token = auth.verify_id_token(token)
                uid = decoded_token.get("uid")
                email = decoded_token.get("email", "")
                display_name = decoded_token.get("name", "")
                role = "annotator" # default role, admin/lead can be set in DB
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid Firebase ID token: {str(e)}"
                )

    # Look up or auto-create the annotator in our PostgreSQL database
    result = await db.execute(select(Annotator).where(Annotator.firebase_uid == uid))
    annotator = result.scalars().first()

    if not annotator:
        # Check if first user, make them admin
        count_res = await db.execute(select(Annotator))
        is_first = len(count_res.scalars().all()) == 0
        
        db_role = "admin" if (is_first or role == "admin") else role
        
        annotator = Annotator(
            firebase_uid=uid,
            email=email,
            display_name=display_name,
            role=db_role
        )
        db.add(annotator)
        await db.commit()
        await db.refresh(annotator)

    return annotator

def require_role(roles: list[str]):
    """
    Dependency generator to restrict endpoints to specific roles.
    """
    async def role_checker(current_user: Annotator = Depends(get_current_user)) -> Annotator:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires one of the following roles: {', '.join(roles)}"
            )
        return current_user
    return role_checker
