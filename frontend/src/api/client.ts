import type {
  Driver,
  Circuit,
  GearTrackResponse,
  LiveSeasonResponse,
  MultiTelemetryResponse,
  PositionChangesResponse,
  QualifyingResponse,
  RaceResultsResponse,
  StandingsResponse,
  CompareResponse,
  LapEntry,
  TelemetryResponse,
  TeamPaceResponse,
  TyreStrategiesResponse,
  QueryResponse,
  ScheduleResponse,
  NextRaceResponse,
  DriverCareerResponse,
  CircuitDetailResponse,
  ConstructorDetailResponse,
} from "../types";

const BASE = import.meta.env.VITE_API_URL;
const API = BASE ? `${BASE}/api` : "/api";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

// --- Drivers ---
export function getDrivers(year?: number): Promise<Driver[]> {
  const params = year ? `?year=${year}` : "";
  return fetchJSON<Driver[]>(`${API}/drivers${params}`);
}

// --- Driver Career ---
export function getDriverCareer(code: string): Promise<DriverCareerResponse> {
  return fetchJSON<DriverCareerResponse>(`${API}/drivers/${code.toUpperCase()}`);
}

// --- Circuits ---
export function getCircuits(): Promise<Circuit[]> {
  return fetchJSON<Circuit[]>(`${API}/circuits`);
}

export function getCircuitDetail(key: string): Promise<CircuitDetailResponse> {
  return fetchJSON<CircuitDetailResponse>(`${API}/circuits/${key}`);
}

// --- Seasons ---
export function getSeasons(): Promise<number[]> {
  return fetchJSON<number[]>(`${API}/seasons`);
}

// --- Constructors ---
export function getConstructors(): Promise<{ id: string; full_name: string; drivers: string[] }[]> {
  return fetchJSON(`${API}/constructors`);
}

export function getConstructorDetail(slug: string): Promise<ConstructorDetailResponse> {
  return fetchJSON<ConstructorDetailResponse>(`${API}/constructors/${slug}`);
}

// --- Race Results ---
export function getRaceResults(circuit: string, year: number, session = "R"): Promise<RaceResultsResponse> {
  return fetchJSON<RaceResultsResponse>(`${API}/races/${circuit}?year=${year}&session=${session}`);
}

// --- Standings ---
export function getStandings(year: number, type: "driver" | "constructor" = "driver", round?: number): Promise<StandingsResponse> {
  let url = `${API}/race/standings?year=${year}&type=${type}`;
  if (round !== undefined) url += `&round=${round}`;
  return fetchJSON<StandingsResponse>(url);
}

// --- Compare ---
export function postCompare(body: {
  drivers?: string[];
  constructors?: string[];
  circuit?: string;
  year?: number;
  session?: string;
}): Promise<CompareResponse> {
  return fetchJSON<CompareResponse>(`${API}/race/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Laps ---
export function postLaps(body: {
  driver: string;
  circuit: string;
  year: number;
  session?: string;
  max_laps?: number;
}): Promise<LapEntry[]> {
  return fetchJSON<LapEntry[]>(`${API}/race/laps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Telemetry ---
export function postTelemetry(body: {
  driver: string;
  circuit: string;
  year: number;
  session?: string;
  lap_number?: number;
  metric?: string;
  compare_driver?: string;
}): Promise<TelemetryResponse> {
  return fetchJSON<TelemetryResponse>(`${API}/race/telemetry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function postMultiTelemetry(body: {
  drivers: string[];
  circuit: string;
  year: number;
  session?: string;
  lap_number?: number;
  metric?: string;
}): Promise<MultiTelemetryResponse> {
  return fetchJSON<MultiTelemetryResponse>(`${API}/race/telemetry/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function postGearTrack(body: {
  driver: string;
  circuit: string;
  year: number;
  session?: string;
  lap_number?: number;
}): Promise<GearTrackResponse> {
  return fetchJSON<GearTrackResponse>(`${API}/race/telemetry/gear-track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Position Changes ---
export function postPositionChanges(body: {
  circuit: string;
  year: number;
  session?: string;
  driver?: string;
}): Promise<PositionChangesResponse> {
  return fetchJSON<PositionChangesResponse>(`${API}/race/position-changes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Team Pace ---
export function postTeamPace(body: {
  circuit: string;
  year: number;
  session?: string;
  driver?: string;
}): Promise<TeamPaceResponse> {
  return fetchJSON<TeamPaceResponse>(`${API}/race/team-pace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Tyre Strategies ---
export function postTyreStrategies(body: {
  circuit: string;
  year: number;
  session?: string;
  driver?: string;
}): Promise<TyreStrategiesResponse> {
  return fetchJSON<TyreStrategiesResponse>(`${API}/race/tyre-strategies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Qualifying ---
export function postQualifying(body: {
  circuit: string;
  year: number;
  session?: string;
  driver?: string;
}): Promise<QualifyingResponse> {
  return fetchJSON<QualifyingResponse>(`${API}/race/qualifying`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Schedule ---
export function getSchedule(year: number): Promise<ScheduleResponse> {
  return fetchJSON<ScheduleResponse>(`${API}/race/schedule/${year}`);
}

// --- Next Race ---
export function getNextRace(): Promise<NextRaceResponse> {
  return fetchJSON<NextRaceResponse>(`${API}/race/next`);
}

// --- Live Season (cached bundle) ---
export function getLiveSeason(force = false): Promise<LiveSeasonResponse> {
  return fetchJSON<LiveSeasonResponse>(`${API}/race/live-season${force ? "?force=true" : ""}`);
}

// --- Query ---
export function postQuery(query: string, history?: { role: string; content: string }[]): Promise<QueryResponse> {
  return fetchJSON<QueryResponse>(`${API}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, history }),
  });
}
