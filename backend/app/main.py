from datetime import datetime, timedelta, timezone

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Request,
)

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

import os
import secrets

from .settings import settings
from .db import Base, engine, get_db
from .models import (
    User,
    OTPChallenge,
    ApprovalChallenge,
    RefreshToken,
    Permission,
    Document,
    Transformation,
    AuditLog,
    Template,
)
from .security import *
from .rate_limit import limit
from .mailer import send_otp
from .audit import audit
from .storage import ensure_bucket, put_object, get_object, delete_object
from .worker import extract_document, generate_transformation


# ---------------------------------------------------------
# DATABASE / STORAGE INITIALIZATION
# ---------------------------------------------------------

Base.metadata.create_all(engine)
ensure_bucket()


# ---------------------------------------------------------
# FASTAPI APPLICATION
# ---------------------------------------------------------

app = FastAPI(
    title="AGIS Production API",
    version="3.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# REQUEST SCHEMAS
# ---------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str
    role: str = "Operator"


class RegisterRequest(BaseModel):
    name: str
    username: str
    email: str
    mobile: str
    password: str
    role: str


class RegisterOTPRequest(BaseModel):
    challenge_id: int
    code: str


class OTPRequest(BaseModel):
    challenge_id: int
    code: str


class UserApprovalRequest(BaseModel):
    action: str


class ApprovalOTPRequest(BaseModel):
    user_id: int
    channel: str = "email"


class ApprovalOTPVerifyRequest(BaseModel):
    challenge_id: int
    code: str


class TransformRequest(BaseModel):
    document_id: int
    output_type: str

    target_audience: str = "Leadership / Decision Makers"
    language: str = "English"
    objective: str = "Inform"

    tone: str = "Formal & Objective"
    detail_level: str = "Concise"
    content_style: str = "Structured (Section-wise)"


class ReviewRequest(BaseModel):
    decision: str
    comment: str = ""


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def ip(request: Request):
    return request.client.host if request.client else ""


# ---------------------------------------------------------
# HEALTH
# ---------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "version": "3.0.0",
    }


# =========================================================
# AUTHENTICATION
# =========================================================


# ---------------------------------------------------------
# REGISTER
# ---------------------------------------------------------

@app.post("/api/auth/register")
def register(
    b: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    limit(
        f"register:{ip(request)}",
        5,
        60,
    )

    allowed_roles = {
        "Operator",
        "Reviewer",
        "Administrator",
    }

    # -----------------------------------------------------
    # VALIDATE ROLE
    # -----------------------------------------------------

    if b.role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail="Invalid role",
        )

    # -----------------------------------------------------
    # USERNAME UNIQUENESS
    # -----------------------------------------------------

    if db.query(User).filter(
        User.username == b.username
    ).first():

        raise HTTPException(
            status_code=409,
            detail="Username already exists",
        )

    # -----------------------------------------------------
    # EMAIL UNIQUENESS
    # -----------------------------------------------------

    if db.query(User).filter(
        User.email == b.email
    ).first():

        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    # -----------------------------------------------------
    # MOBILE UNIQUENESS
    # -----------------------------------------------------

    if db.query(User).filter(
        User.mobile == b.mobile
    ).first():

        raise HTTPException(
            status_code=409,
            detail="Mobile number already registered",
        )

    # -----------------------------------------------------
    # APPROVAL RULE
    #
    # Operator:
    #   Automatically approved and active
    #
    # Reviewer:
    #   Administrator approval required
    #
    # Administrator:
    #   Explicit bootstrap/Administrator approval required,
    #   including the first Administrator
    # -----------------------------------------------------

    approval_status = (
        "Approved"
        if b.role == "Operator"
        else "Pending"
    )

    user = User(
        name=b.name,
        username=b.username,
        email=b.email,
        mobile=b.mobile,
        password_hash=hash_password(b.password),
        role=b.role,
        active=(b.role == "Operator"),
        mfa_enabled=True,
        email_verified=False,
        mobile_verified=False,
        approval_status=approval_status,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    # -----------------------------------------------------
    # CREATE REGISTRATION OTP
    # -----------------------------------------------------

    code = random_otp()

    challenge = OTPChallenge(
        user_id=user.id,
        channel="email",
        code_hash=hash_value(code),
        expires_at=(
            datetime.now(timezone.utc)
            + timedelta(
                minutes=settings.otp_minutes
            )
        ),
    )

    db.add(challenge)
    db.commit()

    # -----------------------------------------------------
    # SEND OTP
    # -----------------------------------------------------

    send_otp(
        user.email,
        code,
    )

    # -----------------------------------------------------
    # AUDIT REGISTRATION
    # -----------------------------------------------------

    audit(
        db,
        user,
        "Registration",
        "Authentication",
        f"Registration requested for {b.role}",
        ip(request),
    )

    # -----------------------------------------------------
    # RESPONSE MESSAGE
    # -----------------------------------------------------

    if b.role == "Operator":

        message = (
            "Registration successful. "
            "Verify your OTP."
        )

    else:

        message = (
            "Registration submitted. "
            "Verify your OTP; administrator approval "
            "is required before login."
        )

    return {
        "challenge_id": challenge.id,
        "requires_otp": True,
        "approval_status": approval_status,
        "active": user.active,
        "role": user.role,
        "message": message,
    }


# ---------------------------------------------------------
# REGISTER OTP VERIFICATION
# ---------------------------------------------------------

@app.post("/api/auth/register/verify-otp")
def register_verify_otp(
    b: RegisterOTPRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    limit(
        f"register-otp:{ip(request)}",
        10,
        60,
    )

    # -----------------------------------------------------
    # FIND OTP CHALLENGE
    # -----------------------------------------------------

    ch = db.get(
        OTPChallenge,
        b.challenge_id,
    )

    # -----------------------------------------------------
    # VALIDATE CHALLENGE
    # -----------------------------------------------------

    if (
        not ch
        or ch.consumed
        or ch.attempts >= settings.otp_max_attempts
        or ch.expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=401,
            detail="OTP expired or invalid",
        )

    # -----------------------------------------------------
    # INCREMENT ATTEMPTS
    # -----------------------------------------------------

    ch.attempts += 1

    # -----------------------------------------------------
    # VALIDATE OTP CODE
    # -----------------------------------------------------

    if hash_value(b.code) != ch.code_hash:

        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Invalid OTP",
        )

    # -----------------------------------------------------
    # CONSUME OTP
    # -----------------------------------------------------

    ch.consumed = True

    # -----------------------------------------------------
    # FIND USER
    # -----------------------------------------------------

    user = db.get(
        User,
        ch.user_id,
    )

    if not user:

        db.commit()

        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # -----------------------------------------------------
    # VERIFY CONTACT DETAILS
    # -----------------------------------------------------

    user.email_verified = True
    user.mobile_verified = True

    db.commit()

    # -----------------------------------------------------
    # AUDIT OTP VERIFICATION
    # -----------------------------------------------------

    audit(
        db,
        user,
        "Registration OTP Verified",
        "Authentication",
        "Registration contact verification completed",
        ip(request),
    )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    if user.approval_status == "Approved":

        message = (
            "Registration verified. "
            "You can now log in."
        )

    else:

        message = (
            "Registration verified. "
            "Administrator approval is required "
            "before login."
        )

    return {
        "verified": True,
        "approval_status": user.approval_status,
        "active": user.active,
        "role": user.role,
        "message": message,
    }

# ---------------------------------------------------------
# LOGIN
# ---------------------------------------------------------

@app.post("/api/auth/login")
def login(
    b: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    limit(
        f"login:{ip(request)}",
        10,
        60,
    )

    # -----------------------------------------------------
    # Find user by username
    # -----------------------------------------------------

    u = db.query(User).filter(
        User.username == b.username
    ).first()

    # Invalid credentials
    if not u or not verify_password(
        b.password,
        u.password_hash,
    ):
        raise HTTPException(
            401,
            "Invalid credentials",
        )

    # -----------------------------------------------------
    # APPROVAL CHECKS
    # -----------------------------------------------------


    # Account disabled
    if not u.active:

        raise HTTPException(
            403,
            "Your account is inactive",
        )

    # Role check
    if b.role and b.role != u.role:

        raise HTTPException(
            403,
            "Selected role does not match this account",
        )

    # -----------------------------------------------------
    # CREATE LOGIN OTP
    # -----------------------------------------------------
    code = random_otp()
    otp_channel = "email"

    ch = OTPChallenge(
    user_id=u.id,
    code_hash=hash_value(code),
    expires_at=(
        datetime.now(timezone.utc)
        + timedelta(minutes=settings.otp_minutes)
    ),
    channel=otp_channel,
)

    db.add(ch)
    db.commit()

    send_otp(
    u.email,
    code,
)
    

    

    return {
        "challenge_id": ch.id,
        "requires_otp": True,
        "channel": otp_channel,
    }

# ---------------------------------------------------------
# LOGIN OTP VERIFICATION
# ---------------------------------------------------------

@app.post("/api/auth/verify-otp")
def verify_otp(
    b: OTPRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    limit(
        f"otp:{ip(request)}",
        10,
        60,
    )

    ch = db.get(
        OTPChallenge,
        b.challenge_id,
    )

    # Validate OTP challenge
    if (
        not ch
        or ch.consumed
        or ch.attempts >= settings.otp_max_attempts
        or ch.expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(
            401,
            "OTP expired or invalid",
        )

    ch.attempts += 1

    # Invalid OTP
    if hash_value(b.code) != ch.code_hash:

        db.commit()

        raise HTTPException(
            401,
            "Invalid OTP",
        )

    ch.consumed = True

    user = db.get(
        User,
        ch.user_id,
    )

    if not user:
        db.commit()

        raise HTTPException(
            404,
            "User not found",
        )

    # Extra safety check
    if user.approval_status != "Approved":

        db.commit()

        raise HTTPException(
            403,
            "Account is not approved",
        )

    if not user.active:

        db.commit()

        raise HTTPException(
            403,
            "Account is inactive",
        )

    # Update activity
    user.last_active = datetime.now(
        timezone.utc
    )

    # Create refresh token
    raw = secrets.token_urlsafe(48)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_value(raw),
            expires_at=(
                datetime.now(timezone.utc)
                + timedelta(
                    days=settings.refresh_token_days
                )
            ),
        )
    )

    db.commit()

    # Audit
    audit(
        db,
        user,
        "Login",
        "Authentication",
        "MFA login",
        ip(request),
    )

    return {
        "access_token": create_access_token(
            user
        ),

        "refresh_token": raw,

        "user": {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "role": user.role,
            "email": user.email,
        },
    }


# ---------------------------------------------------------
# BOOTSTRAP FIRST ADMINISTRATOR APPROVAL
# ---------------------------------------------------------

class BootstrapApprovalRequest(BaseModel):
    username: str
    token: str


@app.post("/api/auth/bootstrap-approve")
def bootstrap_approve(
    b: BootstrapApprovalRequest,
    db: Session = Depends(get_db),
):
    # Bootstrap approval is disabled unless a server-side
    # token has been configured in the environment.
    if not settings.agis_bootstrap_approval_token:
        raise HTTPException(
            503,
            "Bootstrap approval is not configured",
        )

    # Constant-time token comparison.
    if not secrets.compare_digest(
        b.token,
        settings.agis_bootstrap_approval_token,
    ):
        raise HTTPException(
            401,
            "Invalid bootstrap token",
        )

    # Bootstrap is only allowed while there is no approved
    # active Administrator.
    existing_admin = db.query(User).filter(
        User.role == "Administrator",
        User.active == True,
        User.approval_status == "Approved",
    ).first()

    if existing_admin:
        raise HTTPException(
            403,
            "Bootstrap approval is no longer available",
        )

    # Locate the Administrator waiting for approval.
    user = db.query(User).filter(
        User.username == b.username,
        User.role == "Administrator",
    ).first()

    if not user:
        raise HTTPException(
            404,
            "Administrator account not found",
        )

    if user.approval_status == "Approved" and user.active:
        raise HTTPException(
            409,
            "Administrator is already approved",
        )

    # Require completion of email verification before
    # bootstrap approval.
    if not user.email_verified:
        raise HTTPException(
            403,
            "Administrator email must be verified first",
        )

    user.approval_status = "Approved"
    user.active = True

    db.commit()
    db.refresh(user)

    return {
        "message": "Administrator approved successfully",
        "username": user.username,
        "role": user.role,
        "approval_status": user.approval_status,
        "active": user.active,
    }


# ---------------------------------------------------------
# CURRENT USER
# ---------------------------------------------------------

@app.get("/api/me")
def me(
    user=Depends(current_user),
):
    return {
        "id": user.id,
        "name": user.name,
        "username": user.username,
        "role": user.role,
        "email": user.email,
    }


# =========================================================
# DASHBOARD
# =========================================================

@app.get("/api/dashboard")
def dashboard(
    user=Depends(
        require_permission(
            "Dashboard",
            "view",
        )
    ),
    db: Session = Depends(get_db),
):
    recent_transformations = (
        db.query(
            Transformation,
            Document.name.label("document_name"),
        )
        .join(
            Document,
            Transformation.document_id == Document.id,
        )
        .order_by(
            Transformation.created_at.desc()
        )
        .limit(8)
        .all()
    )

    return {
        "counts": {
            "documents": db.query(Document).count(),

            "processed": db.query(Document).filter(
                Document.extraction_status == "Complete"
            ).count(),

            "for_review": db.query(Transformation).filter(
                Transformation.status == "Ready for Review"
            ).count(),

            "approved": db.query(Transformation).filter(
                Transformation.status == "Approved"
            ).count(),
        },

        "recent": [
            {
                "id": transformation.id,
                "document_id": transformation.document_id,
                "name": document_name,
                "output_type": transformation.output_type,
                "status": transformation.status,
                "created_at": transformation.created_at.isoformat(),
            }
            for transformation, document_name in recent_transformations
        ],
    }


# =========================================================
# DOCUMENTS
# =========================================================

@app.get("/api/documents")
def documents(
    page: int = 1,
    page_size: int = 5,
    search: str = "",
    status: str = "",
    doc_type: str = "",
    user=Depends(
        require_permission(
            "Documents",
            "view",
        )
    ),
    db: Session = Depends(get_db),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 50)

    query = (
        db.query(
            Document,
            User.name.label("owner_name"),
            User.role.label("owner_role"),
        )
        .join(
            User,
            Document.owner_id == User.id,
        )
    )

    if search.strip():
        search_value = f"%{search.strip()}%"
        query = query.filter(
            Document.name.ilike(search_value)
        )

    if status.strip():
        normalized_status = status.strip().lower()

        if normalized_status == "ready":
            query = query.filter(
                Document.extraction_status == "Complete"
            )
        elif normalized_status == "queued":
            query = query.filter(
                Document.extraction_status == "Queued"
            )
        elif normalized_status == "processing":
            query = query.filter(
                Document.extraction_status == "Processing"
            )
        elif normalized_status == "failed":
            query = query.filter(
                Document.extraction_status == "Failed"
            )

    if doc_type.strip():
        normalized_type = doc_type.strip().lower()

        type_map = {
            "pdf": "%pdf%",
            "docx": "%wordprocessingml.document%",
            "xlsx": "%spreadsheetml.sheet%",
        }

        mime_pattern = type_map.get(normalized_type)

        if mime_pattern:
            query = query.filter(
                Document.mime_type.ilike(mime_pattern)
            )

    total = query.count()

    rows = (
        query
        .order_by(Document.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []

    for document, owner_name, owner_role in rows:
        if document.extraction_status == "Complete":
            display_status = "Ready"
        elif document.extraction_status == "Processing":
            display_status = "Processing"
        elif document.extraction_status == "Failed":
            display_status = "Failed"
        else:
            display_status = "Queued"

        items.append(
            {
                "id": document.id,
                "name": document.name,
                "mime_type": document.mime_type,
                "size_bytes": document.size_bytes,
                "status": display_status,
                "extraction_status": document.extraction_status,
                "owner_id": document.owner_id,
                "owner": owner_name or "Unknown",
                "owner_role": owner_role or "",
                "created_at": document.created_at.isoformat(),
            }
        )

    pages = (
        (total + page_size - 1) // page_size
        if total
        else 0
    )

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "pages": pages,
    }


# ---------------------------------------------------------
# UPLOAD DOCUMENT
# ---------------------------------------------------------

@app.post("/api/documents/upload")
async def upload(
    request: Request,
    file: UploadFile = File(...),

    user=Depends(
        require_permission(
            "Documents",
            "create",
        )
    ),

    db: Session = Depends(get_db),
):
    limit(
        f"upload:{user.id}",
        20,
        3600,
    )

    allowed = {
        "application/pdf",

        "application/"
        "vnd.openxmlformats-officedocument"
        ".wordprocessingml.document",

        "application/"
        "vnd.openxmlformats-officedocument"
        ".spreadsheetml.sheet",
    }

    ext = os.path.splitext(
        file.filename or ""
    )[1].lower()

    if (
        file.content_type not in allowed
        and ext not in {
            ".pdf",
            ".docx",
            ".xlsx",
        }
    ):
        raise HTTPException(
            415,
            "Unsupported document type",
        )

    data = await file.read()

    if len(data) > (
        settings.upload_max_mb
        * 1024
        * 1024
    ):
        raise HTTPException(
            413,
            "File exceeds configured size limit",
        )

    name = os.path.basename(
        file.filename
        or "document"
    )

    key = (
        f"{user.id}/"
        f"{secrets.token_hex(16)}-"
        f"{name}"
    )

    tmp = (
        f"/tmp/"
        f"{secrets.token_hex(8)}-"
        f"{name}"
    )

    with open(
        tmp,
        "wb",
    ) as f:
        f.write(data)

    # Mandatory malware scanning should be
    # integrated here in hardened deployments.

    put_object(
        key,
        tmp,
        file.content_type
        or "application/octet-stream",
    )

    d = Document(
        name=name,
        mime_type=(
            file.content_type
            or ext
        ),
        size_bytes=len(data),
        object_key=key,
        owner_id=user.id,
    )

    db.add(d)
    db.commit()
    db.refresh(d)

    extract_document.delay(
        d.id
    )

    audit(
        db,
        user,
        "Uploaded Document",
        name,
        "Upload accepted",
        ip(request),
    )

    return {
        "id": d.id,
        "name": d.name,
        "extraction_status": d.extraction_status,
    }


# ---------------------------------------------------------
# DOCUMENT ACTIONS
# ---------------------------------------------------------

@app.get("/api/documents/{document_id}/download")
def download_document(
    document_id: int,
    user=Depends(
        require_permission(
            "Documents",
            "view",
        )
    ),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if not document:
        raise HTTPException(404, "Document not found")

    tmp = f"/tmp/agis-download-{document.id}-{document.name}"

    try:
        get_object(document.object_key, tmp)

        return FileResponse(
            tmp,
            media_type=document.mime_type,
            filename=document.name,
        )
    except Exception as e:
        raise HTTPException(
            500,
            f"Unable to download document: {e}",
        )


@app.get("/api/documents/{document_id}/preview")
def preview_document(
    document_id: int,
    user=Depends(
        require_permission(
            "Documents",
            "view",
        )
    ),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if not document:
        raise HTTPException(404, "Document not found")

    tmp = f"/tmp/agis-preview-{document.id}-{document.name}"

    try:
        get_object(document.object_key, tmp)

        return FileResponse(
            tmp,
            media_type=document.mime_type,
            filename=document.name,
            headers={
                "Content-Disposition": f'inline; filename="{document.name}"'
            },
        )
    except Exception as e:
        raise HTTPException(
            500,
            f"Unable to preview document: {e}",
        )


@app.post("/api/documents/{document_id}/reprocess")
def reprocess_document(
    document_id: int,
    request: Request,
    user=Depends(
        require_permission(
            "Documents",
            "update",
        )
    ),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if not document:
        raise HTTPException(404, "Document not found")

    document.extraction_status = "Queued"
    document.extracted_text = ""
    db.commit()
    db.refresh(document)

    extract_document.delay(document.id)

    audit(
        db,
        user,
        "Document Reprocessing Requested",
        "Documents",
        f"Reprocessing requested for document {document.name}",
        ip(request),
    )

    return {
        "message": "Document reprocessing started",
        "id": document.id,
        "status": document.extraction_status,
    }


@app.delete("/api/documents/{document_id}")
def delete_document(
    document_id: int,
    request: Request,
    user=Depends(
        require_permission(
            "Documents",
            "delete",
        )
    ),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)

    if not document:
        raise HTTPException(404, "Document not found")

    document_name = document.name
    object_key = document.object_key

    try:
        delete_object(object_key)
    except Exception as e:
        raise HTTPException(
            500,
            f"Unable to delete stored document: {e}",
        )

    db.delete(document)
    db.commit()

    audit(
        db,
        user,
        "Document Deleted",
        "Documents",
        f"Document {document_name} deleted",
        ip(request),
    )

    return {
        "message": "Document deleted successfully",
        "id": document_id,
    }


# =========================================================
# TRANSFORMATIONS
# =========================================================

@app.post("/api/transformations")
def create_transform(
    b: TransformRequest,
    request: Request,

    user=Depends(
        require_permission(
            "Transformations",
            "create",
        )
    ),

    db: Session = Depends(get_db),
):
    d = db.get(
        Document,
        b.document_id,
    )

    if not d:
        raise HTTPException(
            404,
            "Document not found",
        )

    if d.extraction_status != "Complete":

        raise HTTPException(
            409,
            "Document extraction is not complete",
        )

    t = Transformation(
        **b.model_dump(),
        created_by=user.id,
        model=settings.openai_model,
        status="Queued",
    )

    db.add(t)
    db.commit()
    db.refresh(t)

    generate_transformation.delay(
        t.id
    )

    audit(
        db,
        user,
        "Created Transformation",
        d.name,
        f"Transformation #{t.id}",
        ip(request),
    )

    return {
        "id": t.id,
        "status": t.status,
    }


# ---------------------------------------------------------
# TRANSFORMATION LIST
# ---------------------------------------------------------

@app.get("/api/transformations")
def transforms(
    user=Depends(
        require_permission(
            "Transformations",
            "view",
        )
    ),
    db: Session = Depends(get_db),
):
    return [
        {
            "id": x.id,
            "document_id": x.document_id,
            "output_type": x.output_type,
            "status": x.status,
            "output": x.output,
            "created_at": x.created_at.isoformat(),
        }

        for x in db.query(
            Transformation
        )
        .order_by(
            Transformation.created_at.desc()
        )
        .all()
    ]


# ---------------------------------------------------------
# TRANSFORMATION DETAIL
# ---------------------------------------------------------

@app.get("/api/transformations/{tid}")
def transform_detail(
    tid: int,

    user=Depends(
        require_permission(
            "Transformations",
            "view",
        )
    ),

    db: Session = Depends(get_db),
):
    x = db.get(
        Transformation,
        tid,
    )

    if not x:
        raise HTTPException(
            404,
            "Not found",
        )

    return {
        "id": x.id,
        "document_id": x.document_id,
        "output_type": x.output_type,
        "target_audience": x.target_audience,
        "language": x.language,
        "objective": x.objective,
        "tone": x.tone,
        "detail_level": x.detail_level,
        "content_style": x.content_style,
        "status": x.status,
        "output": x.output,
        "review_comment": x.review_comment,
    }


# =========================================================
# REVIEW & APPROVAL
# =========================================================

@app.post("/api/transformations/{tid}/review")
def review(
    tid: int,
    b: ReviewRequest,
    request: Request,

    user=Depends(
        require_permission(
            "Review & Approval",
            "approve",
        )
    ),

    db: Session = Depends(get_db),
):
    x = db.get(
        Transformation,
        tid,
    )

    if not x:
        raise HTTPException(
            404,
            "Not found",
        )

    mapping = {
        "Approve": "Approved",
        "Request Changes": "Changes Requested",
        "Reject": "Rejected",
    }

    if b.decision not in mapping:
        raise HTTPException(
            400,
            "Invalid decision",
        )

    x.status = mapping[
        b.decision
    ]

    x.reviewed_by = user.id
    x.review_comment = b.comment

    db.commit()

    audit(
        db,
        user,
        b.decision,
        f"Transformation #{tid}",
        b.comment,
        ip(request),
    )

    return {
        "status": x.status
    }


# =========================================================
# AUDIT LOGS
# =========================================================

@app.get("/api/audit-logs")
def logs(
    user=Depends(
        require_permission(
            "Audit Logs",
            "view",
        )
    ),

    db: Session = Depends(get_db),
):
    audit_logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(500)
        .all()
    )

    result = []

    for x in audit_logs:
        audit_user = db.get(User, x.user_id) if x.user_id else None

        result.append(
            {
                "id": x.id,
                "timestamp": x.timestamp.isoformat(),
                "user_id": x.user_id,
                "user": audit_user.name if audit_user else "System",
                "username": audit_user.username if audit_user else "",
                "email": audit_user.email if audit_user else "",
                "role": x.role,
                "action": x.action,
                "resource": x.resource,
                "details": x.details,
                "ip_address": x.ip_address,
            }
        )

    return result


# =========================================================
# USER MANAGEMENT
# =========================================================

@app.get("/api/users")
def users(
    user=Depends(
        require_permission(
            "User Management",
            "view",
        )
    ),

    db: Session = Depends(get_db),
):
    return [
        {
            "id": x.id,
            "name": x.name,
            "email": x.email,
            "role": x.role,

            "status": (
                "Active"
                if x.active
                else "Inactive"
            ),

            "active": x.active,

            "approval_status": (
                x.approval_status
            ),

            "approved_by": (
                x.approved_by
            ),
        }

        for x in db.query(
            User
        )
        .order_by(
            User.name
        )
        .all()
    ]


# ---------------------------------------------------------
# REQUEST REVIEWER APPROVAL OTP
# ---------------------------------------------------------

@app.post("/api/users/{user_id}/approval/request")
def request_approval_otp(
    user_id: int,
    b: ApprovalOTPRequest,
    request: Request,

    user=Depends(
        require_permission(
            "User Management",
            "approve",
        )
    ),

    db: Session = Depends(get_db),
):
    # Only an approved active Administrator can request
    # Reviewer approval OTPs.
    if (
        user.role != "Administrator"
        or user.approval_status != "Approved"
        or not user.active
    ):
        raise HTTPException(
            403,
            "Administrator approval required",
        )

    limit(
        f"approval-otp-request:{user.id}:{user_id}",
        5,
        3600,
    )

    if b.user_id != user_id:
        raise HTTPException(
            400,
            "User ID does not match request path",
        )

    target = db.get(
        User,
        user_id,
    )

    if not target:
        raise HTTPException(
            404,
            "User not found",
        )

    if target.role != "Reviewer":
        raise HTTPException(
            400,
            "Only Reviewer accounts can be approved with OTP",
        )

    if target.approval_status != "Pending":
        raise HTTPException(
            409,
            "Reviewer is not pending approval",
        )

    if not target.email:
        raise HTTPException(
            400,
            "Reviewer has no registered email",
        )

    if not target.email_verified:
        raise HTTPException(
            403,
            "Reviewer email must be verified first",
        )

    if b.channel != "email":
        raise HTTPException(
            400,
            "Only email approval OTP is currently supported",
        )

    # Invalidate any previous active approval challenge.
    db.query(
        ApprovalChallenge
    ).filter(
        ApprovalChallenge.target_user_id == target.id,
        ApprovalChallenge.consumed == False,
    ).update(
        {"consumed": True},
        synchronize_session=False,
    )

    code = random_otp()

    challenge = ApprovalChallenge(
        target_user_id=target.id,
        requested_by=user.id,
        channel="email",
        code_hash=hash_value(code),
        expires_at=(
            datetime.now(timezone.utc)
            + timedelta(
                minutes=settings.otp_minutes
            )
        ),
        consumed=False,
        attempts=0,
    )

    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    send_otp(
        target.email,
        code,
    )

    audit(
        db,
        user,
        "Approval OTP Requested",
        "User Management",
        (
            f"Approval OTP requested for Reviewer "
            f"{target.username}"
        ),
        ip(request),
    )

    return {
        "message": "Approval OTP sent successfully",
        "challenge_id": challenge.id,
        "channel": "email",
    }


# ---------------------------------------------------------
# VERIFY REVIEWER APPROVAL OTP
# ---------------------------------------------------------

@app.post("/api/auth/approval/verify")
def verify_approval_otp(
    b: ApprovalOTPVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    limit(
        f"approval-otp-verify:{ip(request)}",
        10,
        60,
    )

    challenge = db.get(
        ApprovalChallenge,
        b.challenge_id,
    )

    if not challenge:
        raise HTTPException(
            404,
            "Approval challenge not found",
        )

    if challenge.consumed:
        raise HTTPException(
            400,
            "Approval OTP has already been used",
        )

    now = datetime.now(timezone.utc)

    if challenge.expires_at <= now:
        challenge.consumed = True
        db.commit()

        raise HTTPException(
            400,
            "Approval OTP has expired",
        )

    if challenge.attempts >= settings.otp_max_attempts:
        challenge.consumed = True
        db.commit()

        raise HTTPException(
            429,
            "Maximum OTP attempts exceeded",
        )

    target = db.get(
        User,
        challenge.target_user_id,
    )

    if not target:
        challenge.consumed = True
        db.commit()

        raise HTTPException(
            404,
            "Reviewer account not found",
        )

    if target.role != "Reviewer":
        challenge.consumed = True
        db.commit()

        raise HTTPException(
            400,
            "Approval OTP is only valid for Reviewer accounts",
        )

    if target.approval_status != "Pending":
        challenge.consumed = True
        db.commit()

        raise HTTPException(
            409,
            "Reviewer is no longer pending approval",
        )

    challenge.attempts += 1

    if not secrets.compare_digest(
        hash_value(b.code),
        challenge.code_hash,
    ):
        if challenge.attempts >= settings.otp_max_attempts:
            challenge.consumed = True

        db.commit()

        raise HTTPException(
            401,
            "Invalid approval OTP",
        )

    # OTP is valid. Complete approval.
    challenge.consumed = True

    target.approval_status = "Approved"
    target.active = True
    target.approved_by = challenge.requested_by

    db.commit()
    db.refresh(target)

    approver = db.get(
        User,
        challenge.requested_by,
    )

    audit(
        db,
        approver,
        "Reviewer Approved",
        "User Management",
        (
            f"Reviewer {target.username} "
            f"approved through email approval OTP"
        ),
        ip(request),
    )

    return {
        "success": True,
        "message": "Reviewer approved successfully",
        "user_id": target.id,
        "username": target.username,
        "role": target.role,
        "approval_status": target.approval_status,
        "active": target.active,
        "approved_by": target.approved_by,
    }


# =========================================================
# ROLES & PERMISSIONS
# =========================================================

@app.get("/api/roles")
def roles(
    user=Depends(
        require_permission(
            "Roles & Permissions",
            "view",
        )
    ),

    db: Session = Depends(get_db),
):
    return [
        {
            "id": x.id,
            "role": x.role,
            "resource": x.resource,
            "action": x.action,
        }

        for x in db.query(
            Permission
        )
        .order_by(
            Permission.role,
            Permission.resource,
        )
        .all()
    ]


# =========================================================
# TEMPLATES
# =========================================================

@app.get("/api/templates")
def templates(
    user=Depends(
        require_permission(
            "Templates",
            "view",
        )
    ),

    db: Session = Depends(get_db),
):
    return [
        {
            "id": x.id,
            "name": x.name,
            "category": x.category,
            "output_type": x.output_type,
            "audience": x.audience,
            "description": x.description,
            "tags": x.tags,
            "status": x.status,
            "version": x.version,
        }

        for x in db.query(
            Template
        )
        .order_by(
            Template.name
        )
        .all()
    ]