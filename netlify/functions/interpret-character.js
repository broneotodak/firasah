// netlify/functions/interpret-character.js
// v3.0 - Super optimized for speed, prioritize Gemini (fastest)

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { llavaAnalysis, language = 'my' } = JSON.parse(event.body);
    if (!llavaAnalysis) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing analysis' }) };
    }

    const startTime = Date.now();
    const features = extractFeatures(llavaAnalysis);
    const lang = { my: 'Melayu', en: 'English', id: 'Indonesia' }[language] || 'Melayu';
    
    // Super compact prompt - ~500 tokens
    const prompt = `Firasah face analysis in ${lang}. Features: ${features}

RULE: negative traits = side effects of positives (NOT opposites!)
✓ Firm→Stubborn | ✗ Calm→Angry

JSON:{"features":{"dahi":"...","mata":"...","hidung":"...","mulut":"...","rahang":"...","wajah":"..."},"positive":["trait (feature)-why","...","...","..."],"negative":["side effect-advice","...","..."],"type":"personality type","summary":"3 sentences unique to this face","ref":{"quote":"kitab quote","feature":"..."}}`;

    // Try providers in speed order: Gemini > OpenAI > Claude
    let result = null;
    let provider = null;

    // 1. Try Gemini first (fastest)
    if (!result && process.env.GEMINI_API_KEY) {
      try {
        console.log('Trying Gemini...');
        result = await callGemini(prompt);
        if (result) provider = 'gemini';
      } catch (e) { console.log('Gemini failed:', e.message); }
    }

    // 2. Try OpenAI 
    if (!result && process.env.OPENAI_API_KEY) {
      try {
        console.log('Trying OpenAI...');
        result = await callOpenAI(prompt);
        if (result) provider = 'openai';
      } catch (e) { console.log('OpenAI failed:', e.message); }
    }

    // 3. Try Claude
    if (!result && process.env.ANTHROPIC_API_KEY) {
      try {
        console.log('Trying Claude...');
        result = await callClaude(prompt);
        if (result) provider = 'claude';
      } catch (e) { console.log('Claude failed:', e.message); }
    }

    if (!result) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'All AI providers failed' }) };
    }

    console.log(`Success with ${provider} in ${Date.now() - startTime}ms`);

    // Transform compact result to full format
    const interpretation = transformResult(result, language);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        interpretation,
        source: { title: "Kitab Firasat", author: "Imam ar-Razi", period: "1150-1210 M", arabic: "الفراسة" },
        langConfig: getLangConfig(language),
        provider,
        duration: Date.now() - startTime
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

// Transform compact result to full format expected by frontend
function transformResult(r, lang) {
  const arabicTerms = { dahi: 'الجبهة', mata: 'العينين', hidung: 'الأنف', mulut: 'الفم', rahang: 'الذقن', wajah: 'الوجه' };
  const featureNames = { dahi: 'dahi', mata: 'mata', hidung: 'hidung', mulut: 'mulut_bibir', rahang: 'rahang_dagu', wajah: 'bentuk_wajah' };
  
  const translated_features = {};
  if (r.features) {
    for (const [k, v] of Object.entries(r.features)) {
      const key = featureNames[k] || k;
      translated_features[key] = { description: v, arabic: arabicTerms[k] || '' };
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

function getLangConfig(lang) {
  return {
    my: { name: 'Bahasa Melayu', summaryLabel: 'Ringkasan', positiveLabel: 'Sifat Positif', negativeLabel: 'Perlu Diperhatikan', personalityLabel: 'Personaliti', disclaimer: 'Berdasarkan Kitab Firasat untuk muhasabah diri.' },
    en: { name: 'English', summaryLabel: 'Summary', positiveLabel: 'Positive Traits', negativeLabel: 'Watch Out For', personalityLabel: 'Personality', disclaimer: 'Based on Kitab Firasat for self-reflection.' },
    id: { name: 'Bahasa Indonesia', summaryLabel: 'Ringkasan', positiveLabel: 'Sifat Positif', negativeLabel: 'Perlu Diperhatikan', personalityLabel: 'Kepribadian', disclaimer: 'Berdasarkan Kitab Firasat untuk refleksi diri.' }
  }[lang] || getLangConfig('my');
}

// Gemini - usually fastest
async function callGemini(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }], 
        generationConfig: { temperature: 0.2, maxOutputTokens: 1000 } 
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!r.ok) throw new Error(`Gemini ${r.status}`);
    const d = await r.json();
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
    const m = text?.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// OpenAI
async function callOpenAI(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: 'gpt-4o-mini', 
        messages: [{ role: 'user', content: prompt }], 
        temperature: 0.2, 
        max_tokens: 1000, 
        response_format: { type: "json_object" } 
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    return JSON.parse((await r.json()).choices[0].message.content);
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// Claude
async function callClaude(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: 'claude-3-haiku-20240307', 
        max_tokens: 1000, 
        temperature: 0.2, 
        messages: [{ role: 'user', content: prompt }] 
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!r.ok) throw new Error(`Claude ${r.status}`);
    const text = (await r.json()).content[0].text;
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// Extract key features - aggressive compression
function extractFeatures(analysis) {
  const keywords = [];
  
  // Extract key descriptors only
  const patterns = [
    { rx: /forehead[:\s]*([^.]{10,60})/i, label: 'Forehead' },
    { rx: /eyes?[:\s]*([^.]{10,60})/i, label: 'Eyes' },
    { rx: /nose[:\s]*([^.]{10,60})/i, label: 'Nose' },
    { rx: /lips?|mouth[:\s]*([^.]{10,60})/i, label: 'Mouth' },
    { rx: /jaw|chin[:\s]*([^.]{10,60})/i, label: 'Jaw' },
    { rx: /face\s*shape[:\s]*([^.]{10,60})/i, label: 'Face' }
  ];
  
  for (const { rx, label } of patterns) {
    const m = analysis.match(rx);
    if (m && m[1]) {
      keywords.push(`${label}: ${m[1].trim().substring(0, 50)}`);
    }
  }
  
  return keywords.length > 0 ? keywords.join(' | ') : analysis.substring(0, 300);
}
