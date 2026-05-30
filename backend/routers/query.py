from fastapi import APIRouter, HTTPException

from backend.models.schemas import QueryRequest, QueryResponse
from backend.services.query_router import route_query

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def handle_query(body: QueryRequest):
    try:
        result = route_query(body.query, history=body.history)
    except Exception as e:
        raise HTTPException(502, detail=f"Query failed: {type(e).__name__}")

    if not isinstance(result, dict):
        raise HTTPException(502, detail="Query returned unexpected result")

    # Extract confidence from data if present (e.g. penalty intent)
    confidence = None
    data = result.get("data")
    if isinstance(data, dict):
        confidence = data.get("confidence")

    return QueryResponse(
        answer=result.get("answer", "No answer generated."),
        engine=result.get("engine", "unknown"),
        chart=result.get("chart"),
        confidence=confidence,
    )
