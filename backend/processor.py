import os
import json
from openai import OpenAI
from schemas import AIAnalysis
from database import SessionLocal, Meeting, Decision


class DecisioEngine:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def _get_historical_decisions(self):
        """Retrieve all open/unresolved decisions from previous meetings."""
        db = SessionLocal()
        try:
            decisions = (
                db.query(Decision)
                .filter(Decision.status.in_(["New", "Updated", "Conflicted"]))
                .order_by(Decision.created_at.desc())
                .limit(50)
                .all()
            )
            if not decisions:
                return None

            history = []
            for d in decisions:
                meeting = db.query(Meeting).filter(Meeting.id == d.meeting_id).first()
                history.append({
                    "id": d.id,
                    "statement": d.statement,
                    "assignee": d.assignee,
                    "status": d.status,
                    "related_actions": d.related_actions or [],
                    "meeting": meeting.title if meeting else "Unknown",
                    "date": d.created_at.isoformat() if d.created_at else "",
                })
            return history
        finally:
            db.close()

    def _build_prompt(self, transcript: str, historical_context=None) -> str:
        history_block = ""
        if historical_context:
            history_block = f"""
Here are decisions from previous meetings that are still open or unresolved:
{json.dumps(historical_context, indent=2)}

When analyzing the current meeting:
- If a decision today is the same or essentially a duplicate of a previous one, set its status to "Updated" and set "linked_to_previous" to the exact statement of the previous decision. This includes cases where the same task is repeated word-for-word or with minor rewording.
- If a decision today relates to or updates a previous one, set its status to "Updated" and set "linked_to_previous" to the exact statement of the previous decision it relates to.
- If a decision today conflicts with a previous one, set its status to "Conflicted" and set "linked_to_previous" to the conflicting decision's statement.
- If it's an entirely new topic, set status to "New" and "linked_to_previous" to null.
- Track accountability: note if someone who was assigned a task from a previous meeting has followed through or not.
"""

        return f"""You are an executive assistant specializing in extracting decisions from meetings.
{history_block}
Analyze this meeting transcript and extract every final decision made.
A decision is a commitment to action, a resolution, or a strategic choice.

Return ONLY a JSON object matching this exact schema:
{{
    "decisions": [
        {{
            "statement": "the decision",
            "context": "why it was made, including any reference to previous decisions",
            "confidence_score": 0.95,
            "related_actions": ["task 1", "task 2"],
            "assignee": "Name or Unassigned",
            "status": "New",
            "linked_to_previous": null
        }}
    ],
    "summary": "Short overview of the meeting"
}}

Valid status values: "New", "Updated", "Conflicted"
The "linked_to_previous" field should contain the exact statement text of the previous decision this one relates to, or null if it's new.

Transcript:
{transcript}"""

    def extract_decisions(self, transcript: str) -> AIAnalysis:
        historical = self._get_historical_decisions()

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": self._build_prompt(transcript, historical)}],
            temperature=0.3
        )
        data = response.choices[0].message.content.replace('```json', '').replace('```', '').strip()
        return AIAnalysis.model_validate_json(data)

    def transcribe(self, audio_path: str) -> str:
        with open(audio_path, "rb") as audio_file:
            transcription = self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        return transcription.text

    def transcribe_and_analyze(self, audio_path: str) -> AIAnalysis:
        transcript = self.transcribe(audio_path)
        return self.extract_decisions(transcript), transcript
