"""
Decisio ML Module
- Topic Clustering: TF-IDF + K-Means unsupervised clustering
- Priority Prediction: TF-IDF + Random Forest classifier
"""

import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.metrics import classification_report, silhouette_score
from sklearn.pipeline import Pipeline


# ──────────────────────────────────────────
# Priority labeling heuristics (training data)
# ──────────────────────────────────────────

HIGH_KEYWORDS = [
    "urgent", "immediately", "asap", "critical", "deadline", "blocker",
    "must", "emergency", "priority", "crucial", "escalate", "today",
    "risk", "security", "outage", "breaking", "fix now", "mandatory",
]

MEDIUM_KEYWORDS = [
    "important", "soon", "next week", "should", "plan", "review",
    "schedule", "update", "follow up", "discuss", "consider", "evaluate",
    "meeting", "budget", "strategy", "milestone", "quarterly",
]

LOW_KEYWORDS = [
    "eventually", "backlog", "nice to have", "optional", "explore",
    "someday", "low priority", "when possible", "minor", "cosmetic",
    "suggestion", "idea", "brainstorm", "long term", "future",
]


def _heuristic_priority(text: str, confidence: float, num_actions: int) -> str:
    """Assign a priority label using keyword matching + metadata signals."""
    lower = text.lower()

    high_score = sum(1 for kw in HIGH_KEYWORDS if kw in lower)
    med_score = sum(1 for kw in MEDIUM_KEYWORDS if kw in lower)
    low_score = sum(1 for kw in LOW_KEYWORDS if kw in lower)

    # Boost high priority if many action items or high confidence
    if num_actions >= 3:
        high_score += 1
    if confidence >= 0.9:
        high_score += 1
    elif confidence < 0.5:
        low_score += 1

    if high_score > med_score and high_score > low_score:
        return "High"
    elif low_score > med_score and low_score > high_score:
        return "Low"
    else:
        return "Medium"


# ──────────────────────────────────────────
# Topic Clustering (TF-IDF + K-Means)
# ──────────────────────────────────────────

class TopicClusterer:
    """Unsupervised topic clustering using TF-IDF vectorization and K-Means."""

    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=500,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.95,
        )
        self.model = None
        self.n_clusters = None

    def _choose_k(self, n_samples: int) -> int:
        """Pick number of clusters based on dataset size (min 2, max 8)."""
        if n_samples < 4:
            return 2
        return min(max(2, int(np.sqrt(n_samples / 2))), 8)

    def fit_predict(self, texts: list[str]) -> dict:
        """
        Cluster decision texts and return labels, top terms, and metrics.
        Returns dict with: labels, cluster_names, silhouette, tfidf_matrix shape
        """
        if len(texts) < 3:
            return {
                "labels": [0] * len(texts),
                "cluster_names": {0: "All Decisions"},
                "silhouette": None,
                "n_clusters": 1,
                "n_samples": len(texts),
                "n_features": 0,
            }

        tfidf_matrix = self.vectorizer.fit_transform(texts)
        self.n_clusters = self._choose_k(len(texts))

        self.model = KMeans(
            n_clusters=self.n_clusters,
            random_state=42,
            n_init=10,
            max_iter=300,
        )
        labels = self.model.fit_predict(tfidf_matrix)

        # Extract top terms per cluster for naming
        feature_names = self.vectorizer.get_feature_names_out()
        cluster_names = {}
        for i in range(self.n_clusters):
            center = self.model.cluster_centers_[i]
            top_indices = center.argsort()[-3:][::-1]
            top_terms = [feature_names[idx] for idx in top_indices]
            cluster_names[i] = ", ".join(top_terms).title()

        # Silhouette score (clustering quality metric)
        sil_score = None
        if self.n_clusters > 1 and len(texts) > self.n_clusters:
            sil_score = round(float(silhouette_score(tfidf_matrix, labels)), 4)

        return {
            "labels": labels.tolist(),
            "cluster_names": cluster_names,
            "silhouette": sil_score,
            "n_clusters": self.n_clusters,
            "n_samples": tfidf_matrix.shape[0],
            "n_features": tfidf_matrix.shape[1],
        }


# ──────────────────────────────────────────
# Priority Prediction (TF-IDF + Random Forest)
# ──────────────────────────────────────────

class PriorityPredictor:
    """
    Supervised priority classifier using TF-IDF text features
    combined with metadata features, trained via Random Forest.
    """

    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=300,
            stop_words="english",
            ngram_range=(1, 2),
        )
        self.model = RandomForestClassifier(
            n_estimators=100,
            random_state=42,
            max_depth=10,
            class_weight="balanced",
        )
        self.is_trained = False
        self.evaluation = None

    def _extract_meta_features(self, text: str, confidence: float, num_actions: int) -> list[float]:
        """Hand-crafted features beyond TF-IDF."""
        lower = text.lower()
        return [
            len(text),                                              # text length
            len(text.split()),                                      # word count
            confidence,                                             # model confidence
            num_actions,                                            # number of action items
            sum(1 for kw in HIGH_KEYWORDS if kw in lower),         # high keyword count
            sum(1 for kw in MEDIUM_KEYWORDS if kw in lower),       # medium keyword count
            sum(1 for kw in LOW_KEYWORDS if kw in lower),          # low keyword count
            len(re.findall(r'[!?]', text)),                        # urgency punctuation
            1.0 if any(w in lower for w in ["not", "don't", "won't", "can't"]) else 0.0,  # negation
        ]

    def train(self, decisions: list[dict]) -> dict:
        """
        Train on decision records. Each dict needs:
        statement, context, confidence_score, related_actions
        """
        if len(decisions) < 5:
            return {"error": "Need at least 5 decisions to train", "trained": False}

        texts = []
        meta_features = []
        labels = []

        for d in decisions:
            combined_text = f"{d['statement']} {d.get('context', '')}"
            texts.append(combined_text)

            num_actions = len(d.get("related_actions", []) or [])
            conf = d.get("confidence_score", 0.5)

            meta_features.append(self._extract_meta_features(combined_text, conf, num_actions))

            # Prefer user-set label; fall back to heuristic so we still have a target
            user_label = d.get("user_priority")
            if user_label in ("High", "Medium", "Low"):
                labels.append(user_label)
            else:
                labels.append(_heuristic_priority(combined_text, conf, num_actions))

        # Build combined feature matrix: TF-IDF + hand-crafted
        tfidf_matrix = self.vectorizer.fit_transform(texts).toarray()
        meta_array = np.array(meta_features)
        X = np.hstack([tfidf_matrix, meta_array])
        y = np.array(labels)

        # Train
        self.model.fit(X, y)
        self.is_trained = True

        # Evaluate with cross-validation (if enough samples)
        eval_result = {"trained": True, "n_samples": len(decisions)}
        unique_labels = np.unique(y)
        eval_result["label_distribution"] = {
            str(label): int(np.sum(y == label)) for label in unique_labels
        }

        if len(decisions) >= 10 and len(unique_labels) > 1:
            cv_folds = min(5, len(decisions) // 2)
            try:
                scores = cross_val_score(self.model, X, y, cv=cv_folds, scoring="accuracy")
                eval_result["cv_accuracy_mean"] = round(float(scores.mean()), 4)
                eval_result["cv_accuracy_std"] = round(float(scores.std()), 4)
                eval_result["cv_folds"] = cv_folds
            except Exception:
                eval_result["cv_accuracy_mean"] = None

            # Full classification report
            y_pred = self.model.predict(X)
            report = classification_report(y, y_pred, output_dict=True, zero_division=0)
            eval_result["classification_report"] = {
                str(k): v for k, v in report.items()
                if str(k) in [str(l) for l in unique_labels] + ["accuracy", "macro avg", "weighted avg"]
            }

        # Feature importance (top 15)
        importances = self.model.feature_importances_
        tfidf_names = list(self.vectorizer.get_feature_names_out())
        meta_names = [
            "text_length", "word_count", "confidence", "num_actions",
            "high_kw_count", "med_kw_count", "low_kw_count",
            "urgency_punct", "has_negation",
        ]
        all_names = tfidf_names + meta_names
        top_idx = importances.argsort()[-15:][::-1]
        eval_result["top_features"] = [
            {"feature": all_names[i], "importance": round(float(importances[i]), 4)}
            for i in top_idx if importances[i] > 0
        ]

        self.evaluation = eval_result
        return eval_result

    def predict(self, statement: str, context: str = "",
                confidence: float = 0.5, num_actions: int = 0) -> dict:
        """Predict priority for a single decision."""
        if not self.is_trained:
            # Fallback to heuristic
            combined = f"{statement} {context}"
            return {
                "priority": _heuristic_priority(combined, confidence, num_actions),
                "method": "heuristic",
            }

        combined = f"{statement} {context}"
        tfidf_vec = self.vectorizer.transform([combined]).toarray()
        meta = np.array([self._extract_meta_features(combined, confidence, num_actions)])
        X = np.hstack([tfidf_vec, meta])

        prediction = self.model.predict(X)[0]
        probabilities = self.model.predict_proba(X)[0]
        classes = self.model.classes_

        return {
            "priority": str(prediction),
            "method": "random_forest",
            "probabilities": {
                str(cls): round(float(prob), 4)
                for cls, prob in zip(classes, probabilities)
            },
        }

    def predict_batch(self, decisions: list[dict]) -> list[dict]:
        """Predict priorities for multiple decisions."""
        results = []
        for d in decisions:
            pred = self.predict(
                statement=d["statement"],
                context=d.get("context", ""),
                confidence=d.get("confidence_score", 0.5),
                num_actions=len(d.get("related_actions", []) or []),
            )
            pred["decision_id"] = d.get("id")
            pred["statement"] = d["statement"]
            results.append(pred)
        return results
