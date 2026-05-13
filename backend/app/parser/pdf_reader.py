"""PDF text and table extraction using pdfplumber."""

from pathlib import Path
from typing import Optional
import pdfplumber


class PDFExtractResult:
    """Result of PDF extraction containing text and tables."""

    def __init__(self):
        self.full_text: str = ""
        self.pages: list[dict] = []
        self.tables: list[list[list[str]]] = []
        self.page_count: int = 0
        self.file_name: str = ""

    def get_section(self, keyword: str, context_lines: int = 10) -> str:
        """Find text around a keyword for context-aware extraction."""
        lines = self.full_text.split("\n")
        for i, line in enumerate(lines):
            if keyword.lower() in line.lower():
                start = max(0, i - 1)
                end = min(len(lines), i + context_lines)
                return "\n".join(lines[start:end])
        return ""

    def find_table_with_header(self, header_keywords: list[str]) -> Optional[list[list[str]]]:
        """Find the first table containing all header keywords."""
        for table in self.tables:
            if not table:
                continue
            header_row = [str(cell).lower() if cell else "" for cell in table[0]]
            if all(any(kw in cell for cell in header_row) for kw in header_keywords):
                return table
        return None


def extract_pdf(file_path: str | Path) -> PDFExtractResult:
    """
    Extract text and tables from a PDF datasheet.

    Args:
        file_path: Path to PDF file

    Returns:
        PDFExtractResult with extracted content
    """
    result = PDFExtractResult()
    result.file_name = Path(file_path).name

    with pdfplumber.open(file_path) as pdf:
        result.page_count = len(pdf.pages)

        for page_num, page in enumerate(pdf.pages):
            # Extract text
            text = page.extract_text()
            if text:
                result.full_text += text + "\n"

            # Extract tables
            tables = page.extract_tables()
            for table in tables:
                if table:
                    result.tables.append(table)

            # Store page info
            result.pages.append({
                "page_num": page_num + 1,
                "text_length": len(text) if text else 0,
                "table_count": len(tables),
            })

    return result


def extract_datasheet_metadata(result: PDFExtractResult) -> dict:
    """
    Extract basic metadata from datasheet: part number, manufacturer.
    """
    from .patterns import PART_NUMBER_PATTERN, MANUFACTURER_PATTERNS

    metadata = {
        "part_number": None,
        "manufacturer": None,
        "confidence": {},
    }

    # Part number
    match = PART_NUMBER_PATTERN.search(result.full_text)
    if match:
        metadata["part_number"] = match.group(1)
        metadata["confidence"]["part_number"] = 0.8

    # Manufacturer
    for pat in MANUFACTURER_PATTERNS:
        match = pat.search(result.full_text)
        if match:
            metadata["manufacturer"] = match.group(1)
            metadata["confidence"]["manufacturer"] = 0.9
            break

    return metadata
