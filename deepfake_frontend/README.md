# Deepfake Insight Dash — Local quickstart

Tiny README with the minimal steps to run this repo locally (Windows PowerShell examples).

1) Prerequisites
	- Node.js (16+) and npm installed
	- A Gemini API key (server-side) if you want to test real model calls

2) Install frontend deps
	Open PowerShell in the project folder `deepfake-insight-dash` and run:

```powershell
npm install
```

3) Start the backend proxy (recommended, hides your Gemini key)
	- Edit `backend/.env` and set `GEMINI_API_KEY` to your Gemini key. Keep the file private.
	- From repo root run:

```powershell
Set-Location -Path .\backend
$env:PORT='4001'  # optional override
node server.js
```

4) Start the frontend dev server

```powershell
Set-Location -Path .\deepfake-insight-dash
npm run dev
```

5) Open the app
	- Visit http://localhost:8080 (or the port Vite reports).
	- Upload a JPG/PNG. The UI will post the file to the local proxy which forwards it to Gemini and returns { filename, result, confidence }.

Notes
	- By default the frontend expects the proxy at `http://localhost:4001/api/detect`. Change `VITE_PROXY_URL` in `.env` if needed.
	- Do NOT commit secrets in `.env` or `backend/.env`.
	- Supabase writes are currently disabled; we can enable server-side saving behind an env flag if you want.

That's it — the smallest steps to run locally. If you'd like, I can also add a one-file quicktest script to POST an image to the proxy for smoke tests.
Environment variables (add to `.env` or your environment when running Vite):

Frontend da : npm run dev --silent
Backend da : $env:PORT='4001'; node server.js