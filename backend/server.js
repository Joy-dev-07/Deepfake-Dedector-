require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
// Set a 20 MB file size limit for uploads
const MAX_BYTES = 20 * 1024 * 1024;
const upload = multer({ limits: { fileSize: MAX_BYTES } });
const PORT = process.env.PORT || 4000;

// Allow all origins in development to avoid CORS issues with varying Vite ports
app.use(cors({ origin: true }));

app.post('/api/detect', upload.single('file'), async (req, res) => {
  try {
    // Initialize Supabase if configured
    const SUPABASE_URL = process.env.SUPABASE_URL || (process.env.SUPABASE_HOST ? `https://${process.env.SUPABASE_HOST}` : undefined);
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const SUPABASE_ENABLE = (process.env.SUPABASE_ENABLE || 'false') === 'true';
    let supabase = null;
    if (SUPABASE_URL && SUPABASE_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    const geminiKey = process.env.GEMINI_API_KEY;
    const geminiEndpoint = process.env.GEMINI_API_ENDPOINT;
    if (!geminiKey || !geminiEndpoint) return res.status(500).json({ error: 'Gemini keys not configured on server' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Log file info for troubleshooting
    console.log('[detect] received file:', { originalname: file.originalname, mimetype: file.mimetype, size: file.size });

    // Accept image/* or video/*; if mimetype missing, attempt extension-based detection
    let mime = file.mimetype || '';
    if (!mime && file.originalname) {
      const ext = (file.originalname.split('.').pop() || '').toLowerCase();
      if (['mp4','mov','webm','m4v','avi'].includes(ext)) mime = 'video/' + ext;
      if (['jpg','jpeg','png','webp','gif'].includes(ext)) mime = 'image/' + ext;
    }

    const isImage = mime.startsWith('image/');
    const isVideo = mime.startsWith('video/');
    if (!isImage && !isVideo) {
      console.warn('[detect] unsupported mime:', mime);
      return res.status(415).json({ error: 'Unsupported file type. Please upload an image (JPG/PNG) or a video (MP4, MOV, WEBM).' , mime });
    }

    const b64 = file.buffer.toString('base64');
    // Google Generative Language API (AI Studio) generateContent format
    // Endpoint example: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
    // Use detected mime (may have been inferred from filename)
    console.log('[detect] using mime:', mime);
    const promptText = isVideo
      ? "You are a deepfake detection assistant. Analyze the uploaded video and determine if it is REAL or FAKE (AI-generated or manipulated). If possible, inspect motion artifacts, face/eye inconsistencies, frame blending, or other signs. Respond ONLY with compact JSON: { \"result\": \"Real\" or \"Fake\", \"confidence\": 0.xx }. Do not include any other text."
      : "You are a deepfake detection assistant. Analyze the uploaded image and determine if it is REAL or FAKE (AI-generated or manipulated). Respond ONLY with compact JSON: { \"result\": \"Real\" or \"Fake\", \"confidence\": 0.xx }. Do not include any other text.";

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            { inline_data: { mime_type: mime || file.mimetype || 'application/octet-stream', data: b64 } }
          ]
        }
      ]
    };

    function buildCandidates(ep) {
      const candidates = [];
      const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const baseModels = [model, 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-1.5-pro-latest'];
      const apiBases = ['https://generativelanguage.googleapis.com/v1beta', 'https://generativelanguage.googleapis.com/v1'];
      for (const apiBase of apiBases) {
        for (const m of baseModels) {
          candidates.push(`${apiBase}/models/${m}:generateContent`);
          if (!m.endsWith('-latest')) candidates.push(`${apiBase}/models/${m}-latest:generateContent`);
        }
      }
      // Ensure env endpoint first if provided
      if (ep) candidates.unshift(ep);
      // De-duplicate
      return [...new Set(candidates)];
    }

    async function tryPost(endpoints) {
      const errors = [];
      for (const url of endpoints) {
        try {
          const r = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
            params: { key: geminiKey },
            validateStatus: () => true,
          });
          if (r.status >= 200 && r.status < 300) {
            return { resp: r, used: url };
          } else {
            errors.push({ url, status: r.status, data: r.data });
            // Continue on 404/400; break early on 401/403 (auth)
            if (r.status === 401 || r.status === 403) break;
          }
        } catch (e) {
          errors.push({ url, error: e?.message || e });
        }
      }
      const err = new Error('All Gemini endpoints failed');
      err.details = errors;
      throw err;
    }

    const { resp, used } = await tryPost(buildCandidates(geminiEndpoint));
    if (used) console.log('[detect] using endpoint:', used);

    // Normalize response into { filename, result, confidence }
  const raw = resp.data;

    function tryExtractJson(str) {
      try {
        return JSON.parse(str);
      } catch (e) {
        // Try to locate a JSON object inside the string
        const start = str.indexOf('{');
        const end = str.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          try {
            return JSON.parse(str.slice(start, end + 1));
          } catch (e2) {
            return null;
          }
        }
        return null;
      }
    }

    function extractNormalized(data) {
      // 1) Common fields
      const possible = ['predictions','outputs','results','response','output','candidates'];
      for (const key of possible) {
        if (data && Object.prototype.hasOwnProperty.call(data, key)) {
          const val = data[key];
          if (Array.isArray(val)) {
            for (const v of val) {
              if (typeof v === 'string') {
                const j = tryExtractJson(v);
                if (j && j.result) return j;
              } else if (v && typeof v === 'object') {
                // Check nested text/content fields including AI Studio response shape
                // AI Studio: candidates[].content.parts[].text
                if (v.content && Array.isArray(v.content.parts)) {
                  for (const p of v.content.parts) {
                    if (typeof p?.text === 'string') {
                      const j = tryExtractJson(p.text);
                      if (j && j.result) return j;
                    }
                  }
                }
                const text = v.text || v.content || v.output || null;
                if (typeof text === 'string') {
                  const j = tryExtractJson(text);
                  if (j && j.result) return j;
                }
              }
            }
          } else if (typeof val === 'string') {
            const j = tryExtractJson(val);
            if (j && j.result) return j;
          }
        }
      }

      // 2) Fallback: stringify and regex search for an object containing result and confidence
      try {
        const s = JSON.stringify(data);
        const match = s.match(/\{[^{}]*\"result\"\s*:\s*\"(Real|Fake)[^\"]*\"[^{}]*\"confidence\"\s*:\s*([0-9.]+)[^{}]*\}/i);
        if (match) {
          const objStr = match[0]
            .replace(/\\n/g, '')
            .replace(/\\"/g, '"');
          const j = tryExtractJson(objStr);
          if (j && j.result) return j;
        }
      } catch (e) { /* ignore */ }

      return null;
    }

    const parsed = extractNormalized(raw) || { result: 'Unknown', confidence: 0 };

    const out = {
      filename: file.originalname,
      result: parsed.result,
      confidence: Number(parsed.confidence) || 0,
      fileType: isVideo ? 'video' : 'image',
      thumbnail: null,
      raw,
    };

    // If frontend included a small thumbnail in the request body via a field, try to read it (optional).
    // For now thumbnail is added client-side to localStorage; server-side saving only stores the fields above.

    // Attempt to save to Supabase if enabled
    if (SUPABASE_ENABLE && supabase) {
      try {
        // Match provided schema: columns (id, file, result, confidence, created_at)
        const insert = {
          file: out.filename,
          result: out.result,
          confidence: out.confidence,
        };
        const TABLE = process.env.SUPABASE_TABLE || 'file_results';
        const { data: sdata, error: serror } = await supabase
          .from(TABLE)
          .insert([insert])
          .select('*');
        if (serror) {
          console.warn('[supabase] insert warning', serror.message || serror);
        } else if (sdata && sdata[0]) {
          out.id = sdata[0].id;
          out.created_at = sdata[0].created_at;
          console.log('[supabase] insert succeeded, id=', out.id);
        }
      } catch (e) {
        console.warn('[supabase] save failed', e?.message || e);
      }
    }

    return res.json(out);
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error('Gemini proxy error:', status, data || err?.message || err);
    res.status(500).json({ error: 'Gemini proxy error', status, details: data || (err?.message || err) });
  }
});

app.listen(PORT, () => console.log(`Proxy listening on ${PORT}`));

// History endpoints: GET /api/history, DELETE /api/history
app.get('/api/history', async (req, res) => {
  const SUPABASE_URL = process.env.SUPABASE_URL || (process.env.SUPABASE_HOST ? `https://${process.env.SUPABASE_HOST}` : undefined);
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(501).json({ error: 'Supabase not configured on server' });
  }
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const TABLE = process.env.SUPABASE_TABLE || 'file_results';
    const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return res.status(500).json({ error: 'Supabase query failed', details: error.message || error });
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ error: 'Supabase error', details: e?.message || e });
  }
});

app.delete('/api/history', async (req, res) => {
  const SUPABASE_URL = process.env.SUPABASE_URL || (process.env.SUPABASE_HOST ? `https://${process.env.SUPABASE_HOST}` : undefined);
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(501).json({ error: 'Supabase not configured on server' });
  }
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const TABLE = process.env.SUPABASE_TABLE || 'file_results';
    const { data, error } = await supabase.from(TABLE).delete().neq('id', 0);
    if (error) return res.status(500).json({ error: 'Supabase delete failed', details: error.message || error });
    return res.json({ deleted: true, data });
  } catch (e) {
    return res.status(500).json({ error: 'Supabase error', details: e?.message || e });
  }
});
