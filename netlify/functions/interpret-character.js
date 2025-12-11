// netlify/functions/interpret-character.js
// Uses Claude API (Anthropic) - faster and more reliable for structured output

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

    // Try Claude first, fallback to OpenAI
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'No API keys configured' }) };
    }

    // Extract key features to reduce tokens
    const extractedFeatures = extractKeyFeatures(llavaAnalysis);
    console.log('Extracted features length:', extractedFeatures.length);

    // Full langConfig with all labels
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

DAHI (الجبهة - Al-Jabhah):
• Besar → Pemalas & pemarah | Kecil → Bodoh | Berkerut → Congkak | Rata → Pengacau

MATA (العينين - Al-'Aynayn):  
• Besar → Pemalas (seperti kerbau) | Cekung → Jahat (seperti kera)
• Agak cekung → Jiwa baik (seperti harimau) | Bersinar → Cerdas & tajam fikiran

HIDUNG (الأنف - Al-Anf):
• Lancip → Suka permusuhan (seperti anjing) | Mancung → Jiwa mulia (seperti elang)
• Tebal → Kurang paham | Lubang besar → Pemarah

MULUT (الفم - Al-Fam):
• Tebal → Keras kepala & bodoh | Tipis → Jiwa baik | Lebar → Syahwat besar

WAJAH (الوجه - Al-Wajh):
• Bulat → Bodoh (seperti kera) | Oval → Seimbang & baik | Kurus → Teliti & cermat

TELINGA (الأذن - Al-Udzun):
• Besar → Panjang umur | Kecil → Cerdas

EMPAT MIZAJ:
• Sanguinis (دموي): Berani, cerdas, optimis
• Flegmatis (بلغمي): Tenang, sabar, lambat bertindak  
• Melankolis (سوداوي): Sensitif, pemikir mendalam
• Koleris (صفراوي): Tabah, tegas, sabar`;

    const prompt = `Anda pakar Kitab Firasat oleh Imam Fakhruddin ar-Razi. Analisis ciri wajah berikut dan berikan tafsiran LENGKAP dalam ${lang.name}.

RUJUKAN KITAB:
${kitabRef}

CIRI WAJAH UNTUK DIANALISIS:
${extractedFeatures}

Berikan output dalam format JSON yang tepat ini:

{
  "translated_features": {
    "dahi": {"description": "[2-3 ayat tafsiran berdasarkan Kitab, sertakan perbandingan haiwan jika sesuai]", "arabic": "الجبهة"},
    "mata": {"description": "[2-3 ayat tafsiran]", "arabic": "العينين"},
    "hidung": {"description": "[2-3 ayat tafsiran]", "arabic": "الأنف"},
    "mulut_bibir": {"description": "[2-3 ayat tafsiran]", "arabic": "الفم"},
    "bentuk_wajah": {"description": "[2-3 ayat tafsiran]", "arabic": "الوجه"}
  },
  "character_interpretation": {
    "positive_traits": [
      "Sifat 1 - penjelasan mengapa ini kekuatan",
      "Sifat 2 - penjelasan",
      "Sifat 3 - penjelasan", 
      "Sifat 4 - penjelasan",
      "Sifat 5 - penjelasan"
    ],
    "negative_traits": [
      "Sifat 1 - nasihat membina untuk memperbaiki",
      "Sifat 2 - nasihat membina",
      "Sifat 3 - nasihat membina"
    ],
    "personality_type": "[Jenis Mizaj] (istilah Arab) - [2 ayat penjelasan tentang temperamen ini dan bagaimana ia mempengaruhi kehidupan]",
    "overall_summary": "[TULIS 6-8 AYAT PENUH: Gambaran menyeluruh karakter individu ini. Ceritakan tentang kekuatan utama, cabaran yang perlu dihadapi, cara mereka bergaul dengan orang lain, potensi tersembunyi, dan hikmah dari Kitab Firasat untuk pembangunan diri. Jadikan ia bermakna dan memberi inspirasi!]"
  },
  "kitab_references": [
    {"feature": "Dahi", "quote": "Dahi yang [ciri] menunjukkan [sifat]", "arabic_term": "الجبهة"},
    {"feature": "Mata", "quote": "Mata yang [ciri] menandakan [sifat]", "arabic_term": "العينين"},
    {"feature": "Hidung", "quote": "Hidung yang [ciri] mencerminkan [sifat]", "arabic_term": "الأنف"}
  ],
  "disclaimer": "${lang.disclaimer}"
}

PENTING:
- Gunakan perbandingan haiwan dari Kitab (harimau, kerbau, elang, kera, anjing)
- Setiap sifat positif/negatif MESTI ada penjelasan
- Summary MESTI 6-8 ayat penuh yang bermakna
- Sertakan istilah Arab untuk setiap ciri`;


    let interpretation;
    let usage;
    let provider;

    // Try Claude first (faster and better at structured output)
    if (ANTHROPIC_API_KEY) {
      try {
        console.log('Trying Claude API...');
        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 2500,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (claudeResponse.ok) {
          const claudeData = await claudeResponse.json();
          const content = claudeData.content[0].text;
          
          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            interpretation = JSON.parse(jsonMatch[0]);
            usage = { input_tokens: claudeData.usage?.input_tokens, output_tokens: claudeData.usage?.output_tokens };
            provider = 'claude';
            console.log('Claude API success');
          }
        } else {
          console.log('Claude API failed, trying OpenAI...');
        }
      } catch (claudeError) {
        console.log('Claude error:', claudeError.message);
      }
    }

    // Fallback to OpenAI
    if (!interpretation && OPENAI_API_KEY) {
      console.log('Using OpenAI API...');
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${OPENAI_API_KEY}`, 
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

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.text();
        return { statusCode: openaiResponse.status, headers, body: JSON.stringify({ error: 'API error', details: errorData }) };
      }

      const openaiData = await openaiResponse.json();
      interpretation = JSON.parse(openaiData.choices[0].message.content);
      usage = openaiData.usage;
      provider = 'openai';
      console.log('OpenAI API success');
    }

    if (!interpretation) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'All API providers failed' }) };
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
