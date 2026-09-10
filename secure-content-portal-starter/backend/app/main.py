import os
import mimetypes
import uuid
from pathlib import Path

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Request,
    UploadFile,
    File,
    Form,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, HTMLResponse, Response
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
from dotenv import load_dotenv
from supabase import create_client, Client

from .database import Base, engine, get_db
from .models import Content, User


# =========================================================
# ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

SESSION_SECRET_KEY = os.getenv(
    "SESSION_SECRET_KEY",
    "secure-content-portal-local-session-secret-2026",
)

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173",
).rstrip("/")

ENVIRONMENT = os.getenv(
    "ENVIRONMENT",
    "development",
).lower()

IS_PRODUCTION = ENVIRONMENT == "production"

SESSION_SAME_SITE = os.getenv(
    "SESSION_SAME_SITE",
    "none" if IS_PRODUCTION else "lax",
).lower()

SESSION_HTTPS_ONLY = os.getenv(
    "SESSION_HTTPS_ONLY",
    "true" if IS_PRODUCTION else "false",
).lower() in {"1", "true", "yes", "on"}

if SESSION_SAME_SITE not in {"lax", "strict", "none"}:
    SESSION_SAME_SITE = "lax"

ADMIN_EMAILS = {
    email.strip().lower()
    for email in os.getenv("ADMIN_EMAILS", "").split(",")
    if email.strip()
}

try:
    MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
except ValueError:
    MAX_UPLOAD_MB = 50

if MAX_UPLOAD_MB <= 0:
    MAX_UPLOAD_MB = 50

MAX_FILE_SIZE = MAX_UPLOAD_MB * 1024 * 1024

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "").strip()
SUPABASE_BUCKET = os.getenv(
    "SUPABASE_BUCKET",
    "secure-content",
).strip()

SIGNED_URL_TTL_SECONDS = 60


# =========================================================
# PRODUCTION CHECKS
# =========================================================

if IS_PRODUCTION:
    if (
        not SESSION_SECRET_KEY
        or SESSION_SECRET_KEY
        == "secure-content-portal-local-session-secret-2026"
        or len(SESSION_SECRET_KEY) < 32
    ):
        raise RuntimeError(
            "A strong SESSION_SECRET_KEY of at least 32 characters "
            "must be configured in production."
        )

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_SECRET_KEY must be configured."
    )

if not SUPABASE_BUCKET:
    raise RuntimeError("SUPABASE_BUCKET must be configured.")


# =========================================================
# DATABASE + SUPABASE STORAGE
# =========================================================

Base.metadata.create_all(bind=engine)

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
)


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="Secure Content Portal API",
    version="1.0.0",
)


# =========================================================
# FILE TYPE CONFIGURATION
# =========================================================

ALLOWED_EXTENSIONS = {
    "PDF": {".pdf"},
    "VIDEO": {".mp4", ".webm"},
    "HTML": {".html", ".htm"},
}

ALLOWED_MIME_TYPES = {
    "PDF": {
        "application/pdf",
        "application/octet-stream",
    },
    "VIDEO": {
        "video/mp4",
        "video/webm",
        "application/octet-stream",
    },
    "HTML": {
        "text/html",
        "application/xhtml+xml",
        "application/octet-stream",
    },
}


# =========================================================
# CORS + SESSION
# =========================================================

ALLOWED_ORIGINS = {FRONTEND_URL}

if not IS_PRODUCTION:
    ALLOWED_ORIGINS.update(
        {
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        }
    )

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET_KEY,
    session_cookie="secure_portal_session",
    same_site=SESSION_SAME_SITE,
    https_only=SESSION_HTTPS_ONLY,
    max_age=60 * 60 * 8,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_ORIGINS),
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Accept",
        "Content-Type",
        "Authorization",
        "Range",
    ],
    expose_headers=[
        "Content-Range",
        "Accept-Ranges",
        "Content-Length",
    ],
)


# =========================================================
# SECURITY MIDDLEWARE
# =========================================================

@app.middleware("http")
async def security_middleware(
    request: Request,
    call_next,
):
    if request.method in {
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
    }:
        origin = request.headers.get("origin")

        if origin and origin not in ALLOWED_ORIGINS:
            return HTMLResponse(
                content="Request origin is not allowed.",
                status_code=403,
            )

    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=()"
    )

    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = (
            "no-store, no-cache, must-revalidate, private"
        )
        response.headers["Pragma"] = "no-cache"

    return response


# =========================================================
# GOOGLE OAUTH
# =========================================================

oauth = OAuth()

oauth.register(
    name="google",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url=(
        "https://accounts.google.com/"
        ".well-known/openid-configuration"
    ),
    client_kwargs={
        "scope": "openid email profile"
    },
)


# =========================================================
# PYDANTIC MODELS
# =========================================================

class ContentUpdate(BaseModel):
    title: str
    description: str
    type: str
    category: str


# =========================================================
# HELPERS
# =========================================================

def content_to_dict(item: Content):
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "type": item.type,
        "category": item.category,
        "filename": item.filename,
    }


def require_login(
    request: Request,
    db: Session,
):
    session_user = request.session.get("user")

    if not session_user:
        raise HTTPException(
            status_code=401,
            detail="Please login first.",
        )

    user_id = session_user.get("id")

    if not user_id:
        request.session.clear()
        raise HTTPException(
            status_code=401,
            detail="Invalid session.",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        request.session.clear()
        raise HTTPException(
            status_code=401,
            detail="User no longer exists.",
        )

    return user


def admin_only(
    request: Request,
    db: Session = Depends(get_db),
):
    user = require_login(request, db)

    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )

    return user


def get_content_or_404(
    content_id: int,
    db: Session,
):
    item = (
        db.query(Content)
        .filter(Content.id == content_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Content not found.",
        )

    return item


def get_storage_object_name(item: Content) -> str:
    if not item.filename:
        raise HTTPException(
            status_code=404,
            detail="No file attached to this content.",
        )

    safe_name = Path(item.filename).name

    if not safe_name or safe_name != item.filename:
        raise HTTPException(
            status_code=404,
            detail="Invalid stored file reference.",
        )

    return safe_name


def create_private_signed_url(
    object_name: str,
) -> str:
    try:
        result = (
            supabase.storage
            .from_(SUPABASE_BUCKET)
            .create_signed_url(
                object_name,
                SIGNED_URL_TTL_SECONDS,
            )
        )

        if isinstance(result, dict):
            signed_url = (
                result.get("signedURL")
                or result.get("signedUrl")
                or result.get("signed_url")
            )
        else:
            signed_url = getattr(
                result,
                "signed_url",
                None,
            )

        if not signed_url:
            raise RuntimeError(
                "Supabase did not return a signed URL."
            )

        return signed_url

    except HTTPException:
        raise
    except Exception as error:
        print("Signed URL Error:", error)
        raise HTTPException(
            status_code=502,
            detail="Unable to access stored file.",
        )


def download_private_object(
    object_name: str,
) -> bytes:
    try:
        data = (
            supabase.storage
            .from_(SUPABASE_BUCKET)
            .download(object_name)
        )

        if not data:
            raise RuntimeError(
                "Supabase returned an empty file."
            )

        return data

    except Exception as error:
        print("Storage Download Error:", error)
        raise HTTPException(
            status_code=502,
            detail="Unable to access stored file.",
        )


async def validate_file_signature(
    upload_file: UploadFile,
    content_type: str,
    extension: str,
):
    header = await upload_file.read(8192)
    await upload_file.seek(0)

    if not header:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    if content_type == "PDF":
        if not header.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is not a valid PDF.",
            )

    elif (
        content_type == "VIDEO"
        and extension == ".mp4"
    ):
        if (
            len(header) < 12
            or header[4:8] != b"ftyp"
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "The uploaded file does not appear "
                    "to be a valid MP4."
                ),
            )

    elif (
        content_type == "VIDEO"
        and extension == ".webm"
    ):
        if not header.startswith(
            b"\x1a\x45\xdf\xa3"
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "The uploaded file does not appear "
                    "to be a valid WebM video."
                ),
            )

    elif content_type == "HTML":
        if b"\x00" in header:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The uploaded HTML file contains "
                    "invalid binary data."
                ),
            )

        try:
            text = header.decode("utf-8").lower()
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail=(
                    "HTML files must use UTF-8 "
                    "text encoding."
                ),
            )

        html_markers = (
            "<!doctype html",
            "<html",
            "<head",
            "<body",
        )

        if not any(
            marker in text
            for marker in html_markers
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "The uploaded file does not "
                    "appear to contain valid HTML."
                ),
            )


# =========================================================
# BASIC ROUTES
# =========================================================

@app.get("/")
def root():
    return {
        "message": "Secure Content Portal API is running",
        "version": "1.0.0",
        "storage": "supabase-private",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


# =========================================================
# GOOGLE LOGIN
# =========================================================

@app.get("/auth/google/login")
async def google_login(
    request: Request,
):
    if (
        not GOOGLE_CLIENT_ID
        or not GOOGLE_CLIENT_SECRET
    ):
        raise HTTPException(
            status_code=500,
            detail="Google OAuth is not configured.",
        )

    redirect_uri = request.url_for(
        "google_callback"
    )

    return await oauth.google.authorize_redirect(
        request,
        redirect_uri,
    )


# =========================================================
# GOOGLE CALLBACK
# =========================================================

@app.get("/auth/google/callback")
async def google_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        token = await (
            oauth.google.authorize_access_token(
                request
            )
        )

        google_user = token.get("userinfo")

        if not google_user:
            google_user = await (
                oauth.google.userinfo(
                    token=token
                )
            )

        email = (
            google_user.get("email") or ""
        ).strip().lower()

        if not email:
            raise ValueError(
                "Google account email not available."
            )

        name = google_user.get("name")
        picture = google_user.get("picture")

        user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if not user:
            assigned_role = "viewer"

            if email in ADMIN_EMAILS:
                assigned_role = "admin"

            user = User(
                name=name,
                email=email,
                picture=picture,
                role=assigned_role,
            )

            db.add(user)
            db.commit()
            db.refresh(user)

        else:
            user.name = name
            user.picture = picture

            if email in ADMIN_EMAILS:
                user.role = "admin"

            db.commit()
            db.refresh(user)

        request.session["user"] = {
            "id": user.id,
            "email": user.email,
        }

        return RedirectResponse(
            url=f"{FRONTEND_URL}/?login=success"
        )

    except Exception as error:
        print("Google OAuth Error:", error)

        return RedirectResponse(
            url=f"{FRONTEND_URL}/?login=failed"
        )


# =========================================================
# CURRENT USER / LOGOUT
# =========================================================

@app.get("/api/me")
def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    user = require_login(request, db)

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "picture": user.picture,
        "role": user.role,
    }


@app.get("/auth/logout")
async def logout(
    request: Request,
):
    request.session.clear()

    return RedirectResponse(
        url=FRONTEND_URL
    )


# =========================================================
# LIST CONTENT
# =========================================================

@app.get("/api/content")
def list_content(
    request: Request,
    db: Session = Depends(get_db),
):
    require_login(request, db)

    items = (
        db.query(Content)
        .order_by(Content.id.desc())
        .all()
    )

    return [
        content_to_dict(item)
        for item in items
    ]


# =========================================================
# SECURE PDF VIEWER
# PDF bytes are proxied through the authenticated backend.
# This avoids cross-origin redirect/CORS issues with Axios
# while keeping the Supabase bucket private.
# =========================================================

@app.get("/api/content/{content_id}/pdf")
def view_pdf(
    content_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    require_login(request, db)

    item = get_content_or_404(
        content_id,
        db,
    )

    if item.type != "PDF":
        raise HTTPException(
            status_code=400,
            detail="This content is not a PDF.",
        )

    object_name = get_storage_object_name(item)
    pdf_bytes = download_private_object(
        object_name
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": (
                "no-store, no-cache, "
                "must-revalidate, private"
            ),
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )


# =========================================================
# SECURE VIDEO VIEWER
# A 60-second signed URL is issued only after login.
# Supabase then handles byte-range video requests.
# =========================================================

@app.get("/api/content/{content_id}/video")
def stream_video(
    content_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    require_login(request, db)

    item = get_content_or_404(
        content_id,
        db,
    )

    if item.type != "VIDEO":
        raise HTTPException(
            status_code=400,
            detail="This content is not a video.",
        )

    object_name = get_storage_object_name(item)
    signed_url = create_private_signed_url(
        object_name
    )

    return RedirectResponse(
        url=signed_url,
        status_code=307,
        headers={
            "Cache-Control": "no-store",
        },
    )


# =========================================================
# SECURE HTML VIEWER
# HTML stays behind authenticated backend access and is
# returned as text for the frontend sandboxed iframe.
# =========================================================

@app.get("/api/content/{content_id}/html")
def view_html(
    content_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    require_login(request, db)

    item = get_content_or_404(
        content_id,
        db,
    )

    if item.type != "HTML":
        raise HTTPException(
            status_code=400,
            detail="This content is not HTML.",
        )

    object_name = get_storage_object_name(item)
    data = download_private_object(
        object_name
    )

    try:
        html_content = data.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Unable to read HTML file.",
        )

    return HTMLResponse(
        content=html_content,
        headers={
            "Cache-Control": (
                "no-store, no-cache, "
                "must-revalidate, private"
            ),
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )


# =========================================================
# ADMIN - CREATE CONTENT
# =========================================================

@app.post("/api/content")
async def create_content(
    title: str = Form(...),
    description: str = Form(...),
    type: str = Form(...),
    category: str = Form(...),
    file: UploadFile = File(...),
    admin_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    title = title.strip()
    description = description.strip()
    category = category.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Title is required.",
        )

    if not description:
        raise HTTPException(
            status_code=400,
            detail="Description is required.",
        )

    if not category:
        raise HTTPException(
            status_code=400,
            detail="Category is required.",
        )

    content_type = type.upper().strip()

    if content_type not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported content type.",
        )

    original_filename = Path(
        file.filename or ""
    ).name

    if not original_filename:
        raise HTTPException(
            status_code=400,
            detail="File name is invalid.",
        )

    extension = Path(
        original_filename
    ).suffix.lower()

    if (
        extension
        not in ALLOWED_EXTENSIONS[content_type]
    ):
        allowed = ", ".join(
            sorted(
                ALLOWED_EXTENSIONS[
                    content_type
                ]
            )
        )

        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid file type for "
                f"{content_type}. "
                f"Allowed: {allowed}"
            ),
        )

    uploaded_mime = (
        file.content_type or ""
    ).lower()

    if (
        uploaded_mime
        and uploaded_mime
        not in ALLOWED_MIME_TYPES[
            content_type
        ]
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported MIME type: "
                f"{uploaded_mime}"
            ),
        )

    await validate_file_signature(
        file,
        content_type,
        extension,
    )

    safe_filename = (
        f"{uuid.uuid4().hex}{extension}"
    )

    total_size = 0
    file_bytes = bytearray()
    uploaded_to_storage = False

    try:
        while True:
            chunk = await file.read(
                1024 * 1024
            )

            if not chunk:
                break

            total_size += len(chunk)

            if total_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        "File is too large. "
                        f"Maximum size is "
                        f"{MAX_UPLOAD_MB} MB."
                    ),
                )

            file_bytes.extend(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty.",
            )

        storage_mime = (
            uploaded_mime
            if uploaded_mime
            and uploaded_mime
            != "application/octet-stream"
            else (
                mimetypes.guess_type(
                    original_filename
                )[0]
                or "application/octet-stream"
            )
        )

        (
            supabase.storage
            .from_(SUPABASE_BUCKET)
            .upload(
                path=safe_filename,
                file=bytes(file_bytes),
                file_options={
                    "content-type": storage_mime,
                    "upsert": "false",
                },
            )
        )

        uploaded_to_storage = True

        new_item = Content(
            title=title,
            description=description,
            type=content_type,
            category=category,
            filename=safe_filename,
        )

        db.add(new_item)
        db.commit()
        db.refresh(new_item)

        return content_to_dict(new_item)

    except HTTPException:
        db.rollback()

        if uploaded_to_storage:
            try:
                (
                    supabase.storage
                    .from_(SUPABASE_BUCKET)
                    .remove([safe_filename])
                )
            except Exception as cleanup_error:
                print(
                    "Storage Cleanup Error:",
                    cleanup_error,
                )

        raise

    except Exception as error:
        db.rollback()

        if uploaded_to_storage:
            try:
                (
                    supabase.storage
                    .from_(SUPABASE_BUCKET)
                    .remove([safe_filename])
                )
            except Exception as cleanup_error:
                print(
                    "Storage Cleanup Error:",
                    cleanup_error,
                )

        print("Upload Error:", error)

        raise HTTPException(
            status_code=500,
            detail="File upload failed.",
        )

    finally:
        await file.close()


# =========================================================
# ADMIN - UPDATE METADATA
# =========================================================

@app.put("/api/content/{content_id}")
def update_content(
    content_id: int,
    content: ContentUpdate,
    admin_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    item = get_content_or_404(
        content_id,
        db,
    )

    title = content.title.strip()
    description = content.description.strip()
    category = content.category.strip()
    content_type = (
        content.type.upper().strip()
    )

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Title is required.",
        )

    if not description:
        raise HTTPException(
            status_code=400,
            detail="Description is required.",
        )

    if not category:
        raise HTTPException(
            status_code=400,
            detail="Category is required.",
        )

    if content_type not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid content type.",
        )

    if content_type != item.type:
        raise HTTPException(
            status_code=400,
            detail=(
                "Content type cannot be changed "
                "without uploading a new file."
            ),
        )

    item.title = title
    item.description = description
    item.category = category

    db.commit()
    db.refresh(item)

    return content_to_dict(item)


# =========================================================
# ADMIN - DELETE CONTENT
# =========================================================

@app.delete("/api/content/{content_id}")
def delete_content(
    content_id: int,
    admin_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    item = get_content_or_404(
        content_id,
        db,
    )

    object_name = (
        get_storage_object_name(item)
        if item.filename
        else None
    )

    try:
        if object_name:
            (
                supabase.storage
                .from_(SUPABASE_BUCKET)
                .remove([object_name])
            )

        db.delete(item)
        db.commit()

    except Exception as error:
        db.rollback()

        print("Delete Error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to delete content.",
        )

    return {
        "message": "Content deleted successfully."
    }
