"""CDC/NEB PDF scraper — downloads syllabus PDFs and detects changes via SHA-256."""

import hashlib
from typing import Optional

import aiohttp


async def scrape_pdf(url: Optional[str]) -> tuple[bytes, str]:
    """
    Download a PDF from the given URL.
    Returns (pdf_bytes, sha256_hex).
    """
    if not url:
        raise ValueError("source_url is required when not uploading a file directly.")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; SikshaSajilo-Pipeline/1.0; "
            "+https://siksha-sajilo.vercel.app)"
        )
    }

    async with aiohttp.ClientSession(headers=headers) as session:
        async with session.get(url, allow_redirects=True, timeout=aiohttp.ClientTimeout(total=60)) as resp:
            if resp.status != 200:
                raise RuntimeError(
                    f"Failed to download PDF from {url} — HTTP {resp.status}"
                )
            if "pdf" not in resp.content_type.lower() and not url.lower().endswith(".pdf"):
                raise RuntimeError(
                    f"URL does not appear to serve a PDF (Content-Type: {resp.content_type})"
                )
            content = await resp.read()

    sha256 = hashlib.sha256(content).hexdigest()
    return content, sha256


def compute_hash(content: bytes) -> str:
    """Compute SHA-256 hash of raw bytes."""
    return hashlib.sha256(content).hexdigest()
