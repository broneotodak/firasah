// netlify/functions/interpret-background.js
// Background function - runs up to 15 minutes
// Called by frontend, returns 202 immediately, processes in background
// Results stored in Supabase firasah_jobs table

exports.handler = async (event, context) => {
  // Background functions still need CORS for the initial 202 response
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Parse input
  let llavaAnalysis, language, jobId;
  try {
    const body = JSON.parse(event.body);
    llavaAnalysis = body.llavaAnalysis;
    language = body.language || 'my';
    jobId = body.jobId || `frs_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  } catch (e) {
    console.error('Parse error:', e);
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid input' }) };
  }

  if (!llavaAnalysis) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing llavaAnalysis' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uzamamymfzhelvkwpvgt.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_KEY) {
    console.error('No Supabase key configured');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config error' }) };
  }

  const startTime = Date.now();

  // Create job record immediately
  try {
    await supabaseRequest(SUPABASE_URL, SUPABASE_KEY, 'POST', '/rest/v1/firasah_jobs', {
      job_id: jobId,
      status: 'processing',
      language: language,
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to create job:', e);
  }

  // Process interpretation
  try {
    console.log(`[${jobId}] Starting interpretation...`);
    
    const features = extractFeatures(llavaAnalysis);
    const lang = getLangConfig(language);
    const prompt = buildPrompt(features, lang);
    
    let result = null;
    let provider = null;

    // Try providers: Gemini (fast) > OpenAI > Claude
    if (!result && process.env.GEMINI_API_KEY) {
      try {
        console.log(`[${jobId}] Trying Gemini...`);
        result = await callGemini(prompt);
        if (result) provider = 'gemini';
      } catch (e) { console.log(`[${jobId}] Gemini failed:`, e.message); }
    }

    if (!result && process.env.OPENAI_API_KEY) {
      try {
        console.log(`[${jobId}] Trying OpenAI...`);
        result = await callOpenAI(prompt);
        if (result) provider = 'openai';
      } catch (e) { console.log(`[${jobId}] OpenAI failed:`, e.message); }
    }

    if (!result && process.env.ANTHROPIC_API_KEY) {
      try {
        console.log(`[${jobId}] Trying Claude...`);
        result = await callClaude(prompt);
        if (result) provider = 'claude';
      } catch (e) { console.log(`[${jobId}] Claude failed:`, e.message); }
    }

    const duration = Date.now() - startTime;

    if (result) {
      // Transform and save success
      const interpretation = transformResult(result, language);
      
      await supabaseRequest(SUPABASE_URL, SUPABASE_KEY, 'PATCH', `/rest/v1/firasah_jobs?job_id=eq.${jobId}`, {
        status: 'completed',
        result: {
          interpretation,
          source: { title: "Kitab Firasat", author: "Imam ar-Razi", period: "1150-1210 M", arabic: "الفراسة" },
          langConfig: lang
        },
        provider: provider,
        duration_ms: duration,
        completed_at: new Date().toISOString()
      });
      
      console.log(`[${jobId}] Completed with ${provider} in ${duration}ms`);
    } else {
      // Save failure
      await supabaseRequest(SUPABASE_URL, SUPABASE_KEY, 'PATCH', `/rest/v1/firasah_jobs?job_id=eq.${jobId}`, {
        status: 'failed',
        error: 'All AI providers failed',
        duration_ms: duration,
        completed_at: new Date().toISOString()
      });
      
      console.log(`[${jobId}] All providers failed after ${duration}ms`);
    }

  } catch (error) {
    console.error(`[${jobId}] Error:`, error);
    
    await supabaseRequest(SUPABASE_URL, SUPABASE_KEY, 'PATCH', `/rest/v1/firasah_jobs?job_id=eq.${jobId}`, {
      status: 'failed',
      error: error.message,
      completed_at: new Date().toISOString()
    });
  }

  // Background function returns 202 (this won't be seen by client as Netlify handles it)
  return { statusCode: 202, headers, body: JSON.stringify({ jobId }) };
};

// Supabase helper
async function supabaseRequest(url, key, method, path, body) {
  const r = await fetch(`${url}${path}`, {
    method,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=minimal' : undefined
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok && r.status !== 201 && r.status !== 204) {
    throw new Error(`Supabase ${method} failed: ${r.status}`);
  }
  return r;
}

// Language config
function getLangConfig(lang) {
  return {
    my: { name: 'Bahasa Melayu', summaryLabel: 'Ringkasan', positiveLabel: 'Sifat Positif', negativeLabel: 'Perlu Diperhatikan', personalityLabel: 'Personaliti', disclaimer: 'Berdasarkan Kitab Firasat untuk muhasabah diri.' },
    en: { name: 'English', summaryLabel: 'Summary', positiveLabel: 'Positive Traits', negativeLabel: 'Watch Out For', personalityLabel: 'Personality', disclaimer: 'Based on Kitab Firasat for self-reflection.' },
    id: { name: 'Bahasa Indonesia', summaryLabel: 'Ringkasan', positiveLabel: 'Sifat Positif', negativeLabel: 'Perlu Diperhatikan', personalityLabel: 'Kepribadian', disclaimer: 'Berdasarkan Kitab Firasat untuk refleksi diri.' }
  }[lang] || getLangConfig('my');
}

// Build prompt
function buildPrompt(features, lang) {
  return `Firasah face analysis in ${lang.name}. Features: ${features}

CRITICAL RULE: negative traits must be SIDE EFFECTS of positives, NOT opposites!
✓ CORRECT: Firm → Sometimes too strict
✗ WRONG: Calm → Angry (contradiction!)

Each trait must reference the facial feature it comes from.

JSON only:
{"features":{"dahi":"forehead interpretation","mata":"eyes interpretation","hidung":"nose interpretation","mulut":"mouth interpretation","rahang":"jaw interpretation","wajah":"face shape interpretation"},"positive":["Trait1 (from feature) - explanation","Trait2 (from feature) - explanation","Trait3 (from feature) - explanation","Trait4 (from feature) - explanation"],"negative":["Side-effect1 - constructive advice","Side-effect2 - constructive advice","Side-effect3 - constructive advice"],"type":"Personality type - brief explanation","summary":"4-5 sentences unique character summary for this specific face","ref":{"quote":"relevant Kitab Firasat quote","feature":"related feature"}}`;
}

// Transform compact result to frontend format
function transformResult(r, lang) {
  const arabic = { dahi: 'الجبهة', mata: 'العينين', hidung: 'الأنف', mulut: 'الفم', rahang: 'الذقن', wajah: 'الوجه' };
  const keys = { dahi: 'dahi', mata: 'mata', hidung: 'hidung', mulut: 'mulut_bibir', rahang: 'rahang_dagu', wajah: 'bentuk_wajah' };
  
  const translated_features = {};
  if (r.features) {
    for (const [k, v] of Object.entries(r.features)) {
      translated_features[keys[k] || k] = { description: v, arabic: arabic[k] || '' };
    }
  }

  return {
    translated_features,
    character_interpretation: {
      positive_traits: r.positive || [],
      negative_traits: r.negative || [],
      personality_type: r.type || '',
      overall_summary: r.summary || ''
    },
    kitab_references: r.ref ? [{ feature: r.ref.feature || '', quote: r.ref.quote || '', arabic_term: '' }] : [],
    disclaimer: getLangConfig(lang).disclaimer
  };
}

// API Calls
async function callGemini(prompt) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25, maxOutputTokens: 1200 } })
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const d = await r.json();
  const m = d.candidates?.[0]?.content?.parts?.[0]?.text?.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

async function callOpenAI(prompt) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.25, max_tokens: 1200, response_format: { type: "json_object" } })
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  return JSON.parse((await r.json()).choices[0].message.content);
}

async function callClaude(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1200, temperature: 0.25, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) throw new Error(`Claude ${r.status}`);
  const m = (await r.json()).content[0].text.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

// Extract features
function extractFeatures(analysis) {
  const parts = [];
  const patterns = [
    { rx: /forehead[:\s]*([^.]{10,80})/i, label: 'Forehead' },
    { rx: /eyes?[:\s]*([^.]{10,80})/i, label: 'Eyes' },
    { rx: /nose[:\s]*([^.]{10,80})/i, label: 'Nose' },
    { rx: /lips?|mouth[:\s]*([^.]{10,80})/i, label: 'Mouth' },
    { rx: /jaw|chin[:\s]*([^.]{10,80})/i, label: 'Jaw' },
    { rx: /face\s*shape[:\s]*([^.]{10,80})/i, label: 'Face' }
  ];
  for (const { rx, label } of patterns) {
    const m = analysis.match(rx);
    if (m && m[1]) parts.push(`${label}: ${m[1].trim()}`);
  }
  return parts.length > 0 ? parts.join(' | ') : analysis.substring(0, 400);
}
