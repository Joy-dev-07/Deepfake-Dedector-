/* API helpers for frontend direct calls to Gemini HTTP API and Supabase

WARNING: Calling Gemini and Supabase directly from the browser exposes API keys/secrets to users.
Only do this if you understand and accept the risk. Prefer a backend to keep keys secret.
*/

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_API_ENDPOINT = import.meta.env.VITE_GEMINI_API_ENDPOINT as string | undefined;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-pro-vision";
const USE_PROXY = (import.meta.env.VITE_USE_PROXY as string | undefined) === 'true';
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:4001/api/detect';
 
let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export async function analyzeImageWithGemini(file: File) {
  // Prefer proxy when enabled
  if (USE_PROXY) {
    const form = new FormData();
    form.append('file', file);
    const resp = await fetch(PROXY_URL, {
      method: 'POST',
      body: form,
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Proxy error ${resp.status}: ${txt}`);
    }
    const data = await resp.json();
    if (!data || typeof data.result !== 'string') {
      throw new Error('Invalid proxy response');
    }
    return { result: data.result, confidence: Number(data.confidence) || 0, raw: data.raw };
  }

  // Fallback: direct Gemini call (will likely fail CORS in browser)
  if (!GEMINI_API_KEY || !GEMINI_API_ENDPOINT) {
    throw new Error("GEMINI_API_KEY or GEMINI_API_ENDPOINT not set in env (VITE_ vars)");
  }
  const b64 = await fileToBase64(file);
  const payload = {
    instances: [
      {
        image: { content: b64 },
        prompt: `You are a deepfake detection assistant. Analyze the uploaded image and decide if it looks REAL or FAKE (AI-generated or manipulated). Respond in JSON with two fields: { \"result\": \"Real\" or \"Fake\", \"confidence\": 0.xx }`,
        model: GEMINI_MODEL,
      },
    ],
  };
  const resp = await fetch(GEMINI_API_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Gemini HTTP error ${resp.status}: ${txt}`);
  }
  const data = await resp.json();
  // Expect direct JSON from model with result/confidence; otherwise throw
  if (!data || !data.result) throw new Error('Unexpected Gemini response');
  return { result: data.result, confidence: Number(data.confidence) || 0, raw: data };
}

export async function saveDetectionToSupabase({ filename, result, confidence }: { filename: string; result: string; confidence: number; }) {
  if (!supabase) throw new Error("Supabase client not configured (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY)");
  const { data, error } = await supabase.from("detections").insert([{ filename, result, confidence }]);
  if (error) throw error;
  return data;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:<mime>;base64,<b64>
      const idx = result.indexOf(",");
      if (idx >= 0) resolve(result.slice(idx + 1));
      else resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
