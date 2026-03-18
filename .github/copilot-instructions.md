# Copilot Instructions

## Running the App

```bash
uvicorn main:app --reload
```

The API is available at `http://localhost:8000`. Interactive docs at `/docs` (Swagger UI) and `/redoc`.

## Manual Testing

A sample request body is in `test_post.json`. To test with curl:

```bash
curl -X POST http://localhost:8000/userstories \
  -H "Content-Type: application/json" \
  -d @test_post.json

curl http://localhost:8000/userstories
```

## Architecture

Single-file FastAPI app (`main.py`) with an **in-memory list** as the only data store (`user_stories: List[dict]`). There is no database — data does not persist between server restarts.

Two Pydantic models:
- `UserStory` — request body (`Name`, `Comment` — both PascalCase)
- `UserStoryResponse` — extends `UserStory`, adds `id` (UUID string)

## Key Conventions

- **PascalCase field names** on Pydantic models (`Name`, `Comment`) — maintain this when adding new fields
- Stories are stored as plain `dict` objects in the list, not as model instances
- IDs are generated with `str(uuid.uuid4())` at creation time and are immutable
- No authentication, no persistence, no database — keep additions consistent with this lightweight style unless explicitly expanding scope
