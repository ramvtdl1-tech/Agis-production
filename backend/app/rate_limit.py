import time,redis
from fastapi import HTTPException
from .settings import settings
r=redis.from_url(settings.redis_url,decode_responses=True)
def limit(key,count,window):
    k=f"rl:{key}:{int(time.time())//window}"
    n=r.incr(k)
    if n==1:r.expire(k,window)
    if n>count:raise HTTPException(429,"Too many requests; try again later")
