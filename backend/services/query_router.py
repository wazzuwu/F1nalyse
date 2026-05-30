"""
LLM-powered query router — maps natural language to FastF1 operations.

Flow:
  1. User sends free text like "how did Verstappen do in Miami 2024"
  2. LLM returns structured JSON: {intent, params}
  3. Dispatcher calls the right FastF1 function
  4. Returns {answer, engine, chart}
"""

import json
import traceback

from backend.services.fastf1_analyzer import (
    career_stats,
    compare_drivers,
    compare_constructors,
    race_results,
    _EVENT_OVERRIDES,
    _event_name,
)
from backend.services.standings_service import driver_standings, constructor_standings
from backend.services.telemetry_service import single_lap_telemetry, lap_progression
from backend.services.validator import (
    DRIVERS,
    CIRCUITS,
    CONSTRUCTORS,
    SEASONS,
    resolve_alias,
    resolve_drivers,
    validate_driver,
    ValidationError,
)
from backend.services.llm_client import chat_completion

# ── Intent catalog ────────────────────────────────────────────────────────

INTENT_SCHEMAS = {
    "general": {
        "description": "Greetings, thank-yous, goodbyes, chit-chat, or anything not specifically about F1 data — use this when the user is not asking for F1 statistics, race results, comparisons, or penalties",
        "params": {},
        "required": [],
    },
    "career_stats": {
        "description": "Career statistics for one or more drivers (total wins, points, best championship, seasons)",
        "params": {"drivers": "list of 3-letter driver codes, e.g. ['VER', 'HAM']"},
        "required": ["drivers"],
    },
    "compare": {
        "description": "Compare drivers at a specific race/qualifying session, or career-only stats when circuit/year omitted. ALSO use for queries about a driver's record at a specific circuit across all years (omit year, include circuit).",
        "params": {
            "drivers": "list of 3-letter driver codes",
            "circuit": "circuit key (omit for career stats; INCLUDE for race session or all-time circuit record)",
            "year": "season year (omit for career stats or all-time circuit record; INCLUDE for specific race session)",
            "session": "'R' (race) or 'Q' (qualifying) — default 'R'",
        },
        "required": ["drivers"],
    },
    "constructor_compare": {
        "description": "Compare constructors at a session or career-only stats",
        "params": {
            "constructors": "list of constructor slugs, e.g. ['red_bull', 'ferrari']",
            "circuit": "circuit key (optional)",
            "year": "season year (optional)",
            "session": "'R' or 'Q' — default 'R'",
        },
        "required": ["constructors"],
    },
    "race_results": {
        "description": "Full race classification with podium, fastest lap, DNFs, and incident/penalty summary from FIA records — use for any question about what happened at a specific race",
        "params": {
            "circuit": "circuit key (required)",
            "year": "season year (required)",
            "session": "'R' or 'Q' — default 'R'",
        },
        "required": ["circuit", "year"],
    },
    "standings": {
        "description": "Driver or constructor championship standings for a season",
        "params": {
            "year": "season year (default: latest)",
            "type": "'driver' or 'constructor' — default 'driver'",
            "round": "after specific round number (optional)",
        },
        "required": [],
    },
    "telemetry": {
        "description": "Single-lap telemetry data for a driver (speed, throttle, brake, gear, rpm, drs)",
        "params": {
            "driver": "3-letter driver code (required)",
            "circuit": "circuit key (required)",
            "year": "season year (required)",
            "session": "'R' or 'Q' — default 'R'",
            "lap_number": "specific lap number (optional, omit for fastest lap)",
            "metric": "'speed', 'throttle', 'brake', 'gear', 'rpm', 'drs', or 'all' — default 'speed'",
            "compare_driver": "second driver code to overlay (optional)",
        },
        "required": ["driver", "circuit", "year"],
    },
    "lap_progression": {
        "description": "Per-lap breakdown for a driver across multiple laps (lap times, sector times, speeds, tire data)",
        "params": {
            "driver": "3-letter driver code (required)",
            "circuit": "circuit key (required)",
            "year": "season year (required)",
            "session": "'R' or 'Q' — default 'R'",
            "max_laps": "max number of laps to return (optional)",
        },
        "required": ["driver", "circuit", "year"],
    },
    "penalty": {
        "description": "FIA penalty prediction for a race incident using RAG on historical precedents — use ONLY when the query describes a specific collision, incident, or infringement between drivers",
        "params": {
            "incident": "natural language description of the incident (required)",
            "circuit": "circuit key (optional — filters precedents to this circuit)",
            "year": "season year (optional, for metadata filtering)",
            "breach_type": "specific breach type (optional)",
        },
        "required": ["incident"],
    },
}

# Build context string for the system prompt
_DRIVER_LIST = ", ".join(sorted(DRIVERS.keys()))
_CIRCUIT_LIST = ", ".join(sorted(CIRCUITS.keys()))
_CONSTRUCTOR_LIST = ", ".join(sorted(CONSTRUCTORS.keys()))
_YEARS = f"{SEASONS[0]}-{SEASONS[-1]}"

SYSTEM_PROMPT = f"""You are an F1 data router. Your job is to translate natural language questions about Formula 1 into structured JSON.

Available intents and their parameters:
{json.dumps(INTENT_SCHEMAS, indent=2)}

Valid entities:
- Driver codes: {_DRIVER_LIST}
- Circuit keys: {_CIRCUIT_LIST}
- Constructor slugs: {_CONSTRUCTOR_LIST}
- Years: {_YEARS}
- Session: R (Race), Q (Qualifying), SPR (Sprint)

Intent selection priority:
- Use "general" for greetings ("hi", "hello", "hey"), thank-yous, goodbyes ("bye", "see you"), or anything completely unrelated to F1 data. If in doubt, use "general".
- If the query is about F1 race results, comparisons, standings, penalties, or telemetry, use the specific intent — never use "general" for F1 data questions.

Routing guidance:
- "race_results": Full race classification including podium, fastest lap, DNFs, and incident/penalty records from FIA — use for "who won", "what happened at the [circuit] GP", "tell me about the [year] [circuit] race", "results of", "who finished 2nd", "who was on pole". These are about the overall race outcome or specific positions in a race.
- "penalty": Queries asking about a specific collision, incident, crash, or infringement between drivers — use for "what happened between [driver] and [driver]", "collision", "crash", "incident", "penalty", "forcing off", "infringement". These describe a specific on-track event, not the overall race.
- "compare": Head-to-head driver comparison at a session, career, or all-time at a specific circuit. Use for "compare X and Y", "how did X do", "who performed better".
- "standings": Championship standings for a season.
- "telemetry": Lap telemetry data — use when the user asks about speed, throttle, braking, gear, RPM, DRS data, or "telemetry" itself. Queries like "show me VER's speed at monaco", "telemetry comparison Leclerc vs Sainz", "braking data for hamilton at silverstone", "show me throttle trace".
- "lap_progression": Per-lap breakdown — use when the user asks about lap times, sector times, tyre compounds, or pit stop strategy. Queries like "show lap times for VER", "sector times for hamilton", "tyre strategy at monaco".

Parameter guidance:
- For "compare" with a specific circuit but NO year → all-time stats at that circuit across all years (e.g. "how many times has verstappen won at austria" → circuit="spielberg", no year)
- For "compare" with circuit AND year → single race session
- For "compare" with NEITHER circuit nor year → career stats
- For "race_results" — always include both circuit and year

Intent selection rules:
- "who finished 2nd" → race_results (it's asking about a specific race outcome)
- "who won" → race_results
- "how many times has X won at Y" → compare with circuit, NO year (all-time circuit record)
- "X's record at Y" → compare with circuit, NO year
- "tell me about X and Y at Z" → compare with circuit and year
- "show telemetry for X at Y" → telemetry
- "X speed at Y" or "X throttle at Y" → telemetry
- "lap times for X" → lap_progression
- "sector times for X" → lap_progression
- "tyre strategy" or "tyre compounds" → lap_progression

Rules:
1. Output ONLY valid JSON with two keys: "intent" and "params"
2. Use 3-letter driver codes (not full names)
3. If the user mentions a driver by name, use your knowledge to map to their code
4. If required params are missing from the query, set reasonable defaults
5. For "compare" without circuit → omit circuit/year (career mode)
6. For "standings" without year → use the latest year
7. Do NOT include markdown formatting, code fences, or extra text

Examples:
Query: "how did Verstappen do in Miami 2024"
Response: {{"intent": "compare", "params": {{"drivers": ["VER"], "circuit": "miami", "year": 2024}}}}

Query: "compare Verstappen and Leclerc career stats"
Response: {{"intent": "compare", "params": {{"drivers": ["VER", "LEC"]}}}}

Query: "who won the 2024 Monaco Grand Prix"
Response: {{"intent": "race_results", "params": {{"circuit": "monaco", "year": 2024}}}}

Query: "who finished 2nd in 2024 monaco gp"
Response: {{"intent": "race_results", "params": {{"circuit": "monaco", "year": 2024}}}}

Query: "how many times has verstappen won the austrian gp"
Response: {{"intent": "compare", "params": {{"drivers": ["VER"], "circuit": "spielberg"}}}}

Query: "what is hamilton's record at silverstone"
Response: {{"intent": "compare", "params": {{"drivers": ["HAM"], "circuit": "silverstone"}}}}

Query: "show me Verstappen's lap times in Miami"
Response: {{"intent": "lap_progression", "params": {{"driver": "VER", "circuit": "miami", "year": 2024}}}}

Query: "telemetry for verstappen at monaco 2024"
Response: {{"intent": "telemetry", "params": {{"driver": "VER", "circuit": "monaco", "year": 2024}}}}

Query: "show me norris speed at silverstone 2025"
Response: {{"intent": "telemetry", "params": {{"driver": "NOR", "circuit": "silverstone", "year": 2025}}}}

Query: "compare telemetry leclerc vs sainz monaco 2024"
Response: {{"intent": "telemetry", "params": {{"driver": "LEC", "circuit": "monaco", "year": 2024, "compare_driver": "SAI"}}}}

Query: "what happened between hamilton and verstappen at silverstone 2021"
Response: {{"intent": "penalty", "params": {{"incident": "hamilton and verstappen collision at silverstone 2021", "circuit": "silverstone", "year": 2021}}}}

Query: "what penalty for verstappen forcing leclerc off in austria"
Response: {{"intent": "penalty", "params": {{"incident": "verstappen forcing leclerc off track in austria", "circuit": "spielberg"}}}}

Query: "what happened at the 2021 british grand prix"
Response: {{"intent": "race_results", "params": {{"circuit": "silverstone", "year": 2021}}}}

Query: "tell me about the verstappen leclerc crash in austria 2022"
Response: {{"intent": "penalty", "params": {{"incident": "verstappen leclerc crash in austria 2022", "circuit": "spielberg", "year": 2022}}}}

Query: "kimi raikkonen gearbox change italian gp penalty?"
Response: {{"intent": "penalty", "params": {{"incident": "kimi raikkonen gearbox change italian gp", "circuit": "monza"}}}}"""


def _resolve_names(params: dict) -> dict:
    """Convert full names to 3-letter codes in params."""
    p = dict(params)
    for key in ("drivers", "driver"):
        raw = p.get(key)
        if raw is None:
            continue
        if isinstance(raw, list):
            resolved = []
            for item in raw:
                code = resolve_alias(item) or item.upper().strip()
                resolved.append(code)
            p[key] = resolved
        elif isinstance(raw, str):
            code = resolve_alias(raw) or raw.upper().strip()
            p[key] = code
    return p


def _race_incidents(circuit_name: str, year: int) -> list[dict]:
    """Fetch FIA incident data for a specific circuit+year from ChromaDB."""
    try:
        from backend.services.rag_engine import _get_chroma_collection, _match_circuit

        col = _get_chroma_collection()
        results = col.get(
            where={"year": year},
            include=["metadatas"],
        )
        if not results["ids"]:
            return []

        seen = set()
        incidents = []
        for m in results["metadatas"]:
            if not m.get("is_infringement"):
                continue
            if not _match_circuit(str(m.get("circuit", "")), circuit_name):
                continue
            key = (m.get("driver_name", "?"), m.get("breach_category", "?"))
            if key in seen:
                continue
            seen.add(key)
            incidents.append({
                "driver": m.get("driver_name", "?"),
                "breach": m.get("breach_category", "?"),
                "penalty": m.get("penalty_value", "?"),
                "penalty_type": m.get("penalty_type", "?"),
            })
        return incidents
    except Exception:
        return []


def _resolve_driver(params: dict) -> str:
    """Extract driver code from params, handling both 'driver' and 'drivers' keys."""
    d = params.get("driver") or (params.get("drivers") or [None])[0]
    if not d:
        raise KeyError("Missing driver in params")
    return d.upper().strip()


def _summarize_strategy(laps: list) -> str:
    """Build a concise tyre strategy summary from lap data."""
    stints = []
    current = None
    for lap in laps:
        compound = lap.get("compound")
        if not compound:
            continue
        if current is None or current["compound"] != compound:
            if current:
                stints.append(current)
            current = {"compound": compound, "start": lap["lap_number"], "end": lap["lap_number"], "laps": 0}
        if current:
            current["end"] = lap["lap_number"]
            current["laps"] += 1
    if current:
        stints.append(current)
    if not stints:
        return ""
    parts = [f"{s['compound']} (L{s['start']}-{s['end']}, {s['laps']} laps)" for s in stints]
    return ", ".join(parts)


def _dispatch(intent: str, params: dict) -> dict:
    """Route an intent+params to the right FastF1 function."""
    params = _resolve_names(params)

    if intent == "general":
        return {"answer": "Hey there! I'm the F1nalyse Steward. I can help with race results, driver comparisons, championship standings, telemetry analysis, and penalty predictions. What F1 data would you like to explore?"}

    elif intent == "career_stats":
        return career_stats(params.get("drivers", []))

    elif intent == "compare":
        drivers = params.get("drivers", [])
        circuit = params.get("circuit")
        year = params.get("year")
        session = params.get("session", "R")
        return compare_drivers(drivers, circuit, year, session)

    elif intent == "constructor_compare":
        slugs = params.get("constructors", [])
        circuit = params.get("circuit")
        year = params.get("year")
        session = params.get("session", "R")
        return compare_constructors(slugs, circuit, year, session)

    elif intent == "race_results":
        circuit = params["circuit"]
        year = params["year"]
        data = race_results(circuit, year, params.get("session", "R"))

        event_name = _EVENT_OVERRIDES.get(circuit)
        if event_name is None:
            try:
                event_name = _event_name(year, circuit)
            except Exception:
                event_name = circuit
        incidents = _race_incidents(event_name, year)
        if incidents:
            data["incidents"] = incidents

        return data

    elif intent == "standings":
        year = params.get("year", max(SEASONS))
        stype = params.get("type", "driver")
        sround = params.get("round")
        if stype == "driver":
            return {"standings": driver_standings(year, sround)}
        else:
            return {"standings": constructor_standings(year, sround)}

    elif intent == "telemetry":
        driver = _resolve_driver(params)
        compare = params.get("compare_driver")
        if compare:
            from backend.services.telemetry_service import multi_driver_telemetry
            return multi_driver_telemetry(
                drivers=[driver, compare],
                circuit=params["circuit"],
                year=params["year"],
                session_type=params.get("session", "R"),
                lap_number=params.get("lap_number"),
                metric=params.get("metric", "speed"),
            )
        return single_lap_telemetry(
            driver=driver,
            circuit=params["circuit"],
            year=params["year"],
            session_type=params.get("session", "R"),
            lap_number=params.get("lap_number"),
            metric=params.get("metric", "speed"),
        )

    elif intent == "lap_progression":
        driver = _resolve_driver(params)
        laps = lap_progression(
            driver=driver,
            circuit=params["circuit"],
            year=params["year"],
            session_type=params.get("session", "R"),
            max_laps=params.get("max_laps"),
        )
        # Build strategy summary from lap data
        strategy = _summarize_strategy(laps) if laps else None
        return {"laps": laps, "strategy": strategy}

    elif intent == "penalty":
        from backend.services.rag_engine import query as rag_query

        filters = {}
        if params.get("year"):
            filters["year"] = params["year"]
        if params.get("breach_type"):
            filters["breach_category"] = params["breach_type"]
        if params.get("circuit"):
            circuit_key = params["circuit"]
            if params.get("year"):
                try:
                    filters["circuit"] = _event_name(params["year"], circuit_key)
                except Exception:
                    filters["circuit"] = _EVENT_OVERRIDES.get(circuit_key, circuit_key)
            else:
                filters["circuit"] = _EVENT_OVERRIDES.get(circuit_key, circuit_key)

        return rag_query(params["incident"], filters=filters if filters else None)

    return {"error": f"Unknown intent: {intent}"}


def _strip_charts(d: dict) -> dict:
    """Remove large binary/chart fields before passing data to the LLM."""
    skip_keys = {"chart", "track_chart", "charts", "telemetry", "additional_charts"}
    if not isinstance(d, dict):
        return d
    return {k: (_strip_charts(v) if isinstance(v, dict) else v) for k, v in d.items() if k not in skip_keys}


ANSWER_PROMPT = """You are an F1 data analyst assistant. Your job is to answer the user's question based ONLY on the retrieved data below.

**User question:** {query}

**Retrieved data:** {data}

Rules:
1. Answer exactly what was asked — don't dump all the data
2. If the user asks a specific question ("who finished 2nd?"), give a direct answer ("Oscar Piastri finished 2nd")
3. If the user asks for full details or "everything", provide the complete picture
4. Use natural conversational language, not bullet-point lists of raw data
5. NEVER mention that you are using "retrieved data" or "the data provided" — just give the answer naturally
6. If the data doesn't contain what's needed, say so clearly
7. Keep it concise — one paragraph unless they asked for detail
8. For penalties, include the prediction, confidence, and key reasoning
9. For standings, format as a quick table or natural list
10. For race results, highlight podium then answer the specific question
11. For lap data, include strategy info (tyre compounds and stint lengths) when available in the data — mention the tyre strategy as a key part of the analysis
"""


def route_query(user_query: str, history: list[dict] | None = None) -> dict:
    """
    Main entry point. Takes a natural language query, returns structured data.
    """
    # Build message list with history for context
    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        for h in history[-10:]:  # keep last 10 turns to limit token usage
            role = "user" if h.get("role") == "user" else "assistant"
            msgs.append({"role": role, "content": h.get("content", "")})
    msgs.append({"role": "user", "content": user_query})

    # 1. LLM parses the intent
    try:
        response = chat_completion(
            messages=msgs,
            temperature=0.1,
        )
        raw = response.choices[0].message.content.strip()

        # Strip code fences if LLM returns them
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0].strip()

        parsed = json.loads(raw)
    except Exception as e:
        return {
            "answer": f"Sorry, I couldn't understand that query: {e}",
            "engine": "error",
            "chart": None,
        }

    intent = parsed.get("intent")
    params = parsed.get("params", {})
    if intent not in INTENT_SCHEMAS:
        return {
            "answer": f"Unknown intent '{intent}'. Available: {', '.join(INTENT_SCHEMAS.keys())}",
            "engine": "error",
            "chart": None,
        }

    # 2. Dispatch to FastF1
    try:
        data = _dispatch(intent, params)
    except Exception as e:
        return {
            "answer": f"Error running {intent}: {type(e).__name__}",
            "engine": intent,
            "chart": None,
        }

    # 3. Use LLM to generate a natural answer from the data
    try:
        clean = _strip_charts(data)
        clean["_intent"] = intent
        clean["_params"] = params

        # Build answer prompt with history context
        history_context = ""
        if history:
            turns = []
            for h in history[-4:]:
                label = "User" if h.get("role") == "user" else "Assistant"
                turns.append(f"{label}: {h.get('content', '')}")
            history_context = "**Previous conversation:**\n" + "\n".join(turns) + "\n\n"

        answer_prompt = ANSWER_PROMPT.format(
            query=user_query,
            data=json.dumps(clean, indent=2, default=str),
        )
        answer_response = chat_completion(
            messages=[{"role": "user", "content": history_context + answer_prompt}],
            temperature=0.3,
        )
        answer = answer_response.choices[0].message.content.strip()
    except Exception:
        answer = _summarize(intent, params, data)

    return {
        "answer": answer,
        "engine": intent,
        "chart": data.get("chart"),
        "data": data,
    }


def _detect_verbosity(query: str) -> str:
    q = query.lower()
    detailed_words = ["everything", "full", "detailed", "all details", "in depth", "in-depth", "complete", "thorough", "full breakdown", "every", "tell me about", "what happened"]
    brief_words = ["quick", "brief", "summary", "tldr", "just the", "short"]
    detailed_score = sum(1 for w in detailed_words if w in q)
    brief_score = sum(1 for w in brief_words if w in q)
    if detailed_score > brief_score:
        return "detailed"
    if brief_score > detailed_score:
        return "brief"
    if len(q.split()) <= 4:
        return "brief"
    return "normal"


def _summarize(intent: str, params: dict, data: dict, verbosity: str = "normal") -> str:
    """Natural language summary with verbosity-aware detail level."""
    if intent == "general":
        return data.get("answer", "Hello! How can I help with F1 data today?")

    elif intent == "career_stats":
        lines = []
        for code, st in data.items():
            if not st:
                continue
            if verbosity == "brief":
                lines.append(f"**{code}**: {st['seasons']} seasons, {st['total_wins']} wins, {st['total_points']} pts, best P{st['best_championship']}")
            else:
                lines.append(
                    f"**{code}** — {st['seasons']} seasons, {st['total_wins']} wins, "
                    f"{st['total_points']} total points ({st['avg_points_per_season']} avg/season), "
                    f"best championship finish: P{st['best_championship']}"
                )
                if verbosity == "detailed" and st.get("per_season"):
                    lines.append("  Season breakdown:")
                    for s in st["per_season"][-5:]:
                        lines.append(f"    {s['year']}: P{s['position']} · {s['points']} pts · {s['wins']} wins")
        return "\n".join(lines)

    elif intent == "compare":
        out = []
        scope = data.get("scope", {})
        mode = scope.get("mode", "race")
        stats = data.get("stats", {})

        if verbosity == "brief":
            for code, st in stats.items():
                if not st:
                    continue
                if "position" in st:
                    out.append(f"**{code}**: P{st['position']}")
                elif "wins" in st:
                    out.append(f"**{code}**: {st.get('wins', 0)} wins, {st.get('podiums', 0)} podiums")
                elif "total_wins" in st:
                    out.append(f"**{code}**: {st['total_wins']} wins, {st['total_points']} pts")
            return " · ".join(out)

        if mode == "career":
            for code, st in stats.items():
                if not st:
                    out.append(f"**{code}**: No data")
                else:
                    out.append(
                        f"**{code}**: {st['seasons']} seasons, {st['total_wins']} wins, "
                        f"{st['total_points']} pts, best championship P{st['best_championship']}"
                    )
                    if verbosity == "detailed" and st.get("per_season"):
                        for s in st["per_season"][-5:]:
                            out.append(f"  {s['year']}: P{s['position']} · {s['points']} pts · {s['wins']} wins")

        elif mode == "season":
            for code, st in stats.items():
                if not st:
                    continue
                base = f"**{code}**: {st['races']} races, {st['wins']} wins, {st['podiums']} podiums, {st['poles']} poles"
                if st.get('championship_position'):
                    base += f" — P{st['championship_position']} in championship"
                out.append(base + f" · best finish: P{st['best_position']}")
                if verbosity == "detailed":
                    extras = []
                    if st.get('fastest_laps'): extras.append(f"{st['fastest_laps']} FL")
                    if st.get('dnfs'): extras.append(f"{st['dnfs']} DNFs")
                    if extras:
                        out[-1] += f" ({', '.join(extras)})"

        elif mode == "circuit":
            for code, st in stats.items():
                if not st:
                    continue
                base = f"**{code}**: {st['races']} races, {st['wins']} wins, {st['podiums']} podiums"
                if verbosity == "detailed" and st.get('best_fastest_lap'):
                    base += f" · best lap: {st['best_fastest_lap']}"
                out.append(base + f" · best finish: P{st['best_position']}")

        else:
            for code, st in stats.items():
                if not st:
                    out.append(f"**{code}**: No session data")
                    continue
                line = f"**{code}** P{st.get('position', '?')} ({st.get('pit_stops', 0)} stops"
                if st.get('laps_led'):
                    line += f", {st['laps_led']} laps led"
                fl = st.get('fastest_lap')
                if fl:
                    line += f", fastest {fl}"
                line += ")"
                out.append(line)
            weather = data.get("weather")
            if weather:
                out.append(f"*Conditions: {weather['air_temp']}°C air, {weather['track_temp']}°C track, {weather['humidity']}% humidity*")

        return "\n".join(out)

    elif intent == "constructor_compare":
        out = []
        stats = data.get("stats", {})
        for slug, st in stats.items():
            if "error" in st:
                out.append(f"**{st.get('full_name', slug)}**: {st['error']}")
            elif "seasons" in st:
                out.append(
                    f"**{st.get('full_name', slug)}**: {st['seasons']} seasons, "
                    f"{st['total_wins']} wins, {st['total_points']} pts, "
                    f"best championship P{st['best_championship']}"
                )
            else:
                driver_lines = []
                for code, drv in st.get("stats", {}).items():
                    if drv:
                        driver_lines.append(f"{code} P{drv.get('position', '?')}")
                out.append(f"**{st.get('full_name', slug)}** — {', '.join(driver_lines)}")
        return "\n".join(out)

    elif intent == "race_results":
        results = data.get("results", [])
        if not results:
            return "No results found."
        circuit = data.get("circuit", "?").replace("_", " ").title()
        year = data.get("year", "?")
        session = data.get("session", "R")
        session_label = "Qualifying" if session == "Q" else f"{session} Session" if session != "R" else "Race"

        lines = [f"**{year} {circuit} — {session_label} Results**"]

        podium = results[:3]
        positions = [f"P{r['position']} **{r['code']}**" for r in podium]
        lines.append("Podium: " + " → ".join(positions))

        if verbosity == "brief":
            dnfs = data.get("dnfs", [])
            if dnfs:
                lines.append(f"DNF: {', '.join(dnfs[:3])}" + (f" +{len(dnfs)-3}" if len(dnfs) > 3 else ""))
            fl = data.get("fastest_lap", {})
            if fl:
                lines.append(f"Fastest Lap: **{fl.get('code', '?')}** ({fl.get('time', '?')})")
            return "\n".join(lines)

        for r in results[:10]:
            parts = [f"P{r['position']:>2}  {r['code']:<4}{r.get('full_name', ''):<18}"]
            grid = r.get('grid')
            gained = r.get('positions_gained')
            if grid is not None:
                parts.append(f"grid P{grid}")
            if gained is not None and gained > 0:
                parts.append(f"+{gained}")
            lines.append("  ".join(parts))

        fl = data.get("fastest_lap", {})
        if fl:
            lines.append(f"\nFastest Lap — **{fl.get('code', '?')}** L{fl.get('lap', '?')} ({fl.get('time', '?')})")

        dnfs = data.get("dnfs", [])
        if dnfs:
            matched = []
            for d in dnfs:
                match = next((r for r in results if r.get('code') == d), None)
                matched.append(f"{match.get('full_name', d)} ({d})" if match else d)
            lines.append(f"DNF: {', '.join(matched)}")

        if verbosity == "detailed":
            incidents = data.get("incidents", [])
            if incidents:
                lines.append("\n**Incidents & Penalties**")
                for inc in incidents:
                    pen = inc.get("penalty", "")
                    if pen and pen != "N/A":
                        lines.append(f"  • {inc['driver']} — {inc['breach']} → {pen}")
                    else:
                        lines.append(f"  • {inc['driver']} — {inc['breach']}")

            weather = data.get("weather")
            if weather:
                lines.append(f"\nConditions: {weather['air_temp']}°C air, {weather['track_temp']}°C track, {weather['humidity']}% humidity")

        return "\n".join(lines)

    elif intent == "standings":
        standings = data.get("standings", [])
        if not standings:
            return "No standings data available."
        year = params.get("year", "")
        stype = params.get("type", "driver")
        label = "Constructor Standings" if stype == "constructor" else "Driver Standings"
        lines = [f"**{year} {label}**"]

        for i, s in enumerate(standings):
            if i == 5 and verbosity != "detailed":
                lines.append(f"  ... + {len(standings) - 5} more")
                break
            name = s.get('code', s.get('full_name', '?'))
            team = s.get('team', s.get('id', ''))
            if team and stype == "driver":
                lines.append(f"  P{s['position']:<2}  {name:<18}{team:<15}{s['points']:<5} pts  {s['wins']} wins")
            else:
                lines.append(f"  P{s['position']:<2}  {name:<25}{s['points']:<5} pts  {s['wins']} wins")

        return "\n".join(lines)

    elif intent == "telemetry":
        lap = data.get("lap", {})
        st = data.get("stats", {})
        driver = data.get("driver", "?")
        circuit = data.get("circuit", "?")

        lines = [f"**{driver}** at {circuit.replace('_', ' ').title()} — Lap {lap.get('number', '?')}"]
        if lap.get('is_fastest'):
            lines[0] += " (fastest lap)"
        lines.append(f"Time: {lap.get('time', 'N/A')}")

        if verbosity == "brief":
            lines.append(f"Avg {st.get('avg_speed', '?')} km/h · Top {st.get('top_speed', '?')} km/h")
        else:
            lines.append(f"Speed — avg {st.get('avg_speed', '?')} km/h · top {st.get('top_speed', '?')} km/h · min {st.get('min_speed', '?')} km/h")
            lines.append(f"Throttle: {st.get('avg_throttle', '?')}% avg · Brake: {st.get('avg_brake', '?')}% avg")

        return "\n".join(lines)

    elif intent == "lap_progression":
        laps = data.get("laps", [])
        if not laps:
            return "No lap data found for that driver."
        valid = [l for l in laps if l.get("lap_time") and l["lap_time"] != "DNF"]
        if not valid:
            return f"{len(laps)} laps found, all DNF."

        fastest = min(valid, key=lambda l: l["lap_time"])

        if verbosity == "brief":
            return f"**{params.get('driver', '?')}**: {len(laps)} laps, fastest L{fastest['lap_number']} ({fastest['lap_time']})"

        lines = [
            f"**{params.get('driver', '?')}** — {len(laps)} total laps",
            f"Fastest: L{fastest['lap_number']} ({fastest['lap_time']}) at {fastest.get('avg_speed', '?')} km/h avg",
        ]
        dnfs = [l for l in laps if l.get("dnf")]
        if dnfs:
            lines.append(f"DNF on lap {dnfs[0]['lap_number']}")

        if verbosity == "detailed":
            lines.append("")
            for lap in laps[:25]:
                marker = " ⚡" if lap.get("is_fastest") else ""
                dnf_mark = " 💥" if lap.get("dnf") else ""
                compound = f" [{lap.get('compound', '?')[:4]}]" if lap.get("compound") else ""
                lines.append(f"  L{lap['lap_number']:<3} {lap['lap_time']:<12}{compound} P{lap.get('position', '?')}{marker}{dnf_mark}")
            if len(laps) > 25:
                lines.append(f"  ... + {len(laps) - 25} more")

        return "\n".join(lines)

    elif intent == "penalty":
        pred = data.get("prediction", "Unable to determine.")
        reasoning = data.get("reasoning", "")
        confidence = data.get("confidence")
        precedents = data.get("cited_precedents", [])

        out = [f"**Prediction:** {pred}"]
        if confidence is not None:
            out.append(f"**Confidence:** {confidence:.0%}")

        if verbosity == "brief":
            return "\n".join(out)

        if reasoning:
            out.append(f"\n{reasoning}")

        if verbosity == "detailed" and precedents:
            out.append("\n**Cited Precedents**")
            for p in precedents:
                parts = [str(p.get(k, "")) for k in ("year", "circuit", "driver") if p.get(k)]
                if p.get("breach"):
                    parts.append(f"({p['breach']})")
                penalty = p.get("penalty")
                if penalty and penalty != "N/A":
                    parts.append(f"→ {penalty}")
                out.append(f"  • {' '.join(parts)}")

        return "\n".join(out)

    return "Done."
