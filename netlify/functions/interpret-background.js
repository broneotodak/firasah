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

// Build prompt with CLEAR examples - ALL features required
function buildPrompt(features, lang) {
  const isMyId = lang.name.includes('Melayu') || lang.name.includes('Indonesia');
  
  if (isMyId) {
    return `Anda pakar Kitab Firasat. Analisis wajah ini dan beri tafsiran BERMAKNA dalam Bahasa Melayu.

CIRI WAJAH DIKESAN:
${features}

PERATURAN PENTING:
1. WAJIB isi SEMUA 10 ciri wajah dengan tafsiran penuh (2-3 ayat setiap satu)
2. Sifat negatif = KESAN SAMPINGAN sifat positif (BUKAN bertentangan!)
3. Berikan 3-4 rujukan Kitab Firasat yang berbeza

WAJIB OUTPUT JSON DENGAN FORMAT INI:
{
  "features": {
    "dahi": "[2-3 ayat tafsiran dahi - saiz, bentuk, dan maksud personaliti]",
    "kening": "[2-3 ayat tafsiran kening - ketebalan, bentuk, jarak]",
    "mata": "[2-3 ayat tafsiran mata - saiz, bentuk, pandangan]",
    "hidung": "[2-3 ayat tafsiran hidung - panjang, lebar, bentuk hujung]",
    "mulut": "[2-3 ayat tafsiran mulut & bibir - ketebalan, lebar]",
    "pipi": "[2-3 ayat tafsiran pipi - bentuk tulang pipi]",
    "rahang": "[2-3 ayat tafsiran rahang & dagu - ketegasan, bentuk]",
    "telinga": "[2-3 ayat tafsiran telinga - saiz, kedudukan]",
    "wajah": "[2-3 ayat tafsiran bentuk wajah keseluruhan]",
    "rambut": "[2-3 ayat tafsiran garis rambut - tinggi, bentuk]"
  },
  "positive": [
    "Sifat 1 (dari ciri wajah) - penjelasan kekuatan",
    "Sifat 2 (dari ciri wajah) - penjelasan kekuatan",
    "Sifat 3 (dari ciri wajah) - penjelasan kekuatan",
    "Sifat 4 (dari ciri wajah) - penjelasan kekuatan",
    "Sifat 5 (dari ciri wajah) - penjelasan kekuatan"
  ],
  "negative": [
    "Kesan sampingan 1 - nasihat membina",
    "Kesan sampingan 2 - nasihat membina",
    "Kesan sampingan 3 - nasihat membina"
  ],
  "type": "Jenis Personaliti - penjelasan temperamen",
  "summary": "5-6 ayat gambaran unik individu ini berdasarkan gabungan semua ciri wajah.",
  "refs": [
    {"feature": "Dahi", "quote": "Petikan Kitab Firasat tentang dahi"},
    {"feature": "Mata", "quote": "Petikan Kitab Firasat tentang mata"},
    {"feature": "Hidung", "quote": "Petikan Kitab Firasat tentang hidung"},
    {"feature": "Rahang", "quote": "Petikan Kitab Firasat tentang rahang"}
  ]
}

PENTING: Isi SEMUA 10 ciri wajah! Jangan tinggalkan mana-mana. JSON sahaja:`;
  }
  
  return `You are a Kitab Firasat expert. Analyze this face with COMPLETE interpretation in English.

DETECTED FACIAL FEATURES:
${features}

IMPORTANT RULES:
1. MUST fill ALL 10 facial features with full interpretation (2-3 sentences each)
2. Negative traits = SIDE EFFECTS of positives (NOT opposites!)
3. Provide 3-4 different Kitab Firasat references

REQUIRED JSON FORMAT:
{
  "features": {
    "dahi": "[2-3 sentences about forehead - size, shape, personality meaning]",
    "kening": "[2-3 sentences about eyebrows - thickness, shape, spacing]",
    "mata": "[2-3 sentences about eyes - size, shape, gaze]",
    "hidung": "[2-3 sentences about nose - length, width, tip shape]",
    "mulut": "[2-3 sentences about mouth & lips - thickness, width]",
    "pipi": "[2-3 sentences about cheeks - cheekbone shape]",
    "rahang": "[2-3 sentences about jaw & chin - firmness, shape]",
    "telinga": "[2-3 sentences about ears - size, position]",
    "wajah": "[2-3 sentences about overall face shape]",
    "rambut": "[2-3 sentences about hairline - height, shape]"
  },
  "positive": [
    "Trait 1 (from facial feature) - strength explanation",
    "Trait 2 (from facial feature) - strength explanation",
    "Trait 3 (from facial feature) - strength explanation",
    "Trait 4 (from facial feature) - strength explanation",
    "Trait 5 (from facial feature) - strength explanation"
  ],
  "negative": [
    "Side effect 1 - constructive advice",
    "Side effect 2 - constructive advice",
    "Side effect 3 - constructive advice"
  ],
  "type": "Personality Type - temperament explanation",
  "summary": "5-6 sentences unique portrait of this individual based on all facial features combined.",
  "refs": [
    {"feature": "Forehead", "quote": "Kitab Firasat quote about forehead"},
    {"feature": "Eyes", "quote": "Kitab Firasat quote about eyes"},
    {"feature": "Nose", "quote": "Kitab Firasat quote about nose"},
    {"feature": "Jaw", "quote": "Kitab Firasat quote about jaw"}
  ]
}

IMPORTANT: Fill ALL 10 facial features! Do not skip any. JSON only:`;
}

// Transform compact result to frontend format - ALL 10 features
function transformResult(r, lang) {
  const arabic = { 
    dahi: 'الجبهة', kening: 'الحواجب', mata: 'العينين', hidung: 'الأنف', 
    mulut: 'الفم', pipi: 'الخدين', rahang: 'الذقن', telinga: 'الأذن', 
    wajah: 'الوجه', rambut: 'خط الشعر' 
  };
  const keys = { 
    dahi: 'dahi', kening: 'kening', mata: 'mata', hidung: 'hidung', 
    mulut: 'mulut_bibir', pipi: 'pipi', rahang: 'rahang_dagu', 
    telinga: 'telinga', wajah: 'bentuk_wajah', rambut: 'garis_rambut' 
  };
  
  const translated_features = {};
  if (r.features) {
    for (const [k, v] of Object.entries(r.features)) {
      const key = keys[k] || k;
      translated_features[key] = { description: v, arabic: arabic[k] || '' };
    }
  }

  // Handle both "ref" (old) and "refs" (new) format
  let kitab_references = [];
  if (r.refs && Array.isArray(r.refs)) {
    kitab_references = r.refs.map(ref => ({
      feature: ref.feature || '',
      quote: ref.quote || '',
      arabic_term: ''
    }));
  } else if (r.ref) {
    kitab_references = [{ feature: r.ref.feature || '', quote: r.ref.quote || '', arabic_term: '' }];
  }

  return {
    translated_features,
    character_interpretation: {
      positive_traits: r.positive || [],
      negative_traits: r.negative || [],
      personality_type: r.type || '',
      overall_summary: r.summary || ''
    },
    kitab_references,
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
