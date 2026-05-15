"""PDF datasheet upload and parsing endpoints."""

import logging
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..parser.igbt_parser import extract_igbt_params, params_to_dict as igbt_to_dict
from ..parser.llm_parser import (
    extract_params_via_llm,
    llm_result_to_igbt_dict,
    llm_result_to_sic_dict,
)
from ..parser.pdf_reader import extract_datasheet_metadata, extract_pdf
from ..parser.sic_parser import extract_sic_params, sic_params_to_dict

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/datasheet/parse")
async def parse_datasheet(
    file: UploadFile = File(...),
    device_type: str = Form("igbt_module"),
):
    """
    Upload a datasheet PDF and extract device parameters.

    Uses DeepSeek LLM for extraction when DEEPSEEK_API_KEY is configured,
    falling back to regex patterns otherwise.

    Returns extracted parameters with confidence scores for each value.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = extract_pdf(tmp_path)
        metadata = extract_datasheet_metadata(result)
        is_sic = "sic" in device_type.lower()
        extraction_method = "regex"  # default

        # ── Try LLM extraction first ────────────────────────────────────
        if os.getenv("DEEPSEEK_API_KEY"):
            try:
                cleaned = extract_params_via_llm(result.full_text, device_type)
                if is_sic:
                    extracted = llm_result_to_sic_dict(cleaned)
                else:
                    extracted = llm_result_to_igbt_dict(cleaned)
                extraction_method = "llm"

                # Merge metadata from regex (part number / manufacturer)
                if metadata.get("part_number"):
                    extracted["part_number"] = metadata["part_number"]
                if metadata.get("manufacturer"):
                    extracted["manufacturer"] = metadata["manufacturer"]

                logger.info(
                    "LLM extraction successful for %s — %d params with confidence",
                    file.filename,
                    sum(1 for v in extracted.values() if v is not None),
                )
            except Exception as exc:
                logger.warning(
                    "LLM extraction failed for %s: %s — falling back to regex",
                    file.filename,
                    exc,
                )

        # ── Regex fallback ──────────────────────────────────────────────
        if extraction_method == "regex":
            if is_sic:
                params = extract_sic_params(result)
                extracted = sic_params_to_dict(params)
            else:
                params = extract_igbt_params(result)
                extracted = igbt_to_dict(params)

        return {
            "file_name": file.filename,
            "page_count": result.page_count,
            "metadata": metadata,
            "parameters": extracted,
            "extraction_method": extraction_method,
            "raw_text_sample": result.full_text[:3000],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {str(e)}")

    finally:
        Path(tmp_path).unlink(missing_ok=True)
