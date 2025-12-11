// netlify/functions/interpret-character.js
// Multi-provider: Claude, Gemini, OpenAI - with load distribution

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

    // Rotate primary provider based on timestamp (distributes load)
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
        disclaimer: 'Based on Kitab Firasat by Imam Fakhruddin ar-Razi (1150-1210 CE). Classical Islamic physiognomy for self-understanding, not fortune-telling.' 
      },
      my: { 
        name: 'Bahasa Melayu', 
        summaryLabel: 'Ringkasan Karakter',
        positiveLabel: 'Sifat Positif',
        negativeLabel: 'Sifat Perlu Diperhatikan',
        personalityLabel: 'Jenis Personaliti',
        disclaimer: 'Berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi (1150-1210 M). Ilmu firasat Islam klasik untuk memahami diri, bukan ramalan.' 
      },
      id: { 
        name: 'Bahasa Indonesia', 
        summaryLabel: 'Ringkasan Karakter',
        positiveLabel: 'Sifat Positif',
        negativeLabel: 'Sifat yang Perlu Diperhatikan',
        personalityLabel: 'Tipe Kepribadian',
        disclaimer: 'Berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi (1150-1210 M). Ilmu firasat Islam klasik untuk memahami diri, bukan ramalan.' 
      }
    };
    const lang = langConfig[language] || langConfig.my;

    const kitabRef = `KITAB FIRASAT (الفراسة) - Imam Fakhruddin ar-Razi:

DAHI (الجبهة): Besar→Pemalas,pemarah | Kecil→Bodoh | Berkerut→Congkak | Rata→Pengacau
MATA (العينين): Besar→Pemalas(kerbau) | Cekung→Jahat(kera) | Agak-cekung→Jiwa-baik(harimau) | Bersinar→Cerdas
HIDUNG (الأنف): Lancip→Permusuhan(anjing) | Mancung→Mulia(elang) | Tebal→Kurang-paham | Lubang-besar→Pemarah
MULUT (الفم): Tebal→Keras-kepala | Tipis→Jiwa-baik | Lebar→Syahwat-besar
WAJAH (الوجه): Bulat→Bodoh(kera) | Oval→Seimbang | Kurus→Teliti
TELINGA (الأذن): Besar→Panjang-umur | Kecil→Cerdas
MIZAJ: Sanguinis(دموي)=Berani,cerdas | Flegmatis(بلغمي)=Tenang,sabar | Melankolis(سوداوي)=Sensitif | Koleris(صفراوي)=Tabah,tegas`;

    const prompt = `Anda pakar Kitab Firasat. Analisis ciri wajah dan berikan tafsiran LENGKAP dalam ${lang.name}.

RUJUKAN: ${kitabRef}

ANALISIS: ${extractedFeatures}

OUTPUT JSON (WAJIB ikut format ini dengan tepat):
{
  "translated_features": {
    "dahi": {"description": "[2-3 ayat tafsiran dengan perbandingan haiwan]", "arabic": "الجبهة"},
    "mata": {"description": "[2-3 ayat]", "arabic": "العينين"},
    "hidung": {"description": "[2-3 ayat]", "arabic": "الأنف"},
    "mulut_bibir": {"description": "[2-3 ayat]", "arabic": "الفم"},
    "bentuk_wajah": {"description": "[2-3 ayat]", "arabic": "الوجه"}
  },
  "character_interpretation": {
    "positive_traits": ["Sifat 1 - penjelasan kekuatan", "Sifat 2 - penjelasan", "Sifat 3 - penjelasan", "Sifat 4 - penjelasan", "Sifat 5 - penjelasan"],
    "negative_traits": ["Sifat 1 - nasihat membina", "Sifat 2 - nasihat", "Sifat 3 - nasihat"],
    "personality_type": "[Mizaj] (Arab) - [2 ayat penjelasan temperamen]",
    "overall_summary": "[WAJIB 6-8 AYAT PENUH: Gambaran karakter menyeluruh - kekuatan, cabaran, cara bergaul, potensi, hikmah Kitab. Jadikan bermakna!]"
  },
  "kitab_references": [
    {"feature": "Dahi", "quote": "[Petikan dari Kitab]", "arabic_term": "الجبهة"},
    {"feature": "Mata", "quote": "[Petikan]", "arabic_term": "العينين"},
    {"feature": "Hidung", "quote": "[Petikan]", "arabic_term": "الأنف"}
  ],
  "disclaimer": "${lang.disclaimer}"
}

PENTING: Gunakan perbandingan haiwan (harimau, kerbau, elang, kera). Summary MESTI 6-8 ayat!`;

    let interpretation = null;
    let usage = null;
    let provider = null;
    let geminiError = null; // Debug

    // Try providers in rotation order
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
          if (result) { 
            interpretation = result.interpretation; 
            usage = result.usage; 
            provider = 'gemini'; 
          } else {
            geminiError = result?.error || 'returned null';
          }
        }
        else if (currentProvider === 'openai') {
          const result = await callOpenAI(OPENAI_API_KEY, prompt);
          if (result) { interpretation = result.interpretation; usage = result.usage; provider = 'openai'; }
        }
        
        if (interpretation) console.log(`${currentProvider} SUCCESS`);
      } catch (err) {
        console.log(`${currentProvider} failed:`, err.message);
        if (currentProvider === 'gemini') geminiError = err.message;
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
        provider,
        debug: { availableProviders, orderedProviders, geminiError }
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error', message: error.message }) };
  }
};


// Claude API (Anthropic)
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
      max_tokens: 2500,
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

// Gemini API (Google)
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
        temperature: 0.7,
        maxOutputTokens: 2500
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log('Gemini API error:', response.status, errorText);
    throw new Error(`Gemini ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const data = await response.json();
  console.log('Gemini response received');
  
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!content) {
    console.log('Gemini no content in response');
    throw new Error('Gemini: No content in response');
  }
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.log('Gemini no JSON found in response');
    throw new Error('Gemini: No JSON in response');
  }
  
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
      temperature: 0.7,
      max_tokens: 2500,
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

// Extract key features from verbose LLaVA analysis
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
    /\d+\.\s*(EARS?|TELINGA)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi
  ];
  
  for (const pattern of patterns) {
    const match = analysis.match(pattern);
    if (match && match[0]) {
      features.push(match[0].trim().substring(0, 200));
    }
  }
  
  return features.length > 0 ? features.join('\n\n') : analysis.substring(0, 1500);
}
