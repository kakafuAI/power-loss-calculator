"""PDF datasheet upload and parsing endpoints."""

import tempfile
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from ..parser.pdf_reader import extract_pdf, extract_datasheet_metadata
from ..parser.igbt_parser import extract_igbt_params, params_to_dict as igbt_to_dict
from ..parser.sic_parser import extract_sic_params, sic_params_to_dict

router = APIRouter()


@router.post("/datasheet/parse")
async def parse_datasheet(
    file: UploadFile = File(...),
    device_type: str = Form("igbt_module"),
):
    """
    Upload a datasheet PDF and extract device parameters.

    Returns extracted parameters with confidence scores for each value.
    User can review and manually correct before calculation.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = extract_pdf(tmp_path)
        metadata = extract_datasheet_metadata(result)

        is_sic = "sic" in device_type.lower()

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
            "raw_text_sample": result.full_text[:2000],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {str(e)}")

    finally:
        Path(tmp_path).unlink(missing_ok=True)
