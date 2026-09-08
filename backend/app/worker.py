from celery import Celery
from .settings import settings
from .db import SessionLocal
from .models import Document,Transformation
from .storage import get_object
from .extractors import extract
from .ai import transform
celery_app=Celery("agis",broker=settings.redis_url,backend=settings.redis_url)

@celery_app.task(bind=True,autoretry_for=(Exception,),retry_backoff=True,max_retries=3)
def extract_document(self,doc_id):
    db=SessionLocal()
    d=None

    try:
        d=db.get(Document,doc_id)

        if not d:
            raise RuntimeError("Document not found")

        d.extraction_status="Processing"
        db.commit()

        tmp=f"/tmp/agis-{d.id}-{d.name}"

        get_object(d.object_key,tmp)

        d.extracted_text=extract(
            tmp,
            d.mime_type,
        )

        d.extraction_status="Complete"
        db.commit()

    except Exception:
        if d:
            d.extraction_status="Failed"
            db.commit()
        raise

    finally:
        db.close()

@celery_app.task(bind=True,autoretry_for=(Exception,),retry_backoff=True,max_retries=3)
def generate_transformation(self,tid):
    db=SessionLocal()
    try:
        t=db.get(Transformation,tid);d=db.get(Document,t.document_id)
        if not d.extracted_text:raise RuntimeError("Document extraction is not complete")
        t.status="Generating";db.commit()
        t.output=transform(d.extracted_text,{"output_type":t.output_type,"target_audience":t.target_audience,
          "language":t.language,"objective":t.objective,"tone":t.tone,
          "detail_level":t.detail_level,"content_style":t.content_style})
        t.status="Ready for Review";db.commit()
    finally:db.close()
