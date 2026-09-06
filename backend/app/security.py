from datetime import datetime,timedelta,timezone
import hashlib,secrets,jwt
from fastapi import Depends,HTTPException,status
from fastapi.security import HTTPAuthorizationCredentials,HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from .db import get_db
from .models import User,Permission
from .settings import settings
ph=PasswordHash.recommended(); bearer=HTTPBearer(auto_error=False)
def hash_password(v): return ph.hash(v)
def verify_password(v,h): return ph.verify(v,h)
def hash_value(v): return hashlib.sha256(v.encode()).hexdigest()
def random_otp(): return f"{secrets.randbelow(1000000):06d}"
def create_access_token(u):
    now=datetime.now(timezone.utc)
    return jwt.encode({"sub":str(u.id),"role":u.role,"type":"access","iat":now,
      "exp":now+timedelta(minutes=settings.access_token_minutes)},settings.jwt_secret,algorithm=settings.jwt_algorithm)
def decode(token):
    try:return jwt.decode(token,settings.jwt_secret,algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:raise HTTPException(401,"Invalid or expired access token")
def current_user(creds:HTTPAuthorizationCredentials=Depends(bearer),db:Session=Depends(get_db)):
    if not creds:raise HTTPException(401,"Authentication required")
    d=decode(creds.credentials)
    if d.get("type")!="access":raise HTTPException(401,"Invalid token type")
    u=db.get(User,int(d["sub"]))
    if not u or not u.active:raise HTTPException(401,"User inactive")
    return u
def require_permission(resource,action):
    def dep(user:User=Depends(current_user),db:Session=Depends(get_db)):
        ok=db.query(Permission).filter(Permission.role==user.role,Permission.resource==resource,Permission.action==action).first()
        if not ok:raise HTTPException(status.HTTP_403_FORBIDDEN,f"Permission denied: {action} on {resource}")
        return user
    return dep
