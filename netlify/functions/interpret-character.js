// netlify/functions/interpret-character.js
// Optimized for Netlify 10s limit + comprehensive character readings

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
      en: { name: 'English', disclaimer: 'Based on Kitab Firasat by Imam Fakhruddin ar-Razi. Classical Islamic physiognomy for self-understanding.' },
      my: { name: 'Bahasa Melayu', disclaimer: 'Berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi. Ilmu firasat Islam klasik untuk memahami diri.' },
      id: { name: 'Bahasa Indonesia', disclaimer: 'Berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi. Ilmu firasat Islam klasik untuk memahami diri.' }
    };
    const lang = langConfig[language] || langConfig.my;

    const systemPrompt = `Anda pakar Kitab Firasat (Imam ar-Razi). RUJUKAN:
DAHI(الجبهة):besar=pemalas|kecil=bodoh|berkerut=congkak MATA(العينين):besar=pemalas(kerbau)|cekung=jahat(kera)|bersinar=cerdas(harimau) HIDUNG(الأنف):lancip=suka-gaduh(anjing)|mancung=jiwa-mulia(elang) MULUT(الفم):tebal=keras-kepala|tipis=baik WAJAH(الوجه):bulat=bodoh(kera)|oval=seimbang|kurus=teliti MIZAJ:Sanguinis(دموي)=berani|Flegmatis(بلغمي)=tenang|Melankolis(سوداوي)=sensitif|Koleris(صفراوي)=tabah

Tulis dalam ${lang.name}. JSON output:
{"translated_features":{"dahi":{"d":"[1-2 ayat]","ar":"الجبهة"},"mata":{"d":"[1-2 ayat]","ar":"العينين"},"hidung":{"d":"[1-2 ayat]","ar":"الأنف"},"mulut":{"d":"[1-2 ayat]","ar":"الفم"},"wajah":{"d":"[1-2 ayat]","ar":"الوجه"}},"character":{"positif":["5 sifat baik dengan penjelasan ringkas"],"negatif":["3 sifat perlu jaga dengan nasihat"],"mizaj":"[Jenis] - penjelasan lengkap 2 ayat","summary":"[TULIS 6-8 AYAT PENUH tentang keseluruhan karakter - kekuatan, cabaran, cara bergaul, potensi diri, dan nasihat Kitab. Jadikan ia bermakna dan peribadi!]"},"refs":[{"f":"ciri","q":"petikan Kitab"}],"disclaimer":"${lang.disclaimer}"}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analisis ciri wajah ini. Tulis tafsiran LENGKAP & MENARIK:\n${llavaAnalysis}\n\nPENTING: summary mesti 6-8 ayat penuh!` }
        ],
        temperature: 0.7,
        max_tokens: 1800,
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
    const featureMap = { dahi: 'الجبهة', mata: 'العينين', hidung: 'الأنف', mulut: 'الفم', wajah: 'الوجه' };
    for (const [key, val] of Object.entries(raw.translated_features || {})) {
      interpretation.translated_features[key === 'mulut' ? 'mulut_bibir' : key === 'wajah' ? 'bentuk_wajah' : key] = {
        description: val.d || val.description || '',
        arabic: val.ar || featureMap[key] || ''
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
