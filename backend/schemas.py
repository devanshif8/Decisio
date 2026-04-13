from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum


class DecisionStatus(str, Enum):
    NEW = "New"
    UPDATED = "Updated"
    CONFLICTED = "Conflicted"
    RESOLVED = "Resolved"


# --- AI Response Models (what GPT returns) ---

class AIDecision(BaseModel):
    statement: str
    context: str
    confidence_score: float
    related_actions: List[str]
    assignee: Optional[str] = "Unassigned"
    status: str = "New"
    linked_to_previous: Optional[str] = None  # statement of the previous decision it relates to


class AIAnalysis(BaseModel):
    decisions: List[AIDecision]
    summary: str


# --- API Response Models ---

class DecisionOut(BaseModel):
    id: int
    meeting_id: int
    statement: str
    context: str
    confidence_score: float
    related_actions: List[str]
    assignee: Optional[str] = "Unassigned"
    status: str
    parent_decision_id: Optional[int] = None
    topic_cluster: Optional[int] = None
    predicted_priority: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MeetingOut(BaseModel):
    id: int
    title: str
    summary: Optional[str] = None
    created_at: datetime
    decisions: List[DecisionOut]

    class Config:
        from_attributes = True


class MeetingSummaryOut(BaseModel):
    id: int
    title: str
    summary: Optional[str] = None
    created_at: datetime
    decision_count: int

    class Config:
        from_attributes = True


class DecisionLineageNode(BaseModel):
    id: int
    meeting_id: int
    meeting_title: str
    statement: str
    context: str
    status: str
    assignee: Optional[str]
    confidence_score: float
    created_at: datetime


class DecisionLineageOut(BaseModel):
    current: DecisionLineageNode
    lineage: List[DecisionLineageNode]


# Legacy shape for frontend response
class MeetingAnalysis(BaseModel):
    decisions: List[DecisionOut]
    summary: str
    meeting_id: int
