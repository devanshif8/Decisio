# Decisio

AI-powered meeting decision tracker. Paste a transcript or record audio — Decisio extracts every decision made, links it to past related decisions, tracks accountability across meetings, and surfaces patterns through ML.

## Features

- **Decision extraction** — GPT-4o-mini parses transcripts into structured decisions (statement, context, confidence, related actions, assignee).
- **Voice input** — record meetings in-browser; Whisper transcribes, then GPT extracts.
- **Cross-meeting lineage** — every new decision is matched against unresolved past ones. Status transitions: `New → Updated → Conflicted → Resolved`. Resolved decisions exit the duplicate-detection pool.
- **Topic clustering** — TF-IDF + K-Means groups decisions by theme.
- **Priority prediction** — Random Forest classifies decisions as High / Medium / Low. Users can override the model's prediction; the RF retrains on those labels.
- **Decision timeline** — visual lineage view showing how a decision evolved across meetings.

## Stack

| Layer | Tech |
|------|------|
| Frontend | React 18 (CRA), Framer Motion, Lucide icons |
| Backend | FastAPI, SQLAlchemy, SQLite |
| AI | OpenAI `gpt-4o-mini` (extraction), `whisper-1` (audio) |
| ML | scikit-learn (TF-IDF, K-Means, Random Forest) |

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- OpenAI API key

### Backend
```bash
cd backend
pip install -r requirements.txt
echo "OPENAI_API_KEY=sk-..." > .env
python -m uvicorn main:app --reload --port 8001
```

### Frontend
```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000 — the API runs at http://localhost:8001 (docs at `/docs`).

## API

| Method | Endpoint | Purpose |
|------|---------|---------|
| `POST` | `/analyze` | Extract decisions from text |
| `POST` | `/analyze-audio` | Transcribe + extract from audio |
| `GET` | `/meetings` | List all meetings |
| `GET` | `/meetings/{id}` | Get one meeting + decisions |
| `DELETE` | `/meetings/{id}` | Delete meeting |
| `GET` | `/decisions/{id}/lineage` | Full parent/child decision chain |
| `PATCH` | `/decisions/{id}/status` | Set `New / Updated / Conflicted / Resolved` |
| `PATCH` | `/decisions/{id}/priority` | Set `High / Medium / Low` (or `null` to clear) |
| `POST` | `/ml/cluster` | Run topic clustering |
| `POST` | `/ml/train-priority` | Train RF on existing decisions |
| `POST` | `/ml/predict-priorities` | Predict + persist priorities |
| `POST` | `/ml/insights` | Combined clustering + priority output |

## How priority prediction works

1. **Heuristic baseline** — keyword lists (`urgent`, `critical`, `blocker`, …) score each decision; metadata signals (action count, model confidence) add boosts.
2. **Random Forest** — TF-IDF text features + 9 hand-crafted metadata features (length, word count, punctuation, negation, keyword counts, etc.).
3. **User override** — when you set a priority via the UI, that label takes precedence during training. Roughly 20–30 user labels and the model starts adapting beyond the keyword rules.

## Project structure

```
backend/
  main.py          # FastAPI routes
  processor.py     # OpenAI extraction + prompt building
  database.py      # SQLAlchemy models + lightweight migrations
  schemas.py       # Pydantic request/response models
  ml_models.py     # TopicClusterer + PriorityPredictor
frontend/
  src/
    App.js
    components/    # DecisionCard, DecisionTimeline, VoiceRecorder, HistoryView, InsightsView
    services/API.js
```

## License

MIT
