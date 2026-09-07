from app.db import Base, engine, SessionLocal
from app.models import User, Permission, Template
from app.security import hash_password

Base.metadata.create_all(engine)
db = SessionLocal()

if db.query(User).count() == 0:
    db.add_all([
        User(
            username="operator",
            email="operator@example.gov",
            name="Ram Verma",
            password_hash=hash_password("change-me"),
            role="Operator",
        ),
        User(
            username="reviewer",
            email="reviewer@example.gov",
            name="Rohit Sharma",
            password_hash=hash_password("change-me"),
            role="Reviewer",
        ),
        User(
            username="admin",
            email="admin@example.gov",
            name="Administrator",
            password_hash=hash_password("change-me"),
            role="Administrator",
        ),
    ])

resources = [
    "Dashboard",
    "Documents",
    "Transformations",
    "Review & Approval",
    "Audit Logs",
    "User Management",
    "Roles & Permissions",
    "Templates",
]

for role in ["Administrator", "Reviewer", "Operator"]:
    for resource in resources:
        actions = ["view"]

        if role == "Operator" and resource in ["Documents", "Transformations"]:
            actions += ["create"]

        if role in ["Reviewer", "Administrator"] and resource == "Review & Approval":
            actions += ["approve"]

        if role == "Administrator":
            actions = ["view", "create", "approve", "export", "configure"]

        for action in actions:
            exists = db.query(Permission).filter(
                Permission.role == role,
                Permission.resource == resource,
                Permission.action == action,
            ).first()

            if not exists:
                db.add(
                    Permission(
                        role=role,
                        resource=resource,
                        action=action,
                    )
                )

if db.query(Template).count() == 0:
    db.add_all([
        Template(
            name="Executive Summary Template",
            category="Reports",
            output_type="Executive Summary",
            audience="Leadership",
            description="Structured executive summary",
            tags="executive,summary",
        ),
        Template(
            name="Intelligence Brief",
            category="Briefs",
            output_type="Intelligence Brief",
            audience="Analyst",
            description="Concise intelligence brief",
            tags="intelligence,brief",
        ),
    ])

db.commit()
db.close()
