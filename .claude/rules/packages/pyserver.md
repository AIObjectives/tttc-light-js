---
paths: pyserver/**/*.py
---

# Python Server Rules

## Virtual Environment

Always activate the virtual environment:

```bash
cd pyserver
source .venv/bin/activate
```

## Starting the Server

**Always use `uvicorn` directly:**

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Never use `fastapi dev`** - it changes the working directory and breaks local Python imports.

## Running Tests

```bash
cd pyserver
source .venv/bin/activate
pytest
pytest --cov=.  # With coverage
```

## Environment Variables

Required in `pyserver/.env`:
- `ALLOWED_ORIGINS=http://localhost:8080`
- `REDIS_URL=redis://localhost:6379` (optional, for caching)

## CORS

The Express server origin must be in `ALLOWED_ORIGINS` for service-to-service communication.
