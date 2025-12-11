// netlify/functions/interpret-character.js
// Uses OpenAI to translate LLaVA analysis and interpret character traits from Kitab Firasat

const kitabFirasatRules = require('../../kitab-firasat-rules.json');

exports.handler = async (event, context) => {
  // Handle CORS
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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { llavaAnalysis } = JSON.parse(event.body);
    
    if (!llavaAnalysis) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing llavaAnalysis in request body' })
      };
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    // Build the system prompt with Kitab Firasat knowledge
    const systemPrompt = `Anda adalah pakar dalam ilmu Firasat berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi (1150-1210 M).

TUGAS ANDA:
1. Terima analisis ciri-ciri wajah dalam Bahasa Inggeris
2. Terjemahkan ke Bahasa Melayu formal
3. Berikan tafsiran karakter berdasarkan Kitab Firasat

PANDUAN TAFSIRAN:
${JSON.stringify(kitabFirasatRules.features, null, 2)}

PRINSIP UMUM:
${JSON.stringify(kitabFirasatRules.general_principles, null, 2)}

PERINGATAN:
${JSON.stringify(kitabFirasatRules.warnings, null, 2)}

FORMAT OUTPUT (JSON):
{
  "translated_features": {
    "dahi": { "description": "...", "original": "..." },
    "kening": { "description": "...", "original": "..." },
    "mata": { "description": "...", "original": "..." },
    "hidung": { "description": "...", "original": "..." },
    "mulut_bibir": { "description": "...", "original": "..." },
    "bentuk_wajah": { "description": "...", "original": "..." },
    "rahang_dagu": { "description": "...", "original": "..." },
    "pipi": { "description": "...", "original": "..." },
    "telinga": { "description": "...", "original": "..." },
    "garis_rambut": { "description": "...", "original": "..." }
  },
  "character_interpretation": {
    "positive_traits": ["sifat positif 1", "sifat positif 2"],
    "negative_traits": ["sifat negatif 1", "sifat negatif 2"],
    "personality_type": "sanguinis/flegmatis/melankolis/koleris atau gabungan",
    "overall_summary": "Ringkasan keseluruhan karakter dalam 2-3 ayat"
  },
  "kitab_references": [
    {
      "feature": "nama ciri",
      "quote": "Petikan atau rujukan dari Kitab Firasat",
      "source": "Pasal/Bahagian dalam kitab"
    }
  ],
  "disclaimer": "Peringatan bahawa ini adalah tafsiran berdasarkan ilmu klasik dan bukan ramalan mutlak"
}

PENTING:
- Gunakan Bahasa Melayu formal (bukan bahasa pasar)
- Seimbangkan sifat positif dan negatif
- Sertakan rujukan dari Kitab Firasat
- Berikan peringatan bahawa ini bukan ramalan nasib`;


    const userPrompt = `Analisis ciri-ciri wajah berikut dari LLaVA dan berikan tafsiran karakter berdasarkan Kitab Firasat:

${llavaAnalysis}

Sila berikan output dalam format JSON yang ditetapkan.`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: 'OpenAI API error',
          details: errorData 
        })
      };
    }

    const data = await response.json();
    const interpretation = JSON.parse(data.choices[0].message.content);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        interpretation,
        source: kitabFirasatRules.source,
        usage: data.usage
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
