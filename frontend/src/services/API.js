const BASE = window._env_?.API_URL || process.env.REACT_APP_API_URL || "http://localhost:8001";

export const analyzeMeeting = async (transcript, title) => {
    const response = await fetch(`${BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, title: title || "Text Meeting" }),
    });
    if (!response.ok) throw new Error("Backend connection failed");
    return response.json();
};

export const analyzeAudio = async (blob) => {
    const formData = new FormData();
    formData.append("file", blob, "recording.webm");
    const response = await fetch(`${BASE}/analyze-audio`, {
        method: "POST",
        body: formData,
    });
    if (!response.ok) throw new Error("Audio analysis failed");
    return response.json();
};

export const getMeetings = async () => {
    const response = await fetch(`${BASE}/meetings`);
    if (!response.ok) throw new Error("Failed to fetch meetings");
    return response.json();
};

export const getMeeting = async (id) => {
    const response = await fetch(`${BASE}/meetings/${id}`);
    if (!response.ok) throw new Error("Failed to fetch meeting");
    return response.json();
};

export const deleteMeeting = async (id) => {
    const response = await fetch(`${BASE}/meetings/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to delete meeting");
    return response.json();
};

export const getDecisionLineage = async (id) => {
    const response = await fetch(`${BASE}/decisions/${id}/lineage`);
    if (!response.ok) throw new Error("Failed to fetch lineage");
    return response.json();
};

export const updateDecisionStatus = async (id, status) => {
    const response = await fetch(`${BASE}/decisions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error("Failed to update status");
    return response.json();
};

export const updateDecisionPriority = async (id, priority) => {
    const response = await fetch(`${BASE}/decisions/${id}/priority`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
    });
    if (!response.ok) throw new Error("Failed to update priority");
    return response.json();
};

export const getMLInsights = async () => {
    const response = await fetch(`${BASE}/ml/insights`, { method: "POST" });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to get ML insights");
    }
    return response.json();
};
