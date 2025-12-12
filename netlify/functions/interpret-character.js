// netlify/functions/interpret-character.js
// Enhanced v2.0 - Logically consistent traits derived from actual features

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

    const extractedFeatures = extractKeyFeatures(llavaAnalysis);

    const langConfig = {
      en: { 
        name: 'English', 
        summaryLabel: 'Character Summary',
        positiveLabel: 'Positive Traits',
        negativeLabel: 'Traits to Watch',
        personalityLabel: 'Personality Type',
        disclaimer: 'Based on Kitab Firasat. Classical physiognomy for self-reflection, not absolute judgment.' 
      },
      my: { 
        name: 'Bahasa Melayu', 
        summaryLabel: 'Ringkasan Karakter',
        positiveLabel: 'Sifat Positif',
        negativeLabel: 'Sifat Perlu Diperhatikan',
        personalityLabel: 'Jenis Personaliti',
        disclaimer: 'Berdasarkan Kitab Firasat. Ilmu firasat klasik untuk muhasabah diri, bukan penghakiman mutlak.' 
      },
      id: { 
        name: 'Bahasa Indonesia', 
        summaryLabel: 'Ringkasan Karakter',
        positiveLabel: 'Sifat Positif',
        negativeLabel: 'Sifat yang Perlu Diperhatikan',
        personalityLabel: 'Tipe Kepribadian',
        disclaimer: 'Berdasarkan Kitab Firasat. Ilmu firasat klasik untuk refleksi diri, bukan penilaian mutlak.' 
      }
    };
    const lang = langConfig[language] || langConfig.my;

    // ENHANCED PROMPT with logical consistency rules
    const prompt = buildEnhancedPrompt(extractedFeatures, lang);

    let interpretation = null;
    let usage = null;
    let provider = null;

    for (const currentProvider of orderedProviders) {
      if (interpretation) break;
      
      try {
        console.log(`Trying ${currentProvider}...`);
        
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
        
        if (interpretation) console.log(`${currentProvider} SUCCESS`);
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

// Build enhanced prompt with logical consistency
function buildEnhancedPrompt(features, lang) {
  return `Anda pakar Kitab Firasat (الفراسة) oleh Imam Fakhruddin ar-Razi.

═══════════════════════════════════════════════════════════════════════════════
RUJUKAN KITAB FIRASAT - GUNAKAN INI UNTUK TAFSIRAN
═══════════════════════════════════════════════════════════════════════════════

DAHI (الجبهة):
- Lebar & tinggi → Bijaksana, pemikir mendalam (seperti gajah)
- Sempit → Tergesa-gesa, kurang sabar
- Berkerut mendatar → Banyak pengalaman hidup
- Licin rata → Tenang, kurang tekanan

MATA (العينين):
- Besar bulat → Peramah tetapi mudah terpengaruh (kerbau)
- Kecil tajam → Teliti, berhati-hati (elang)
- Cekung dalam → Pemikir, introvert (harimau)
- Bercahaya → Cerdas, bertenaga

HIDUNG (الأنف):
- Mancung tinggi → Bermaruah, bangga (elang)
- Lebar rata → Pemurah, mudah mesra
- Hujung bulat → Baik hati, penyayang
- Lubang besar → Bertenaga, kadang impulsif

MULUT & BIBIR (الفم):
- Bibir tebal → Penyayang, setia tetapi degil
- Bibir nipis → Tegas, berdisiplin
- Mulut lebar → Peramah, suka bersosial
- Mulut kecil → Berhati-hati dalam percakapan

WAJAH (الوجه):
- Bulat → Mesra, optimis tetapi kadang naif
- Oval → Seimbang, diplomatis
- Persegi → Tegas, praktikal
- Panjang → Sensitif, artistik

RAHANG & DAGU (الذقن):
- Rahang lebar kuat → Tekad kuat, berkeyakinan
- Dagu tajam → Tegas dalam keputusan
- Dagu bulat → Lembut, diplomatis
- Rahang sempit → Fleksibel, mudah menyesuaikan

TELINGA (الأذن):
- Besar → Bijaksana, pendengar baik
- Kecil → Fokus, tidak mudah terganggu
- Terkeluar → Kreatif, berfikiran terbuka
- Rapat ke kepala → Berdisiplin, konservatif

═══════════════════════════════════════════════════════════════════════════════
ANALISIS WAJAH DARI LLAVA (BACA DENGAN TELITI!)
═══════════════════════════════════════════════════════════════════════════════
${features}

═══════════════════════════════════════════════════════════════════════════════
PERATURAN KRITIKAL - WAJIB IKUT!
═══════════════════════════════════════════════════════════════════════════════

1. SIFAT POSITIF mesti DATANG DARI ciri wajah sebenar:
   - Contoh: Jika dahi lebar → "Kebijaksanaan (dahi lebar menunjukkan...)"
   - JANGAN buat sifat generik tanpa kaitan dengan wajah!

2. SIFAT NEGATIF adalah KESAN SAMPINGAN sifat positif (BUKAN bertentangan!):
   ✅ BETUL: Positif "Tegas" → Negatif "Kadang terlalu keras"
   ✅ BETUL: Positif "Penyayang" → Negatif "Mudah tersentuh hati"
   ❌ SALAH: Positif "Tenang" → Negatif "Pemarah" (BERCANGGAH!)
   ❌ SALAH: Positif "Fokus" → Negatif "Tidak fokus" (BERCANGGAH!)

3. SETIAP sifat mesti ada BUKTI dari ciri wajah:
   - Nyatakan ciri mana yang menunjukkan sifat tersebut
   - Gunakan perbandingan haiwan dari Kitab jika sesuai

4. JANGAN ULANG sifat generik seperti:
   - "Keseimbangan emosi" (terlalu umum)
   - "Kebijaksanaan" (tanpa bukti spesifik)
   - "Fokus" (tanpa kaitan ciri)

═══════════════════════════════════════════════════════════════════════════════
OUTPUT JSON - IKUT FORMAT INI DENGAN TEPAT
═══════════════════════════════════════════════════════════════════════════════

{
  "translated_features": {
    "dahi": {"description": "[Tafsiran berdasarkan ciri sebenar + perbandingan haiwan]", "arabic": "الجبهة"},
    "mata": {"description": "[Tafsiran spesifik]", "arabic": "العينين"},
    "hidung": {"description": "[Tafsiran spesifik]", "arabic": "الأنف"},
    "mulut_bibir": {"description": "[Tafsiran spesifik]", "arabic": "الفم"},
    "rahang_dagu": {"description": "[Tafsiran spesifik]", "arabic": "الذقن"},
    "bentuk_wajah": {"description": "[Tafsiran spesifik]", "arabic": "الوجه"}
  },
  "character_interpretation": {
    "positive_traits": [
      "[Sifat 1] (dari [ciri wajah]) - [penjelasan dengan bukti]",
      "[Sifat 2] (dari [ciri wajah]) - [penjelasan dengan bukti]",
      "[Sifat 3] (dari [ciri wajah]) - [penjelasan dengan bukti]",
      "[Sifat 4] (dari [ciri wajah]) - [penjelasan dengan bukti]"
    ],
    "negative_traits": [
      "[Kesan sampingan sifat positif 1] - [nasihat membina]",
      "[Kesan sampingan sifat positif 2] - [nasihat membina]",
      "[Kesan sampingan sifat positif 3] - [nasihat membina]"
    ],
    "personality_type": "[Mizaj utama] - [penjelasan berdasarkan gabungan ciri]",
    "overall_summary": "[5-6 ayat: Gambaran menyeluruh yang UNIK untuk wajah ini. Nyatakan kekuatan utama, cabaran spesifik, dan nasihat praktikal.]"
  },
  "kitab_references": [
    {"feature": "[Ciri paling ketara]", "quote": "[Petikan relevan dari Kitab]", "arabic_term": "[istilah Arab]"}
  ],
  "disclaimer": "${lang.disclaimer}"
}

INGAT: Setiap orang UNIK. Tafsiran mesti SPESIFIK kepada ciri wajah yang dianalisis, bukan generik!
Bahasa output: ${lang.name}`;
}


// Claude API
async function callClaude(apiKey, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 3000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) return null;
  
  const data = await response.json();
  const content = data.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) return null;
  
  return {
    interpretation: JSON.parse(jsonMatch[0]),
    usage: { input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens }
  };
}

// Gemini API
async function callGemini(apiKey, prompt) {
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
        maxOutputTokens: 3000
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errorText.substring(0, 200)}`);
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
}

// OpenAI API
async function callOpenAI(apiKey, prompt) {
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
      max_tokens: 3000,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) return null;
  
  const data = await response.json();
  return {
    interpretation: JSON.parse(data.choices[0].message.content),
    usage: data.usage
  };
}

// Extract key features
function extractKeyFeatures(analysis) {
  if (analysis.length < 800) return analysis;
  
  const features = [];
  const patterns = [
    /\d+\.\s*(FOREHEAD|DAHI)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(EYEBROWS?|KENING)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(EYES?|MATA)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(NOSE|HIDUNG)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(LIPS?|MOUTH|MULUT|BIBIR)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(FACE\s*SHAPE|WAJAH|BENTUK)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(JAW|CHIN|RAHANG|DAGU)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(CHEEK|PIPI)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(EARS?|TELINGA)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(HAIRLINE|RAMBUT)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi
  ];
  
  for (const pattern of patterns) {
    const match = analysis.match(pattern);
    if (match && match[0]) {
      features.push(match[0].trim().substring(0, 300));
    }
  }
  
  return features.length > 0 ? features.join('\n\n') : analysis.substring(0, 2000);
}
