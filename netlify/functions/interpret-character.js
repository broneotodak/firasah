// netlify/functions/interpret-character.js
// Uses OpenAI to translate LLaVA analysis and interpret character traits from Kitab Firasat

const kitabFirasatRules = require('../../kitab-firasat-rules.json');

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
    const { llavaAnalysis, language = 'my' } = JSON.parse(event.body);
    
    if (!llavaAnalysis) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing llavaAnalysis' }) };
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'OpenAI API key not configured' }) };
    }

    // Language configurations
    const langConfig = {
      en: {
        name: 'English',
        summaryLabel: 'Character Summary',
        positiveLabel: 'Positive Traits',
        negativeLabel: 'Traits to Watch',
        personalityLabel: 'Personality Type',
        disclaimerText: 'This interpretation is based on classical Islamic physiognomy (Ilmu Firasat) from Kitab Firasat by Imam Fakhruddin ar-Razi. It is not fortune-telling or absolute prediction. Character can change through effort, environment, and divine will.'
      },
      my: {
        name: 'Bahasa Melayu',
        summaryLabel: 'Ringkasan Karakter',
        positiveLabel: 'Sifat Positif',
        negativeLabel: 'Sifat Perlu Diperhatikan',
        personalityLabel: 'Jenis Kepribadian',
        disclaimerText: 'Tafsiran ini berdasarkan ilmu Firasat klasik Islam daripada Kitab Firasat karya Imam Fakhruddin ar-Razi. Ini bukan ramalan nasib atau takdir mutlak. Karakter seseorang boleh berubah melalui usaha, persekitaran, dan kehendak Ilahi.'
      },
      id: {
        name: 'Bahasa Indonesia',
        summaryLabel: 'Ringkasan Karakter',
        positiveLabel: 'Sifat Positif',
        negativeLabel: 'Sifat yang Perlu Diperhatikan',
        personalityLabel: 'Tipe Kepribadian',
        disclaimerText: 'Penafsiran ini berdasarkan ilmu Firasat klasik Islam dari Kitab Firasat karya Imam Fakhruddin ar-Razi. Ini bukan ramalan nasib atau takdir mutlak. Karakter seseorang dapat berubah melalui usaha, lingkungan, dan kehendak Ilahi.'
      }
    };

    const lang = langConfig[language] || langConfig.my;

    // Build detailed system prompt
    const systemPrompt = `Anda adalah pakar dalam ilmu Firasat berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi (1150-1210 M).

BAHASA OUTPUT: ${lang.name}

TUGAS ANDA:
1. Analisis ciri-ciri wajah yang diberikan
2. Berikan tafsiran TERPERINCI berdasarkan Kitab Firasat
3. Tulis dalam ${lang.name} yang formal dan mudah difahami

PANDUAN KITAB FIRASAT:
${JSON.stringify(kitabFirasatRules.features, null, 2)}

PRINSIP UMUM FIRASAT:
${JSON.stringify(kitabFirasatRules.general_principles, null, 2)}

JENIS KEPRIBADIAN (Empat Mizaj):
${JSON.stringify(kitabFirasatRules.personality_types, null, 2)}

PERINGATAN PENTING:
${JSON.stringify(kitabFirasatRules.warnings, null, 2)}

ARAHAN PENTING - BUAT TAFSIRAN YANG PANJANG DAN TERPERINCI:

1. RINGKASAN KARAKTER (overall_summary):
   - Tulis MINIMUM 4-5 ayat yang lengkap
   - Mulakan dengan gambaran umum kepribadian
   - Huraikan kekuatan utama individu
   - Nyatakan bagaimana ciri-ciri fizikal mencerminkan karakter dalaman
   - Akhiri dengan potensi dan nasihat berdasarkan Kitab Firasat
   - Gunakan bahasa yang sopan dan membina

2. SIFAT POSITIF (positive_traits):
   - Senaraikan MINIMUM 5 sifat positif
   - Setiap sifat dengan huraian ringkas

3. SIFAT PERLU DIPERHATIKAN (negative_traits):
   - Senaraikan 3-4 sifat yang perlu diperbaiki
   - Gunakan bahasa yang lembut dan membina (bukan menghukum)

4. TAFSIRAN SETIAP CIRI (translated_features):
   - Untuk SETIAP ciri wajah, tulis 2-3 ayat tafsiran
   - Sertakan rujukan kepada Kitab Firasat
   - Jelaskan makna dan implikasinya

5. RUJUKAN KITAB (kitab_references):
   - Sertakan MINIMUM 3 petikan atau rujukan
   - Nyatakan pasal/bahagian dalam Kitab Firasat

FORMAT OUTPUT (JSON):
{
  "translated_features": {
    "dahi": { "description": "[Tafsiran 2-3 ayat dalam ${lang.name}]", "original": "[English from LLaVA]" },
    "kening": { "description": "[Tafsiran 2-3 ayat]", "original": "[English]" },
    "mata": { "description": "[Tafsiran 2-3 ayat]", "original": "[English]" },
    "hidung": { "description": "[Tafsiran 2-3 ayat]", "original": "[English]" },
    "mulut_bibir": { "description": "[Tafsiran 2-3 ayat]", "original": "[English]" },
    "bentuk_wajah": { "description": "[Tafsiran 2-3 ayat]", "original": "[English]" },
    "rahang_dagu": { "description": "[Tafsiran 2-3 ayat]", "original": "[English]" },
    "pipi": { "description": "[Tafsiran 2-3 ayat]", "original": "[English]" },
    "telinga": { "description": "[Tafsiran 2-3 ayat]", "original": "[English]" },
    "garis_rambut": { "description": "[Tafsiran 2-3 ayat]", "original": "[English]" }
  },
  "character_interpretation": {
    "positive_traits": ["[Sifat 1 dengan huraian]", "[Sifat 2 dengan huraian]", "[minimum 5 sifat]"],
    "negative_traits": ["[Sifat 1 - dengan nasihat]", "[Sifat 2 - dengan nasihat]"],
    "personality_type": "[Sanguinis/Flegmatis/Melankolis/Koleris atau gabungan dengan penjelasan]",
    "overall_summary": "[TULIS MINIMUM 4-5 AYAT YANG LENGKAP DAN TERPERINCI tentang keseluruhan karakter]"
  },
  "kitab_references": [
    { "feature": "[Nama ciri]", "quote": "[Petikan dari Kitab Firasat]", "source": "[Pasal/Bahagian]" },
    { "feature": "[Nama ciri]", "quote": "[Petikan]", "source": "[Pasal]" },
    { "feature": "[Nama ciri]", "quote": "[Petikan]", "source": "[Pasal]" }
  ],
  "disclaimer": "${lang.disclaimerText}"
}`;


    const userPrompt = `Analisis ciri-ciri wajah berikut dan berikan tafsiran TERPERINCI berdasarkan Kitab Firasat:

${llavaAnalysis}

INGAT:
- Tulis dalam ${lang.name}
- Ringkasan karakter MESTI 4-5 ayat minimum
- Setiap tafsiran ciri 2-3 ayat
- Sertakan minimum 3 rujukan Kitab Firasat
- Output dalam format JSON yang ditetapkan`;

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
        max_tokens: 3000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'OpenAI API error', details: errorData })
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
        language: language,
        langConfig: lang,
        usage: data.usage
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
