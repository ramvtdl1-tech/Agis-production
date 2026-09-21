import base64
from pathlib import Path

from pypdf import PdfReader
from docx import Document as DocxDocument
from openpyxl import load_workbook
from openai import OpenAI

from .settings import settings


def extract_pdf(path):
    # First try normal PDF text extraction.
    text = "\n\n".join(
        p.extract_text() or ""
        for p in PdfReader(path).pages
    ).strip()

    if text:
        return text

    # Fallback for scanned/image-only PDFs.
    if not settings.openai_api_key:
        raise RuntimeError(
            "PDF contains no extractable text and OPENAI_API_KEY is not configured"
        )

    with open(path, "rb") as f:
        pdf_b64 = base64.b64encode(f.read()).decode("utf-8")

    client = OpenAI(api_key=settings.openai_api_key)

    response = client.responses.create(
        model=settings.openai_model,
        instructions=(
            "Extract all readable text from the supplied PDF. "
            "Return only the document text. Preserve headings, lists, "
            "tables, names, dates, numbers, and structure as accurately "
            "as possible. Do not summarize or invent content."
        ),
        input=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_file",
                        "filename": Path(path).name,
                        "file_data": f"data:application/pdf;base64,{pdf_b64}",
                    },
                    {
                        "type": "input_text",
                        "text": "Transcribe the PDF faithfully.",
                    },
                ],
            }
        ],
    )

    extracted = (response.output_text or "").strip()

    if not extracted:
        raise RuntimeError("PDF OCR/text extraction returned no text")

    return extracted


def extract_docx(path):
    d = DocxDocument(path)
    out = [p.text for p in d.paragraphs if p.text.strip()]

    for t in d.tables:
        for r in t.rows:
            out.append(" | ".join(c.text.strip() for c in r.cells))

    return "\n".join(out).strip()


def extract_xlsx(path):
    wb = load_workbook(path, read_only=True, data_only=True)
    out = []

    for ws in wb.worksheets:
        out.append(f"[SHEET: {ws.title}]")

        for row in ws.iter_rows(values_only=True):
            vals = ["" if v is None else str(v) for v in row]

            if any(vals):
                out.append(" | ".join(vals))

    return "\n".join(out).strip()


def extract(path, mime):
    ext = Path(path).suffix.lower()

    if mime == "application/pdf" or ext == ".pdf":
        return extract_pdf(path)

    if ext == ".docx":
        return extract_docx(path)

    if ext in {".xlsx", ".xlsm"}:
        return extract_xlsx(path)

    if ext in {".txt", ".csv"}:
        return Path(path).read_text(errors="ignore")

    raise ValueError("Unsupported document type")
