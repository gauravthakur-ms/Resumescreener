"""Text extraction from PDF and DOCX files — migrated from original code."""

import fitz  # PyMuPDF
import docx
import io
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)


def extract_text_from_pdf(file_bytes: bytes, file_name: str = "") -> str:
    """Extract text from a PDF file given as bytes."""
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = "".join([page.get_text() for page in doc])
        doc.close()
        return text
    except Exception as e:
        log_with_context(logger, "ERROR", f"Failed to extract text from PDF: {e}",
                        stage="text_extraction", file_name=file_name)
        return ""


def extract_text_from_docx(file_bytes: bytes, file_name: str = "") -> str:
    """Extract text from a DOCX file given as bytes."""
    try:
        doc = docx.Document(io.BytesIO(file_bytes))
        text = "\n".join([para.text for para in doc.paragraphs])
        return text
    except Exception as e:
        log_with_context(logger, "ERROR", f"Failed to extract text from DOCX: {e}",
                        stage="text_extraction", file_name=file_name)
        return ""


def extract_text(file_bytes: bytes, file_name: str) -> str:
    """Extract text from a resume file (PDF or DOCX).
    
    Returns empty string if extraction fails or format is unsupported.
    """
    lower_name = file_name.lower()
    if lower_name.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes, file_name)
    elif lower_name.endswith(".docx"):
        return extract_text_from_docx(file_bytes, file_name)
    else:
        log_with_context(logger, "WARNING", f"Unsupported file format: {file_name}",
                        stage="text_extraction", file_name=file_name)
        return ""
