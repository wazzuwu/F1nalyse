from fastapi import APIRouter, HTTPException

from backend.models.schemas import PenaltyRequest, PenaltyResponse
from backend.services.rag_engine import query as rag_query

router = APIRouter()


@router.post("/predict", response_model=PenaltyResponse)
async def predict_penalty(body: PenaltyRequest):
    filters = {}
    if body.year:
        filters["year"] = body.year
    if body.breach_type:
        filters["breach_category"] = body.breach_type

    try:
        result = rag_query(body.incident, filters=filters if filters else None)
    except Exception as e:
        raise HTTPException(502, detail=f"Penalty prediction failed: {type(e).__name__}")

    return PenaltyResponse(
        prediction=result.get("prediction", "Unable to predict."),
        confidence=result.get("confidence", 0.0),
        precedents=result.get("cited_precedents", []),
        reasoning=result.get("reasoning", ""),
    )
