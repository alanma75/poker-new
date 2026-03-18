from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import List, Optional
import uuid

app = FastAPI(title="User Story API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_POINTS = {"", "0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "∞"}

# In-memory stores
user_stories: List[dict] = []
voting_sessions: List[dict] = []


class SessionConnectionManager:
    def __init__(self):
        self.connections: dict[str, set[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.connections.setdefault(session_id, set()).add(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        session_connections = self.connections.get(session_id)
        if not session_connections:
            return
        session_connections.discard(websocket)
        if not session_connections:
            self.connections.pop(session_id, None)

    async def broadcast_session(self, session_id: str, payload: dict):
        session_connections = list(self.connections.get(session_id, set()))
        stale_connections: List[WebSocket] = []
        for connection in session_connections:
            try:
                await connection.send_json(payload)
            except Exception:
                stale_connections.append(connection)
        for stale in stale_connections:
            self.disconnect(session_id, stale)


connection_manager = SessionConnectionManager()


# ── User Story models ──────────────────────────────────────────────────────────

class UserStory(BaseModel):
    Name: str
    Comment: str


class UserStoryResponse(UserStory):
    id: str


# ── Voting session models ──────────────────────────────────────────────────────

class CreateVotingSession(BaseModel):
    Name: str
    StoryId: str


class CastVote(BaseModel):
    Participant: str
    Points: str

    @field_validator("Points")
    @classmethod
    def validate_points(cls, v: str) -> str:
        if v not in VALID_POINTS:
            raise ValueError(f"Points must be one of: {', '.join(sorted(VALID_POINTS, key=lambda x: (x.lstrip('-').isdigit() is False, x)))}")
        return v


class VoteResponse(BaseModel):
    id: str
    Participant: str
    Points: str


class VotingSessionResponse(BaseModel):
    id: str
    Name: str
    StoryId: str
    Revealed: bool
    Votes: List[VoteResponse]


# ── User Story endpoints ───────────────────────────────────────────────────────

@app.get("/userstories", response_model=List[UserStoryResponse])
def get_user_stories():
    return user_stories


@app.post("/userstories", response_model=UserStoryResponse, status_code=201)
def create_user_story(story: UserStory):
    new_story = {"id": str(uuid.uuid4()), "Name": story.Name, "Comment": story.Comment}
    user_stories.append(new_story)
    return new_story


# ── Voting session endpoints ───────────────────────────────────────────────────

@app.get("/sessions", response_model=List[VotingSessionResponse])
def get_sessions():
    return voting_sessions


@app.post("/sessions", response_model=VotingSessionResponse, status_code=201)
def create_session(body: CreateVotingSession):
    if not any(s["id"] == body.StoryId for s in user_stories):
        raise HTTPException(status_code=404, detail="User story not found")
    session = {
        "id": str(uuid.uuid4()),
        "Name": body.Name,
        "StoryId": body.StoryId,
        "Revealed": False,
        "Votes": [],
    }
    voting_sessions.append(session)
    return session


@app.get("/sessions/{session_id}", response_model=VotingSessionResponse)
def get_session(session_id: str):
    session = _find_session(session_id)
    return _session_for_client(session)


@app.websocket("/ws/sessions/{session_id}")
async def session_updates(session_id: str, websocket: WebSocket):
    await connection_manager.connect(session_id, websocket)
    try:
        session = _find_session(session_id)
        await websocket.send_json(_session_for_client(session))
    except HTTPException:
        connection_manager.disconnect(session_id, websocket)
        await websocket.close(code=1008, reason="Voting session not found")
        return

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(session_id, websocket)
    except Exception:
        connection_manager.disconnect(session_id, websocket)


@app.post("/sessions/{session_id}/votes", response_model=VoteResponse, status_code=201)
async def cast_vote(session_id: str, body: CastVote):
    session = _find_session(session_id)
    if session["Revealed"]:
        raise HTTPException(status_code=409, detail="Votes are already revealed; reset the session to vote again")
    # Replace existing vote from the same participant
    session["Votes"] = [v for v in session["Votes"] if v["Participant"] != body.Participant]
    vote = {"id": str(uuid.uuid4()), "Participant": body.Participant, "Points": body.Points}
    session["Votes"].append(vote)
    await connection_manager.broadcast_session(session_id, _session_for_client(session))
    return vote


@app.post("/sessions/{session_id}/reveal", response_model=VotingSessionResponse)
async def reveal_votes(session_id: str):
    session = _find_session(session_id)
    session["Revealed"] = True
    await connection_manager.broadcast_session(session_id, _session_for_client(session))
    return session


@app.post("/sessions/{session_id}/reset", response_model=VotingSessionResponse)
async def reset_session(session_id: str):
    session = _find_session(session_id)
    session["Revealed"] = False
    session["Votes"] = [
        {"id": vote["id"], "Participant": vote["Participant"], "Points": ""}
        for vote in session["Votes"]
    ]
    await connection_manager.broadcast_session(session_id, _session_for_client(session))
    return session


# ── Helpers ───────────────────────────────────────────────────────────────────

def _find_session(session_id: str) -> dict:
    for s in voting_sessions:
        if s["id"] == session_id:
            return s
    raise HTTPException(status_code=404, detail="Voting session not found")


def _session_for_client(session: dict) -> dict:
    if not session["Revealed"]:
        masked_votes = []
        for vote in session["Votes"]:
            masked_votes.append(
                {
                    "id": vote["id"],
                    "Participant": vote["Participant"],
                    "Points": "?" if vote["Points"] != "" else "",
                }
            )
        return {**session, "Votes": masked_votes}
    return session
