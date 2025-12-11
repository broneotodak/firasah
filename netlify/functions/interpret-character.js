// netlify/functions/interpret-character.js
// Optimized for speed + comprehensive output

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

    const langConfig = {
      en: { name: 'English', disclaimer: 'Based on Kitab Firasat by Imam Fakhruddin ar-Razi (1150-1210 CE). Classical Islamic physiognomy, not fortune-telling.' },
      my: { name: 'Bahasa Melayu', disclaimer: 'Berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi (1150-1210 M). Ilmu firasat Islam klasik, bukan ramalan nasib.' },
      id: { name: 'Bahasa Indonesia', disclaimer: 'Berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi (1150-1210 M). Ilmu firasat Islam klasik, bukan ramalan nasib.' }
    };
    const lang = langConfig[language] || langConfig.my;

    // Condensed Kitab Firasat Reference (accurate but shorter)
    const kitabRef = `KITAB FIRASAT (الفراسة) - Imam Fakhruddin ar-Razi:
DAHI(الجبهة): besar=pemalas,pemarah|kecil=bodoh|berkerut=congkak|rata=pengacau
KENING(الحواجب): lebat=berduka|miring=congkak,dungu
MATA(العينين): besar=pemalas(kerbau)|melotot=bodoh(keledai)|cekung=jahat(kera)|agak-cekung=jiwa-baik(harimau)|bersinar=cerdas|bergerak-cepat=penipu
HIDUNG(الأنف): lancip=permusuhan(anjing)|tebal=kurang-paham(kerbau)|mancung=jiwa-mulia(elang)|lubang-besar=pemarah
MULUT(الفم): lebar=syahwat(harimau)|tebal=keras-kepala|tipis=jiwa-baik
WAJAH(الوجه): gemuk=pemalas(kerbau)|kurus=teliti|bundar=bodoh(kera)|oval=seimbang
TELINGA(الأذن): besar=panjang-umur(keledai)|kecil=cerdas
LEHER(العنق): tebal=kuat|tipis=lemah|seimbang=jiwa-baik(harimau)|pendek=penipu(serigala)
MIZAJ: Sanguinis(دموي)=cerdas,berani|Flegmatis(بلغمي)=lambat,penakut|Melankolis(سوداوي)=mengantuk|Koleris(صفراوي)=tabah,sabar`;

    const systemPrompt = `You are a Kitab Firasat expert. Use ONLY this reference with Arabic terms:
${kitabRef}

Write in ${lang.name}. Be COMPREHENSIVE and engaging - people love detailed readings about themselves!

OUTPUT (JSON):
{
  "translated_features": {
    "dahi": {"description": "[2-3 sentences with Kitab interpretation]", "arabic": "الجبهة"},
    "kening": {"description": "[2-3 sentences]", "arabic": "الحواجب"},
    "mata": {"description": "[2-3 sentences]", "arabic": "العينين"},
    "hidung": {"description": "[2-3 sentences]", "arabic": "الأنف"},
    "mulut_bibir": {"description": "[2-3 sentences]", "arabic": "الفم"},
    "bentuk_wajah": {"description": "[2-3 sentences]", "arabic": "الوجه"},
    "rahang_dagu": {"description": "[2-3 sentences]", "arabic": "الذقن"},
    "telinga": {"description": "[2-3 sentences]", "arabic": "الأذن"}
  },
  "character_interpretation": {
    "positive_traits": ["5-6 traits with explanations"],
    "negative_traits": ["3-4 traits with gentle advice"],
    "personality_type": "[Mizaj] (Arabic) - detailed explanation",
    "overall_summary": "[WRITE 6-8 FULL SENTENCES: Complete character portrait - personality, strengths, challenges, social nature, potential, and Kitab wisdom. Make it personal and meaningful!]"
  },
  "kitab_references": [{"feature":"name","quote":"Kitab quote","arabic_term":"Arabic"}],
  "disclaimer": "${lang.disclaimer}"
}`;

    const userPrompt = `Analyze with Kitab Firasat. Give RICH, DETAILED interpretation in ${lang.name}:

${llavaAnalysis}

IMPORTANT: Write 6-8 sentences for overall_summary. Include animal comparisons (harimau, kerbau, etc). Make it engaging!`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.7,
        max_tokens: 2500,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      return { statusCode: response.status, headers, body: JSON.stringify({ error: 'OpenAI API error', details: errorData }) };
    }

    const data = await response.json();
    const interpretation = JSON.parse(data.choices[0].message.content);

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
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error', message: error.message }) };
  }
};
