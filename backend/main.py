from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from processor import DecisioEngine
from database import init_db, get_db, Meeting, Decision as DecisionModel
from schemas import (
    MeetingAnalysis, MeetingOut, MeetingSummaryOut,
    DecisionOut, DecisionLineageOut, DecisionLineageNode,
)
from ml_models import TopicClusterer, PriorityPredictor
from datetime import datetime
import tempfile, os

load_dotenv()
init_db()

app = FastAPI(title="Decisio API")
engine = DecisioEngine()
clusterer = TopicClusterer()
priority_predictor = PriorityPredictor()

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8001,http://127.0.0.1:8001"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _find_parent_decision(db: Session, linked_statement: str):
    """Fuzzy-match a previous decision by statement text."""
    if not linked_statement:
        return None
    # Try exact match first
    match = db.query(DecisionModel).filter(DecisionModel.statement == linked_statement).first()
    if match:
        return match
    # Try substring match
    match = (
        db.query(DecisionModel)
        .filter(DecisionModel.statement.contains(linked_statement[:60]))
        .order_by(DecisionModel.created_at.desc())
        .first()
    )
    return match


def _persist_analysis(db: Session, ai_result, transcript: str = None, title: str = "Untitled Meeting"):
    """Save meeting and decisions to database, return API response."""
    meeting = Meeting(
        title=title,
        transcript=transcript,
        summary=ai_result.summary,
        created_at=datetime.utcnow(),
    )
    db.add(meeting)
    db.flush()

    saved_decisions = []
    for d in ai_result.decisions:
        parent = _find_parent_decision(db, d.linked_to_previous)
        decision = DecisionModel(
            meeting_id=meeting.id,
            statement=d.statement,
            context=d.context,
            confidence_score=d.confidence_score,
            related_actions=d.related_actions,
            assignee=d.assignee or "Unassigned",
            status=d.status if d.status in ("New", "Updated", "Conflicted", "Resolved") else "New",
            parent_decision_id=parent.id if parent else None,
            created_at=datetime.utcnow(),
        )
        db.add(decision)
        db.flush()
        saved_decisions.append(decision)

    db.commit()

    return MeetingAnalysis(
        meeting_id=meeting.id,
        summary=meeting.summary,
        decisions=[
            DecisionOut(
                id=d.id,
                meeting_id=d.meeting_id,
                statement=d.statement,
                context=d.context,
                confidence_score=d.confidence_score,
                related_actions=d.related_actions or [],
                assignee=d.assignee,
                status=d.status,
                parent_decision_id=d.parent_decision_id,
                created_at=d.created_at,
            )
            for d in saved_decisions
        ],
    )


# ──────────────────────────────────────────
# Health
# ──────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "ok", "message": "Decisio API is running"}


# ──────────────────────────────────────────
# Analyze endpoints (updated to persist)
# ──────────────────────────────────────────

@app.post("/analyze")
async def analyze(payload: dict, db: Session = Depends(get_db)):
    text = payload.get("text")
    title = payload.get("title", "Untitled Meeting")
    if not text:
        raise HTTPException(status_code=400, detail="No transcript provided")
    ai_result = engine.extract_decisions(text)
    return _persist_analysis(db, ai_result, transcript=text, title=title)


@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...), db: Session = Depends(get_db)):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".webm")
    try:
        tmp.write(await file.read())
        tmp.close()
        ai_result, transcript = engine.transcribe_and_analyze(tmp.name)
        return _persist_analysis(db, ai_result, transcript=transcript, title="Voice Meeting")
    finally:
        os.unlink(tmp.name)


# ──────────────────────────────────────────
# Meetings
# ──────────────────────────────────────────

@app.get("/meetings", response_model=list[MeetingSummaryOut])
async def list_meetings(db: Session = Depends(get_db)):
    meetings = db.query(Meeting).order_by(Meeting.created_at.desc()).all()
    return [
        MeetingSummaryOut(
            id=m.id,
            title=m.title,
            summary=m.summary,
            created_at=m.created_at,
            decision_count=len(m.decisions),
        )
        for m in meetings
    ]


@app.get("/meetings/{meeting_id}", response_model=MeetingOut)
async def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@app.delete("/meetings/{meeting_id}")
async def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.query(DecisionModel).filter(DecisionModel.meeting_id == meeting_id).delete()
    db.delete(meeting)
    db.commit()
    return {"detail": "Meeting deleted"}


# ──────────────────────────────────────────
# Decisions
# ──────────────────────────────────────────

@app.get("/decisions/{decision_id}/lineage", response_model=DecisionLineageOut)
async def get_decision_lineage(decision_id: int, db: Session = Depends(get_db)):
    decision = db.query(DecisionModel).filter(DecisionModel.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    def to_node(d):
        meeting = db.query(Meeting).filter(Meeting.id == d.meeting_id).first()
        return DecisionLineageNode(
            id=d.id,
            meeting_id=d.meeting_id,
            meeting_title=meeting.title if meeting else "Unknown",
            statement=d.statement,
            context=d.context,
            status=d.status,
            assignee=d.assignee,
            confidence_score=d.confidence_score,
            created_at=d.created_at,
        )

    # Walk up the parent chain to find the root
    root = decision
    while root.parent_decision_id:
        parent = db.query(DecisionModel).filter(DecisionModel.id == root.parent_decision_id).first()
        if not parent:
            break
        root = parent

    # Walk down from root collecting all descendants
    lineage = []

    def collect_lineage(node):
        lineage.append(to_node(node))
        children = db.query(DecisionModel).filter(DecisionModel.parent_decision_id == node.id).order_by(DecisionModel.created_at).all()
        for child in children:
            collect_lineage(child)

    collect_lineage(root)

    return DecisionLineageOut(
        current=to_node(decision),
        lineage=lineage,
    )


@app.patch("/decisions/{decision_id}/status")
async def update_decision_status(decision_id: int, payload: dict, db: Session = Depends(get_db)):
    decision = db.query(DecisionModel).filter(DecisionModel.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    new_status = payload.get("status")
    if new_status not in ("New", "Updated", "Conflicted", "Resolved"):
        raise HTTPException(status_code=400, detail="Invalid status")
    decision.status = new_status
    db.commit()
    return {"id": decision.id, "status": decision.status}


# ──────────────────────────────────────────
# ML Endpoints
# ──────────────────────────────────────────

def _decisions_to_dicts(decisions):
    """Convert DB decision objects to dicts for ML processing."""
    return [
        {
            "id": d.id,
            "statement": d.statement,
            "context": d.context or "",
            "confidence_score": d.confidence_score or 0.5,
            "related_actions": d.related_actions or [],
            "assignee": d.assignee,
            "status": d.status,
            "meeting_id": d.meeting_id,
        }
        for d in decisions
    ]


@app.post("/ml/cluster")
async def run_clustering(db: Session = Depends(get_db)):
    """Run TF-IDF + K-Means topic clustering on all decisions."""
    decisions = db.query(DecisionModel).order_by(DecisionModel.created_at.desc()).all()
    if not decisions:
        raise HTTPException(status_code=400, detail="No decisions to cluster")

    texts = [f"{d.statement} {d.context or ''}" for d in decisions]
    result = clusterer.fit_predict(texts)

    # Persist cluster labels back to DB
    for d, label in zip(decisions, result["labels"]):
        d.topic_cluster = label
    db.commit()

    # Build response with decisions grouped by cluster
    clusters = {}
    for d, label in zip(decisions, result["labels"]):
        cluster_name = result["cluster_names"].get(label, f"Cluster {label}")
        if label not in clusters:
            clusters[label] = {"name": cluster_name, "decisions": []}
        clusters[label]["decisions"].append({
            "id": d.id,
            "statement": d.statement,
            "context": d.context,
            "assignee": d.assignee,
            "status": d.status,
            "meeting_id": d.meeting_id,
        })

    return {
        "clusters": clusters,
        "metrics": {
            "silhouette_score": result["silhouette"],
            "n_clusters": result["n_clusters"],
            "n_samples": result["n_samples"],
            "n_features": result["n_features"],
            "algorithm": "TF-IDF + K-Means",
        },
    }


@app.post("/ml/train-priority")
async def train_priority_model(db: Session = Depends(get_db)):
    """Train the Random Forest priority predictor on existing decisions."""
    decisions = db.query(DecisionModel).all()
    if not decisions:
        raise HTTPException(status_code=400, detail="No decisions to train on")

    data = _decisions_to_dicts(decisions)
    result = priority_predictor.train(data)

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    return {
        "status": "trained",
        "evaluation": result,
        "algorithm": "TF-IDF + Random Forest Classifier",
    }


@app.post("/ml/predict-priorities")
async def predict_priorities(db: Session = Depends(get_db)):
    """Predict priorities for all decisions and persist them."""
    decisions = db.query(DecisionModel).all()
    if not decisions:
        raise HTTPException(status_code=400, detail="No decisions found")

    # Auto-train if not already trained
    if not priority_predictor.is_trained and len(decisions) >= 5:
        data = _decisions_to_dicts(decisions)
        priority_predictor.train(data)

    data = _decisions_to_dicts(decisions)
    predictions = priority_predictor.predict_batch(data)

    # Persist predictions
    for d, pred in zip(decisions, predictions):
        d.predicted_priority = pred["priority"]
    db.commit()

    return {
        "predictions": predictions,
        "method": predictions[0]["method"] if predictions else "none",
        "evaluation": priority_predictor.evaluation,
    }


@app.post("/ml/insights")
async def get_ml_insights(db: Session = Depends(get_db)):
    """Run both ML models and return combined insights."""
    decisions = db.query(DecisionModel).order_by(DecisionModel.created_at.desc()).all()
    if not decisions:
        raise HTTPException(status_code=400, detail="No decisions found. Analyze some meetings first.")

    data = _decisions_to_dicts(decisions)

    # --- Topic Clustering ---
    texts = [f"{d['statement']} {d.get('context', '')}" for d in data]
    cluster_result = clusterer.fit_predict(texts)

    for d_obj, label in zip(decisions, cluster_result["labels"]):
        d_obj.topic_cluster = label

    clusters = {}
    for d, label in zip(data, cluster_result["labels"]):
        cluster_name = cluster_result["cluster_names"].get(label, f"Cluster {label}")
        if label not in clusters:
            clusters[label] = {"name": cluster_name, "decisions": []}
        d_copy = {**d, "topic_cluster": label}
        clusters[label]["decisions"].append(d_copy)

    # --- Priority Prediction ---
    train_result = None
    if len(data) >= 5:
        train_result = priority_predictor.train(data)

    predictions = priority_predictor.predict_batch(data)

    for d_obj, pred in zip(decisions, predictions):
        d_obj.predicted_priority = pred["priority"]

    db.commit()

    # Priority distribution
    priority_dist = {"High": 0, "Medium": 0, "Low": 0}
    for p in predictions:
        priority_dist[p["priority"]] = priority_dist.get(p["priority"], 0) + 1

    return {
        "clustering": {
            "clusters": clusters,
            "metrics": {
                "silhouette_score": cluster_result["silhouette"],
                "n_clusters": cluster_result["n_clusters"],
                "n_samples": cluster_result["n_samples"],
                "n_features": cluster_result["n_features"],
                "algorithm": "TF-IDF + K-Means",
            },
        },
        "priority": {
            "predictions": predictions,
            "distribution": priority_dist,
            "evaluation": priority_predictor.evaluation or train_result,
            "algorithm": "TF-IDF + Random Forest Classifier",
        },
        "min_decisions_note": "Need 5+ decisions for full ML training" if len(data) < 5 else None,
    }
