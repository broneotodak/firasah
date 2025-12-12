// netlify/functions/interpret-character.js
// v2.1 - Optimized prompt for faster response, no contradictory traits

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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    let { llavaAnalysis, language = 'my' } = JSON.parse(event.body);
    
    if (!llavaAnalysis) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing llavaAnalysis' }) };
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    const availableProviders = [];
    if (ANTHROPIC_API_KEY) availableProviders.push('claude');
    if (GEMINI_API_KEY) availableProviders.push('gemini');
    if (OPENAI_API_KEY) availableProviders.push('openai');
    
    if (availableProviders.length === 0) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'No API keys configured' }) };
    }

    const rotationIndex = Math.floor(Date.now() / 1000) % availableProviders.length;
    const orderedProviders = [
      ...availableProviders.slice(rotationIndex),
      ...availableProviders.slice(0, rotationIndex)
    ];
    console.log('Provider order:', orderedProviders.join(' → '));

    // Shorten features to reduce token count
    const extractedFeatures = extractKeyFeatures(llavaAnalysis);

    const langConfig = {
      en: { name: 'English', disclaimer: 'Based on Kitab Firasat. For self-reflection only.' },
      my: { name: 'Bahasa Melayu', disclaimer: 'Berdasarkan Kitab Firasat. Untuk muhasabah diri sahaja.' },
      id: { name: 'Bahasa Indonesia', disclaimer: 'Berdasarkan Kitab Firasat. Untuk refleksi diri saja.' }
    };
    const lang = langConfig[language] || langConfig.my;

    // SHORTER prompt - key rules only
    const prompt = `Pakar Kitab Firasat. Analisis wajah ini dalam ${lang.name}.

CIRI WAJAH:
${extractedFeatures}

PERATURAN PENTING:
1. Sifat positif MESTI berdasarkan ciri wajah sebenar
2. Sifat negatif = KESAN SAMPINGAN positif (BUKAN bertentangan!)
   ✓ Betul: Tegas → Kadang keras kepala
   ✗ Salah: Tenang → Pemarah (bercanggah!)
3. Setiap sifat nyatakan ciri wajah yang berkaitan

KITAB FIRASAT RINGKAS:
- Dahi lebar=bijak, sempit=tergesa
- Mata besar=peramah, kecil=teliti
- Hidung mancung=bermaruah, lebar=pemurah
- Bibir tebal=setia/degil, nipis=tegas
- Rahang kuat=berkeyakinan, lembut=diplomatis

OUTPUT JSON:
{
  "translated_features": {
    "dahi": {"description": "[tafsiran ringkas]", "arabic": "الجبهة"},
    "mata": {"description": "[tafsiran]", "arabic": "العينين"},
    "hidung": {"description": "[tafsiran]", "arabic": "الأنف"},
    "mulut_bibir": {"description": "[tafsiran]", "arabic": "الفم"},
    "rahang_dagu": {"description": "[tafsiran]", "arabic": "الذقن"},
    "bentuk_wajah": {"description": "[tafsiran]", "arabic": "الوجه"}
  },
  "character_interpretation": {
    "positive_traits": [
      "[Sifat] (dari [ciri]) - penjelasan",
      "[Sifat] (dari [ciri]) - penjelasan",
      "[Sifat] (dari [ciri]) - penjelasan",
      "[Sifat] (dari [ciri]) - penjelasan"
    ],
    "negative_traits": [
      "[Kesan sampingan sifat 1] - nasihat",
      "[Kesan sampingan sifat 2] - nasihat",
      "[Kesan sampingan sifat 3] - nasihat"
    ],
    "personality_type": "[Jenis] - penjelasan ringkas",
    "overall_summary": "[4-5 ayat gambaran unik individu ini]"
  },
  "kitab_references": [{"feature": "[ciri]", "quote": "[petikan]", "arabic_term": "[arab]"}],
  "disclaimer": "${lang.disclaimer}"
}`;

    let interpretation = null;
    let usage = null;
    let provider = null;

    for (const currentProvider of orderedProviders) {
      if (interpretation) break;
      
      try {
        console.log(`Trying ${currentProvider}...`);
        const startTime = Date.now();
        
        if (currentProvider === 'claude') {
          const result = await callClaude(ANTHROPIC_API_KEY, prompt);
          if (result) { interpretation = result.interpretation; usage = result.usage; provider = 'claude'; }
        } 
        else if (currentProvider === 'gemini') {
          const result = await callGemini(GEMINI_API_KEY, prompt);
          if (result) { interpretation = result.interpretation; usage = result.usage; provider = 'gemini'; }
        }
        else if (currentProvider === 'openai') {
          const result = await callOpenAI(OPENAI_API_KEY, prompt);
          if (result) { interpretation = result.interpretation; usage = result.usage; provider = 'openai'; }
        }
        
        if (interpretation) {
          console.log(`${currentProvider} SUCCESS in ${Date.now() - startTime}ms`);
        }
      } catch (err) {
        console.log(`${currentProvider} failed:`, err.message);
      }
    }

    if (!interpretation) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'All providers failed' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        interpretation,
        source: { title: "Kitab Firasat", author: "Imam Fakhruddin ar-Razi", period: "1150-1210 M", arabic: "الفراسة" },
        language,
        langConfig: lang,
        usage,
        provider
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error', message: error.message }) };
  }
};

// Claude API - with timeout
async function callClaude(apiKey, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    
    const data = await response.json();
    const content = data.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) return null;
    
    return {
      interpretation: JSON.parse(jsonMatch[0]),
      usage: { input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens }
    };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// Gemini API - with timeout
async function callGemini(apiKey, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) throw new Error('Gemini: No content');
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Gemini: No JSON');
    
    return {
      interpretation: JSON.parse(jsonMatch[0]),
      usage: { 
        input_tokens: data.usageMetadata?.promptTokenCount, 
        output_tokens: data.usageMetadata?.candidatesTokenCount 
      }
    };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// OpenAI API - with timeout
async function callOpenAI(apiKey, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      interpretation: JSON.parse(data.choices[0].message.content),
      usage: data.usage
    };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// Extract key features - more aggressive shortening
function extractKeyFeatures(analysis) {
  // Limit to 1200 chars to keep prompt short
  const features = [];
  const patterns = [
    /\d+\.\s*(FOREHEAD|DAHI)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(EYES?|MATA)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(NOSE|HIDUNG)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(LIPS?|MOUTH|MULUT)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(JAW|CHIN|RAHANG|DAGU)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(FACE\s*SHAPE|WAJAH)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi
  ];
  
  for (const pattern of patterns) {
    const match = analysis.match(pattern);
    if (match && match[0]) {
      // Only take first 150 chars per feature
      features.push(match[0].trim().substring(0, 150));
    }
  }
  
  return features.length > 0 ? features.join('\n') : analysis.substring(0, 1000);
}
