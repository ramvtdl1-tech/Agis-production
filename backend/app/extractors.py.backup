from pathlib import Path
from pypdf import PdfReader
from docx import Document as DocxDocument
from openpyxl import load_workbook
def extract_pdf(path):
    return "\n\n".join(p.extract_text() or "" for p in PdfReader(path).pages).strip()
def extract_docx(path):
    d=DocxDocument(path);out=[p.text for p in d.paragraphs if p.text.strip()]
    for t in d.tables:
        for r in t.rows:out.append(" | ".join(c.text.strip() for c in r.cells))
    return "\n".join(out).strip()
def extract_xlsx(path):
    wb=load_workbook(path,read_only=True,data_only=True);out=[]
    for ws in wb.worksheets:
        out.append(f"[SHEET: {ws.title}]")
        for row in ws.iter_rows(values_only=True):
            vals=["" if v is None else str(v) for v in row]
            if any(vals):out.append(" | ".join(vals))
    return "\n".join(out).strip()
def extract(path,mime):
    ext=Path(path).suffix.lower()
    if mime=="application/pdf" or ext==".pdf":return extract_pdf(path)
    if ext==".docx":return extract_docx(path)
    if ext in {".xlsx",".xlsm"}:return extract_xlsx(path)
    if ext in {".txt",".csv"}:return Path(path).read_text(errors="ignore")
    raise ValueError("Unsupported document type")
