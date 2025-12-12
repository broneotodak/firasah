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

// Build prompt with CLEAR examples
function buildPrompt(features, lang) {
  const isMyId = lang.name.includes('Melayu') || lang.name.includes('Indonesia');
  
  if (isMyId) {
    return `Anda pakar Kitab Firasat. Analisis wajah ini dan beri tafsiran BERMAKNA dalam Bahasa Melayu.

CIRI WAJAH DIKESAN:
${features}

PERATURAN PENTING:
1. Setiap ciri wajah mesti ada TAFSIRAN PENUH (2-3 ayat tentang maksud personaliti)
2. Sifat negatif = KESAN SAMPINGAN sifat positif (BUKAN bertentangan!)
   ✓ Betul: Tegas → Kadang terlalu keras
   ✗ Salah: Tenang → Pemarah

CONTOH OUTPUT YANG BETUL:
{
  "features": {
    "dahi": "Dahi yang sederhana lebar menunjukkan keseimbangan pemikiran. Menurut Kitab Firasat, ini petanda seseorang yang bijak membuat keputusan tanpa tergesa-gesa.",
    "mata": "Mata yang tajam dan fokus seperti elang menandakan ketelitian tinggi. Pemilik mata sebegini biasanya pemerhati yang baik dan sukar ditipu.",
    "hidung": "Hidung yang sederhana mancung menunjukkan keyakinan diri yang sihat. Tidak sombong tetapi tahu nilai diri sendiri.",
    "mulut": "Bibir yang sederhana tebal menandakan kesetiaan dan kasih sayang. Orang sebegini biasanya setia dalam perhubungan.",
    "rahang": "Rahang yang tegas menunjukkan ketabahan menghadapi cabaran. Tidak mudah berputus asa.",
    "wajah": "Bentuk wajah oval menandakan keseimbangan antara logik dan emosi. Diplomatis dalam pergaulan."
  },
  "positive": [
    "Kebijaksanaan (dari dahi sederhana) - Mampu berfikir sebelum bertindak",
    "Ketelitian (dari mata tajam) - Pemerhati yang baik, tidak mudah terlepas pandang",
    "Keyakinan Diri (dari hidung mancung) - Yakin dengan kemampuan sendiri",
    "Kesetiaan (dari bibir penuh) - Setia dan boleh dipercayai"
  ],
  "negative": [
    "Terlalu berhati-hati - Kadang lambat membuat keputusan kerana terlalu menganalisis",
    "Terlalu teliti - Boleh menjadi kritikal terhadap kesilapan kecil orang lain",
    "Degil - Keyakinan diri yang tinggi kadang menjadi keras kepala"
  ],
  "type": "Melankolis-Koleris - Pemikir yang tegas, teliti tetapi kadang terlalu serius",
  "summary": "Individu ini memiliki gabungan kebijaksanaan dan ketegasan yang jarang ditemui. Dahi yang seimbang menunjukkan pemikiran yang matang, manakala mata yang tajam menjadikannya pemerhati yang baik. Dalam perhubungan, kesetiaan adalah kekuatan utama. Cabaran utama adalah belajar untuk tidak terlalu kritikal dan lebih fleksibel.",
  "ref": {"quote": "Dahi yang sederhana adalah tanda akal yang seimbang dan hati yang tenang", "feature": "Dahi"}
}

SEKARANG, beri tafsiran untuk wajah ini. JSON sahaja:`;
  }
  
  return `You are a Kitab Firasat expert. Analyze this face and provide MEANINGFUL interpretation in English.

DETECTED FACIAL FEATURES:
${features}

IMPORTANT RULES:
1. Each feature must have FULL INTERPRETATION (2-3 sentences about personality meaning)
2. Negative traits = SIDE EFFECTS of positives (NOT opposites!)
   ✓ Correct: Firm → Sometimes too strict
   ✗ Wrong: Calm → Angry

EXAMPLE OF CORRECT OUTPUT:
{
  "features": {
    "dahi": "A moderately wide forehead indicates balanced thinking. According to Kitab Firasat, this is a sign of someone who makes wise decisions without rushing.",
    "mata": "Sharp, focused eyes like an eagle indicate high attention to detail. Such eyes usually belong to good observers who are hard to deceive.",
    "hidung": "A moderately prominent nose shows healthy self-confidence. Not arrogant but knows their own worth.",
    "mulut": "Moderately full lips indicate loyalty and affection. Such people are usually faithful in relationships.",
    "rahang": "A firm jaw shows resilience in facing challenges. Not easily discouraged.",
    "wajah": "An oval face shape indicates balance between logic and emotion. Diplomatic in social interactions."
  },
  "positive": [
    "Wisdom (from balanced forehead) - Able to think before acting",
    "Attention to Detail (from sharp eyes) - Good observer, doesn't miss things easily",
    "Self-Confidence (from prominent nose) - Confident in own abilities",
    "Loyalty (from full lips) - Faithful and trustworthy"
  ],
  "negative": [
    "Overly cautious - Sometimes slow to decide due to over-analysis",
    "Too detail-oriented - Can become critical of others' small mistakes",
    "Stubborn - High self-confidence sometimes becomes inflexibility"
  ],
  "type": "Melancholic-Choleric - A firm thinker, meticulous but sometimes too serious",
  "summary": "This individual possesses a rare combination of wisdom and firmness. The balanced forehead shows mature thinking, while sharp eyes make them a good observer. In relationships, loyalty is their main strength. The main challenge is learning not to be too critical and to be more flexible.",
  "ref": {"quote": "A balanced forehead is a sign of balanced intellect and a calm heart", "feature": "Forehead"}
}

NOW, provide interpretation for this face. JSON only:`;
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
