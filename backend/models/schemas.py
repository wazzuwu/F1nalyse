from pydantic import BaseModel


class QueryRequest(BaseModel):
    query: str
    history: list[dict] | None = None


class QueryResponse(BaseModel):
    answer: str
    engine: str | None = None
    chart: dict | None = None
    confidence: float | None = None


class PenaltyRequest(BaseModel):
    incident: str
    year: int | None = None
    breach_type: str | None = None


class PenaltyResponse(BaseModel):
    prediction: str
    confidence: float
    precedents: list[dict]
    reasoning: str


# ---------------------------------------------------------------------------
# Race Intelligence — request schemas
# ---------------------------------------------------------------------------

class CompareRequest(BaseModel):
    drivers: list[str] = []
    constructors: list[str] = []
    circuit: str | None = None
    year: int | None = None
    session: str = "R"


class CompareResponse(BaseModel):
    type: str
    entities: list[str]
    scope: dict
    stats: dict
    weather: dict | None = None
    chart: dict | None = None
    additional_charts: list[dict] | None = None


class StandingsRequest(BaseModel):
    year: int | None = None
    type: str = "driver"
    round: int | None = None


class StandingsResponse(BaseModel):
    year: int
    type: str
    round: int | None = None
    standings: list[dict]
    chart: dict | None = None


class LapsRequest(BaseModel):
    driver: str
    circuit: str
    year: int
    session: str = "R"
    max_laps: int | None = None


class TelemetryRequest(BaseModel):
    driver: str
    circuit: str
    year: int | None = None
    session: str = "R"
    lap_number: int | None = None
    metric: str = "speed"
    compare_driver: str | None = None


class TelemetryResponse(BaseModel):
    driver: str
    circuit: str
    lap: dict | None = None
    stats: dict
    telemetry: list[dict] | None = None
    chart: dict | None = None
    track_chart: dict | None = None


class MultiTelemetryRequest(BaseModel):
    drivers: list[str]
    circuit: str
    year: int
    session: str = "R"
    lap_number: int | None = None
    metric: str = "speed"


class MultiTelemetryResponse(BaseModel):
    circuit: str
    year: int
    session: str
    metric: str
    drivers: list[dict]
    chart: dict | None = None


class GearTrackResponse(BaseModel):
    driver: str
    circuit: str
    year: int
    session: str
    lap: dict | None = None
    chart: dict | None = None
    telemetry: dict | None = None


class TeamPaceRequest(BaseModel):
    circuit: str
    year: int
    session: str = "R"
    driver: str | None = None


class TeamPaceResponse(BaseModel):
    circuit: str
    year: int
    session: str
    driver: str | None = None
    chart: dict | None = None


class TyreStrategiesRequest(BaseModel):
    circuit: str
    year: int
    session: str = "R"
    driver: str | None = None


class TyreStrategiesResponse(BaseModel):
    circuit: str
    year: int
    session: str
    driver: str | None = None
    chart: dict | None = None


class QualifyingRequest(BaseModel):
    circuit: str
    year: int
    session: str = "Q"
    driver: str | None = None


class QualifyingResponse(BaseModel):
    circuit: str
    year: int
    session: str
    driver: str | None = None
    chart: dict | None = None


class PositionChangesRequest(BaseModel):
    circuit: str
    year: int
    session: str = "R"
    driver: str | None = None


class PositionChangesResponse(BaseModel):
    circuit: str
    year: int
    session: str
    drivers: list[str]
    chart: dict | None = None
