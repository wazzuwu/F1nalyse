export interface Driver {
  code: string;
  full_name: string;
  team: string;
}

export interface Circuit {
  key: string;
  full_name: string;
}

export interface RaceResult {
  position: number;
  code: string;
  full_name: string;
  team: string;
  time: string | null;
  gap: string | null;
  laps: number;
  status: string;
  grid: number | null;
  positions_gained: number | null;
  q1?: string | null;
  q2?: string | null;
  q3?: string | null;
  gap_to_pole?: string | null;
}

export interface RaceResultsResponse {
  circuit: string;
  year: number;
  session: string;
  results: RaceResult[];
  fastest_lap: { code: string; time: string; lap: number } | null;
  weather: { air_temp: number; track_temp: number; humidity: number } | null;
  dnfs: string[];
}

export interface Standing {
  position: number;
  code?: string;
  full_name?: string;
  id?: string;
  points: number;
  wins: number;
  team?: string;
}

export interface StandingsResponse {
  year: number;
  type: string;
  round: number | null;
  standings: Standing[];
}

export interface SessionCompareStats {
  position: number | null;
  fastest_lap: string | null;
  avg_lap_time: string | null;
  pit_stops: number;
  laps_led: number;
}

export interface CareerCompareStats {
  seasons: number;
  total_points: number;
  total_wins: number;
  best_championship: number;
  avg_points_per_season: number;
  per_season: { year: number; position: number; points: number; wins: number }[];
}

export interface AggregateCompareStats {
  races: number;
  wins: number;
  podiums: number;
  poles?: number;
  fastest_laps?: number;
  championship_position?: number;
  best_fastest_lap?: string | null;
  best_position: number | null;
  dnfs: number;
}

export type CompareStats = SessionCompareStats | CareerCompareStats | AggregateCompareStats;

export interface CompareResponse {
  type: string;
  entities: string[];
  scope: { mode?: string; circuit: string | null; year: number | null; session: string | null };
  stats: Record<string, CompareStats | null>;
  weather: { air_temp: number; track_temp: number; humidity: number } | null;
}

export interface LapEntry {
  lap_number: number;
  lap_time: string;
  sector_1_time: string | null;
  sector_2_time: string | null;
  sector_3_time: string | null;
  speed_i1: number | null;
  speed_i2: number | null;
  speed_fl: number | null;
  compound: string | null;
  tyre_life: number | null;
  position: number | null;
  is_fastest: boolean;
  avg_speed: number | null;
  top_speed: number | null;
}

export interface TelemetryStats {
  avg_speed: number;
  top_speed: number;
  min_speed: number;
  avg_throttle: number;
  avg_brake: number;
}

export interface TelemetryResponse {
  driver: string;
  circuit: string;
  lap: { number: number; time: string; is_fastest: boolean } | null;
  stats: TelemetryStats;
  telemetry?: Record<string, number>[];
  chart?: PlotlyChart | null;
  track_chart?: PlotlyChart | null;
}

export interface PlotlyChart {
  type: string;
  data: PlotlyData[];
  layout?: Record<string, unknown>;
}

export interface PlotlyData {
  x: number[];
  y: number[];
  type: string;
  mode: string;
  name: string;
  line?: { color: string; width: number; dash?: string };
  hovertemplate?: string;
}

export interface SessionSchedule {
  name: string;
  date_local: string | null;
  date_utc: string | null;
}

export interface ScheduleRace {
  round: number;
  event: string;
  circuit_key: string;
  date: string;
  sprint: boolean;
  sessions: SessionSchedule[];
}

export interface ScheduleResponse {
  year: number;
  races: ScheduleRace[];
}

export interface NextSession {
  name: string;
  timestamp: string;
  seconds_until: number;
}

export interface NextRaceResponse {
  season_over: boolean;
  year: number;
  round: number;
  event: string;
  circuit_key: string;
  date: string;
  sprint: boolean;
  sessions: {
    name: string;
    date_utc: string;
    timestamp: string;
    seconds_until: number;
  }[];
  next_session: NextSession | null;
  countdown_seconds: number;
}

export interface DriverCareerPerSeason {
  year: number;
  team: string;
  wins: number;
  points: number;
  position: number;
}

export interface DriverCareerResponse {
  code: string;
  full_name: string;
  career: {
    seasons: number;
    wins: number;
    points: number;
    best_championship: number | null;
  };
  per_season: DriverCareerPerSeason[];
}

export interface CircuitDetailWinner {
  year: number;
  winner: string;
  team: string;
}

export interface CircuitDetailResponse {
  key: string;
  full_name: string;
  winners_by_year: CircuitDetailWinner[];
}

export interface ConstructorDetailPerSeason {
  year: number;
  wins: number;
  points: number;
  position: number;
}

export interface ConstructorDetailResponse {
  id: string;
  full_name: string;
  drivers: string[];
  per_season: ConstructorDetailPerSeason[];
}

export interface MultiTelemetryDriver {
  code: string;
  team: string;
  color: string;
  lap_number: number;
  lap_time: string | null;
  is_fastest: boolean;
  stats: TelemetryStats;
  error?: string;
}

export interface MultiTelemetryResponse {
  circuit: string;
  year: number;
  session: string;
  metric: string;
  drivers: MultiTelemetryDriver[];
  chart: PlotlyChart | null;
}

export interface GearTrackResponse {
  driver: string;
  circuit: string;
  year: number;
  session: string;
  lap: { number: number; time: string; is_fastest: boolean } | null;
  chart: PlotlyChart | null;
  telemetry: { x: number[]; y: number[]; gear: number[] } | null;
}

export interface PositionChangesResponse {
  circuit: string;
  year: number;
  session: string;
  drivers: string[];
  chart: PlotlyChart | null;
}

export interface TeamPaceResponse {
  circuit: string;
  year: number;
  session: string;
  driver: string | null;
  chart: PlotlyChart | null;
}

export interface TyreStrategiesResponse {
  circuit: string;
  year: number;
  session: string;
  driver: string | null;
  chart: PlotlyChart | null;
}

export interface QualifyingResponse {
  circuit: string;
  year: number;
  session: string;
  driver: string | null;
  chart: PlotlyChart | null;
}

export interface QueryResponse {
  answer: string;
  engine: string;
  chart: PlotlyChart | null;
  confidence?: number | null;
}

export interface LiveSeasonResponse {
  year: number;
  cachedAt: string;
  driverStandings: Standing[];
  constructorStandings: Standing[];
  schedule: ScheduleRace[];
  nextRace: NextRaceResponse | null;
  latestRace: {
    circuit: string;
    year: number;
    session: string;
    results: RaceResult[];
    fastest_lap: { code: string; time: string; lap: number } | null;
    weather: { air_temp: number; track_temp: number; humidity: number } | null;
    dnfs: string[];
  } | null;
}
