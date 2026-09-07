from datetime import datetime, timezone
from sqlalchemy import Boolean,DateTime,ForeignKey,Integer,String,Text,UniqueConstraint
from sqlalchemy.orm import Mapped,mapped_column
from .db import Base
def utcnow(): return datetime.now(timezone.utc)

class User(Base):
    __tablename__="users"
    id:Mapped[int]=mapped_column(primary_key=True)
    username:Mapped[str]=mapped_column(String(80),unique=True,index=True)
    email:Mapped[str]=mapped_column(String(180),unique=True,index=True)
    name:Mapped[str]=mapped_column(String(160))
    password_hash:Mapped[str]=mapped_column(String(255))
    role:Mapped[str]=mapped_column(String(60),index=True)
    active:Mapped[bool]=mapped_column(Boolean,default=True)
    mfa_enabled:Mapped[bool]=mapped_column(Boolean,default=True)

    mobile:Mapped[str|None]=mapped_column(String(30),unique=True,nullable=True)
    email_verified:Mapped[bool]=mapped_column(Boolean,default=False)
    mobile_verified:Mapped[bool]=mapped_column(Boolean,default=False)

    approval_status:Mapped[str]=mapped_column(
        String(30),
        default="Approved",
        index=True
    )

    approved_by:Mapped[int|None]=mapped_column(
        ForeignKey("users.id"),
        nullable=True
    )

    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow)
    last_active:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow)

class OTPChallenge(Base):
    __tablename__ = "otp_challenges"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True,
    )

    # email or mobile
    channel: Mapped[str] = mapped_column(
        String(20),
        index=True,
    )

    code_hash: Mapped[str] = mapped_column(
        String(255),
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
    )

    consumed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )

    attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
class ApprovalChallenge(Base):
    __tablename__ = "approval_challenges"

    id: Mapped[int] = mapped_column(primary_key=True)

    target_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True,
    )

    requested_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True,
    )

    channel: Mapped[str] = mapped_column(
        String(20),
        index=True,
    )

    code_hash: Mapped[str] = mapped_column(
        String(255),
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
    )

    consumed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )

    attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
class RefreshToken(Base):
    __tablename__="refresh_tokens"
    id:Mapped[int]=mapped_column(primary_key=True)
    user_id:Mapped[int]=mapped_column(ForeignKey("users.id"),index=True)
    token_hash:Mapped[str]=mapped_column(String(128),unique=True,index=True)
    expires_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),index=True)
    revoked:Mapped[bool]=mapped_column(Boolean,default=False)

class Permission(Base):
    __tablename__="permissions"
    id:Mapped[int]=mapped_column(primary_key=True)
    role:Mapped[str]=mapped_column(String(60),index=True)
    resource:Mapped[str]=mapped_column(String(100),index=True)
    action:Mapped[str]=mapped_column(String(50),index=True)
    __table_args__=(UniqueConstraint("role","resource","action"),)

class Document(Base):
    __tablename__="documents"
    id:Mapped[int]=mapped_column(primary_key=True)
    name:Mapped[str]=mapped_column(String(255))
    mime_type:Mapped[str]=mapped_column(String(150))
    size_bytes:Mapped[int]=mapped_column(Integer)
    object_key:Mapped[str]=mapped_column(String(500),unique=True)
    extracted_text:Mapped[str]=mapped_column(Text,default="")
    extraction_status:Mapped[str]=mapped_column(String(40),default="Queued")
    status:Mapped[str]=mapped_column(String(40),default="Ready")
    owner_id:Mapped[int]=mapped_column(ForeignKey("users.id"),index=True)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow)

class Transformation(Base):
    __tablename__="transformations"
    id:Mapped[int]=mapped_column(primary_key=True)
    document_id:Mapped[int]=mapped_column(ForeignKey("documents.id"),index=True)
    output_type:Mapped[str]=mapped_column(String(100))
    target_audience:Mapped[str]=mapped_column(String(120))
    language:Mapped[str]=mapped_column(String(50))
    objective:Mapped[str]=mapped_column(String(80))
    tone:Mapped[str]=mapped_column(String(80))
    detail_level:Mapped[str]=mapped_column(String(50))
    content_style:Mapped[str]=mapped_column(String(80))
    model:Mapped[str]=mapped_column(String(100),default="")
    status:Mapped[str]=mapped_column(String(50),default="Queued",index=True)
    output:Mapped[str]=mapped_column(Text,default="")
    created_by:Mapped[int]=mapped_column(ForeignKey("users.id"))
    reviewed_by:Mapped[int|None]=mapped_column(ForeignKey("users.id"),nullable=True)
    review_comment:Mapped[str|None]=mapped_column(Text,nullable=True)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow)

class AuditLog(Base):
    __tablename__="audit_logs"
    id:Mapped[int]=mapped_column(primary_key=True)
    timestamp:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow,index=True)
    user_id:Mapped[int|None]=mapped_column(ForeignKey("users.id"),nullable=True)
    role:Mapped[str]=mapped_column(String(60),default="")
    action:Mapped[str]=mapped_column(String(120))
    resource:Mapped[str]=mapped_column(String(255))
    details:Mapped[str]=mapped_column(Text,default="")
    ip_address:Mapped[str]=mapped_column(String(80),default="")

class Template(Base):
    __tablename__="templates"
    id:Mapped[int]=mapped_column(primary_key=True)
    name:Mapped[str]=mapped_column(String(180))
    category:Mapped[str]=mapped_column(String(100))
    output_type:Mapped[str]=mapped_column(String(100))
    audience:Mapped[str]=mapped_column(String(100))
    description:Mapped[str]=mapped_column(Text,default="")
    tags:Mapped[str]=mapped_column(String(255),default="")
    status:Mapped[str]=mapped_column(String(30),default="Active")
    version:Mapped[str]=mapped_column(String(20),default="v1.0")


mobile: Mapped[str | None] = mapped_column(
    String(30),
    unique=True,
    index=True,
    nullable=True
)

email_verified: Mapped[bool] = mapped_column(
    Boolean,
    default=False
)

mobile_verified: Mapped[bool] = mapped_column(
    Boolean,
    default=False
)

approval_status: Mapped[str] = mapped_column(
    String(30),
    default="Approved"
)

approved_by: Mapped[int | None] = mapped_column(
    ForeignKey("users.id"),
    nullable=True
)
