# CORS / frontend origin notes (backend)

React frontend often runs on a **different port** than the API (`8000`).

## How it is configured

CORS is loaded from **`app/core/config.py`** via pydantic-settings, which reads
**`/home/hanzlamayo/Desktop/logistic/.env`**.

Current `.env` values:

```
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:4173,http://127.0.0.1:4173
```

`GET /health` reports the active allow-list.

## Custom frontend port

Add the origin to `.env`, then **restart** uvicorn (settings load at process start):

```bash
# edit .env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5180,http://127.0.0.1:5180

cd /home/hanzlamayo/Desktop/logistic
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Or set a shell env var for one-off runs:

```bash
CORS_ORIGINS="http://localhost:5180,http://127.0.0.1:5180" \
  .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Open CORS for local debugging only

```bash
CORS_ALLOW_ALL=true \
  .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Note: when origins is `*`, `allow_credentials` is forced off (browser rule).

## Live data note

Until Redis/WebSocket channels exist, the admin live map polls:

`GET /admin/dashboard/live-map` and `GET /admin/dashboard/overview`

every ~5 seconds from the React client.

Driver dashboard polls profile/deliveries/recovery every 6s; customer dashboard/notifications every 8s.
