// netlify/functions/interpret-character.js
// Optimized for long LLaVA inputs - truncates to key features only

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

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'OpenAI API key not configured' }) };
    }

    // IMPORTANT: Truncate LLaVA analysis to reduce tokens
    // Extract only the key numbered sections (1. FOREHEAD, 2. EYES, etc.)
    const extractedFeatures = extractKeyFeatures(llavaAnalysis);
    console.log('Original length:', llavaAnalysis.length, '-> Extracted:', extractedFeatures.length);

    const langConfig = {
      en: { name: 'English', disclaimer: 'Based on Kitab Firasat by Imam ar-Razi. Classical Islamic physiognomy for self-understanding.' },
      my: { name: 'Bahasa Melayu', disclaimer: 'Berdasarkan Kitab Firasat karya Imam ar-Razi. Ilmu firasat Islam klasik untuk memahami diri.' },
      id: { name: 'Bahasa Indonesia', disclaimer: 'Berdasarkan Kitab Firasat karya Imam ar-Razi. Ilmu firasat klasik untuk memahami diri.' }
    };
    const lang = langConfig[language] || langConfig.my;

    const kitabRef = `KITAB FIRASAT - Imam ar-Razi:
DAHI(الجبهة):besar=pemalas|kecil=bodoh|berkerut=congkak
MATA(العينين):besar=pemalas(kerbau)|cekung=jahat(kera)|bersinar=cerdas(harimau)
HIDUNG(الأنف):lancip=permusuhan(anjing)|mancung=mulia(elang)
MULUT(الفم):tebal=keras-kepala|tipis=baik
WAJAH(الوجه):bulat=bodoh(kera)|oval=seimbang|kurus=teliti
MIZAJ:Sanguinis(دموي)=berani|Flegmatis(بلغمي)=tenang|Melankolis(سوداوي)=sensitif|Koleris(صفراوي)=tabah`;

    const systemPrompt = `Pakar Kitab Firasat. Rujukan:
${kitabRef}

Tulis ${lang.name}. JSON output:
{"features":{"dahi":{"d":"[2 ayat]","ar":"الجبهة"},"mata":{"d":"[2 ayat]","ar":"العينين"},"hidung":{"d":"[2 ayat]","ar":"الأنف"},"mulut":{"d":"[2 ayat]","ar":"الفم"},"wajah":{"d":"[2 ayat]","ar":"الوجه"}},"character":{"positif":["5 sifat dgn penjelasan"],"negatif":["3 sifat dgn nasihat"],"mizaj":"[Jenis](Arab) - 2 ayat","summary":"[6-8 AYAT PENUH: karakter, kekuatan, cabaran, potensi, hikmah Kitab]"},"refs":[{"f":"ciri","q":"petikan"}],"disclaimer":"${lang.disclaimer}"}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analisis:\n${extractedFeatures}\n\nSummary 6-8 ayat!` }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      return { statusCode: response.status, headers, body: JSON.stringify({ error: 'OpenAI error', details: errorData }) };
    }

    const data = await response.json();
    const raw = JSON.parse(data.choices[0].message.content);
    
    // Transform to expected format
    const interpretation = {
      translated_features: {},
      character_interpretation: {
        positive_traits: raw.character?.positif || [],
        negative_traits: raw.character?.negatif || [],
        personality_type: raw.character?.mizaj || '',
        overall_summary: raw.character?.summary || ''
      },
      kitab_references: (raw.refs || []).map(r => ({ feature: r.f, quote: r.q, arabic_term: '' })),
      disclaimer: raw.disclaimer || lang.disclaimer
    };
    
    // Map features
    for (const [key, val] of Object.entries(raw.features || {})) {
      const mappedKey = key === 'mulut' ? 'mulut_bibir' : key === 'wajah' ? 'bentuk_wajah' : key;
      interpretation.translated_features[mappedKey] = {
        description: val.d || '',
        arabic: val.ar || ''
      };
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
        usage: data.usage
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error', message: error.message }) };
  }
};

// Extract key features from verbose LLaVA analysis
function extractKeyFeatures(analysis) {
  // If already short, return as-is
  if (analysis.length < 1000) return analysis;
  
  const features = [];
  const patterns = [
    /\d+\.\s*(FOREHEAD|DAHI)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(EYEBROWS?|KENING)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(EYES?|MATA)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(NOSE|HIDUNG)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(LIPS?|MOUTH|MULUT|BIBIR)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(FACE\s*SHAPE|WAJAH|BENTUK)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(JAW|CHIN|RAHANG|DAGU)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(EARS?|TELINGA)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(CHEEK|PIPI)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi,
    /\d+\.\s*(HAIRLINE|RAMBUT)[:\s]*([^0-9]*?)(?=\d+\.|$)/gi
  ];
  
  for (const pattern of patterns) {
    const match = analysis.match(pattern);
    if (match && match[0]) {
      // Take first 150 chars of each feature
      const feature = match[0].trim().substring(0, 150);
      features.push(feature);
    }
  }
  
  if (features.length > 0) {
    return features.join('\n');
  }
  
  // Fallback: just truncate
  return analysis.substring(0, 1500);
}
