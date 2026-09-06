from .models import AuditLog
def audit(db,user,action,resource,details="",ip=""):
    db.add(AuditLog(user_id=user.id if user else None,role=user.role if user else "",
                    action=action,resource=resource,details=details,ip_address=ip));db.commit()
