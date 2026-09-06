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
from .storage import ensure_bucket, put_object
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

    # Validate role
    if b.role not in allowed_roles:
        raise HTTPException(
            400,
            "Invalid role",
        )

    # Username uniqueness
    if db.query(User).filter(
        User.username == b.username
    ).first():

        raise HTTPException(
            409,
            "Username already exists",
        )

    # Email uniqueness
    if db.query(User).filter(
        User.email == b.email
    ).first():

        raise HTTPException(
            409,
            "Email already registered",
        )

    # Mobile uniqueness
    if db.query(User).filter(
        User.mobile == b.mobile
    ).first():

        raise HTTPException(
            409,
            "Mobile number already registered",
        )

    # -----------------------------------------------------
    # APPROVAL RULE
    #
    # Operator:
    #   Automatically approved
    #
    # Reviewer:
    #   Administrator approval required
    #
    # Administrator:
    #   Administrator approval required
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

        password_hash=hash_password(
            b.password
        ),

        role=b.role,

        active=(
            b.role == "Operator"
        ),

        mfa_enabled=True,

        email_verified=False,
        mobile_verified=False,

        approval_status=approval_status,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # -----------------------------------------------------
    # CREATE OTP
    # -----------------------------------------------------

    code = random_otp()

    challenge = OTPChallenge(
    user_id=user.id,

    code_hash=hash_value(
        code
    ),

    expires_at=(
        datetime.now(timezone.utc)
        + timedelta(
            minutes=settings.otp_minutes
        )
    ),

    channel="email",
)

    db.add(challenge)
    db.commit()

    # Send OTP
    send_otp(
        user.email,
        code,
    )

    # Audit
    audit(
        db,
        user,
        "Registration",
        "Authentication",
        f"Registration requested for {b.role}",
        ip(request),
    )

    return {
        "challenge_id": challenge.id,
        "requires_otp": True,
        "approval_status": approval_status,

        "message": (
            "Registration successful. Verify your OTP."
            if b.role == "Operator"
            else
            "Registration submitted. Verify your OTP; "
            "administrator approval is required."
        ),
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

    ch = db.get(
        OTPChallenge,
        b.challenge_id,
    )

    # Validate challenge
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

    # Validate OTP
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

    # Contact verification
    user.email_verified = True
    user.mobile_verified = True

    db.commit()

    # Audit
    audit(
        db,
        user,
        "Registration OTP Verified",
        "Authentication",
        "Registration contact verification completed",
        ip(request),
    )

    return {
        "verified": True,
        "approval_status": user.approval_status,
        "active": user.active,
        "role": user.role,

        "message": (
            "Registration verified. You can now log in."
            if user.approval_status == "Approved"
            else
            "Registration verified. Administrator approval "
            "is required before login."
        ),
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
    return {
        "counts": {
            "documents": db.query(
                Document
            ).count(),

            "processed": db.query(
                Document
            ).filter(
                Document.extraction_status
                == "Complete"
            ).count(),

            "for_review": db.query(
                Transformation
            ).filter(
                Transformation.status
                == "Ready for Review"
            ).count(),

            "approved": db.query(
                Transformation
            ).filter(
                Transformation.status
                == "Approved"
            ).count(),
        },

        "recent": [
            {
                "id": x.id,
                "name": x.name,
                "status": x.status,
                "created_at": x.created_at.isoformat(),
            }

            for x in db.query(
                Document
            )
            .order_by(
                Document.created_at.desc()
            )
            .limit(8)
        ],
    }


# =========================================================
# DOCUMENTS
# =========================================================

@app.get("/api/documents")
def documents(
    user=Depends(
        require_permission(
            "Documents",
            "view",
        )
    ),
    db: Session = Depends(get_db),
):
    return [
        {
            "id": x.id,
            "name": x.name,
            "mime_type": x.mime_type,
            "size_bytes": x.size_bytes,
            "status": x.status,
            "extraction_status": x.extraction_status,
            "created_at": x.created_at.isoformat(),
        }

        for x in db.query(
            Document
        )
        .order_by(
            Document.created_at.desc()
        )
        .all()
    ]


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
    return [
        {
            "id": x.id,
            "timestamp": x.timestamp.isoformat(),
            "role": x.role,
            "action": x.action,
            "resource": x.resource,
            "details": x.details,
            "ip_address": x.ip_address,
        }

        for x in db.query(
            AuditLog
        )
        .order_by(
            AuditLog.timestamp.desc()
        )
        .limit(500)
        .all()
    ]


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
# APPROVE / REJECT USER
# ---------------------------------------------------------

@app.post("/api/users/{user_id}/approval")
def update_user_approval(
    user_id: int,
    b: UserApprovalRequest,
    request: Request,

    user=Depends(
        require_permission(
            "User Management",
            "approve",
        )
    ),

    db: Session = Depends(get_db),
):
    # -----------------------------------------------------
    # Validate action
    # -----------------------------------------------------

    if b.action not in {
        "approve",
        "reject",
    }:
        raise HTTPException(
            400,
            "Invalid approval action",
        )

    # -----------------------------------------------------
    # Find target user
    # -----------------------------------------------------

    target = db.get(
        User,
        user_id,
    )

    if not target:
        raise HTTPException(
            404,
            "User not found",
        )

    # -----------------------------------------------------
    # Only these roles need approval
    # -----------------------------------------------------

    if target.role not in {
        "Reviewer",
        "Administrator",
    }:
        raise HTTPException(
            400,
            "Only Reviewer and Administrator registrations require approval",
        )

    # -----------------------------------------------------
    # Prevent self approval
    # -----------------------------------------------------

    if target.id == user.id:
        raise HTTPException(
            400,
            "You cannot approve your own account",
        )

    # =====================================================
    # APPROVE
    # =====================================================

    if b.action == "approve":

        target.approval_status = "Approved"
        target.active = True
        target.approved_by = user.id

        db.commit()

        audit(
            db,
            user,
            "User Approved",
            "User Management",
            (
                f"Approved registration for "
                f"{target.username} "
                f"({target.role})"
            ),
            ip(request),
        )

        return {
            "success": True,
            "user_id": target.id,
            "username": target.username,
            "role": target.role,
            "approval_status": target.approval_status,
            "active": target.active,
            "approved_by": target.approved_by,
            "message": "User approved and activated",
        }

    # =====================================================
    # REJECT
    # =====================================================

    target.approval_status = "Rejected"
    target.active = False
    target.approved_by = user.id

    db.commit()

    audit(
        db,
        user,
        "User Rejected",
        "User Management",
        (
            f"Rejected registration for "
            f"{target.username} "
            f"({target.role})"
        ),
        ip(request),
    )

    return {
        "success": True,
        "user_id": target.id,
        "username": target.username,
        "role": target.role,
        "approval_status": target.approval_status,
        "active": target.active,
        "approved_by": target.approved_by,
        "message": "User registration rejected",
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