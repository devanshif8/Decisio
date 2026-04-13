import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./decisio.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, default="Untitled Meeting")
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    decisions = relationship("Decision", back_populates="meeting", order_by="Decision.id")


class Decision(Base):
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    statement = Column(Text, nullable=False)
    context = Column(Text, nullable=True)
    confidence_score = Column(Float, default=0.0)
    related_actions = Column(JSON, default=list)
    assignee = Column(String, default="Unassigned")
    status = Column(String, default="New")  # New, Updated, Conflicted, Resolved
    parent_decision_id = Column(Integer, ForeignKey("decisions.id"), nullable=True)
    topic_cluster = Column(Integer, nullable=True)
    predicted_priority = Column(String, nullable=True)  # High, Medium, Low
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="decisions")
    parent = relationship("Decision", remote_side=[id], backref="children")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
