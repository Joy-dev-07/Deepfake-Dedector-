Deepfake Detector – Super Simple Guide

Hi! This is a tiny app that checks pictures (and some videos) and tells you if they look real or fake.

You will run two parts:
- The helper server (backend) that talks to Google Gemini.
- The website (frontend) that you open in your browser.

What you need
- A Windows PC
- Node.js installed (from nodejs.org)
- A Google Gemini API key
- A Supabase project (optional, for saving history)

Step 1: Start the helper server
1) Open PowerShell
2) Go to the backend folder:
	- cd d:\deepfake-detector\backend
3) Put your Gemini key in the file .env
	- Open the file d:\deepfake-detector\backend\.env
	- Find GEMINI_API_KEY=...
	- Paste your real key after =
4) Install packages (do this once):
	- npm install
5) Start the server:
	- node server.js
6) You should see: Proxy listening on 4001

Step 2: Start the website
1) Open another PowerShell window
2) Go to the website folder:
	- cd d:\deepfake-detector\deepfake-insight-dash
3) Install packages (do this once):
	- npm install
4) (Optional) Make a .env file to save history in Supabase
	- Create a new file: d:\deepfake-detector\deepfake-insight-dash\.env
	- Put these lines (change YOUR-PROJECT and YOUR-KEY):
	  VITE_USE_PROXY=true
	  VITE_PROXY_URL=http://localhost:4001/api/detect
	  VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
	  VITE_SUPABASE_ANON_KEY=YOUR-KEY
	  VITE_SUPABASE_TABLE=file_results
5) Start the website:
	- npm run dev
6) Open your browser and go to:
	- http://localhost:8080

Step 3: Use it
1) Click “Choose File”
2) Pick a small image (JPG/PNG). You can also try a small video (MP4)
3) Wait a moment. It will show:
	- REAL or FAKE
	- A confidence number
4) If you set Supabase, your history will show in the History page and sidebar.

Small tips
- If the page doesn’t open, make sure the website says it is running on 8080, and the server says “Proxy listening on 4001”.
- If uploads don’t work, try smaller files (under 20 MB).
- If history is empty, check your Supabase .env values and your database table file_results.
- Your data is only for testing on your computer.

That’s it! You can now test images and see results.
