import boto3
from .settings import settings
client=boto3.client("s3",endpoint_url=settings.s3_endpoint or None,
    aws_access_key_id=settings.s3_access_key or None,aws_secret_access_key=settings.s3_secret_key or None,
    region_name=settings.s3_region)
def ensure_bucket():
    try:client.head_bucket(Bucket=settings.s3_bucket)
    except Exception:client.create_bucket(Bucket=settings.s3_bucket)
def put_object(key,path,content_type):
    with open(path,"rb") as f:client.upload_fileobj(f,settings.s3_bucket,key,ExtraArgs={"ContentType":content_type})
def get_object(key,target):client.download_file(settings.s3_bucket,key,target)
