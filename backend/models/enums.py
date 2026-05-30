from enum import Enum


class SessionType(str, Enum):
    RACE = "R"
    QUALIFYING = "Q"
    SPRINT = "SPR"
    SPRINT_QUALIFYING = "SQ"
