"""Google Cloud Vision OCR — extracts text from CDC syllabus PDFs (Devanagari + English)."""

import io
import json
import os
import tempfile
from typing import Optional

_vision_client = None


def _get_vision_client():
    global _vision_client
    if _vision_client is not None:
        return _vision_client

    # Support passing the service account key as a JSON string via env var
    key_json = os.environ.get("GOOGLE_CLOUD_VISION_KEY")
    if key_json:
        try:
            json.loads(key_json)  # validate it's valid JSON
            tmp = tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False
            )
            tmp.write(key_json)
            tmp.close()
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
        except json.JSONDecodeError:
            # Treat as a file path instead
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = key_json

    from google.cloud import vision

    _vision_client = vision.ImageAnnotatorClient()
    return _vision_client


async def extract_text(pdf_content: bytes) -> str:
    """
    Convert each PDF page to an image and OCR it with Google Cloud Vision.
    Returns all page text joined by page-break markers.
    """
    from pdf2image import convert_from_bytes

    # 200 DPI is sufficient for Devanagari text recognition
    images = convert_from_bytes(pdf_content, dpi=200)
    client = _get_vision_client()

    from google.cloud import vision

    pages: list[str] = []
    for page_num, image in enumerate(images, start=1):
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        img_bytes = buf.getvalue()

        vision_image = vision.Image(content=img_bytes)
        response = client.document_text_detection(image=vision_image)

        if response.error.message:
            raise RuntimeError(
                f"Cloud Vision error on page {page_num}: {response.error.message}"
            )

        pages.append(response.full_text_annotation.text or "")

    return "\n\n--- PAGE BREAK ---\n\n".join(pages)
