// netlify/functions/interpret-character.js
// Optimized with accurate Kitab Firasat references + Arabic terms

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
      en: { name: 'English', summaryLabel: 'Character Summary', positiveLabel: 'Positive Traits', negativeLabel: 'Traits to Watch', personalityLabel: 'Personality Type', disclaimer: 'Based on Kitab Firasat by Imam Fakhruddin ar-Razi (1150-1210 CE). Classical Islamic physiognomy for character understanding, not fortune-telling.' },
      my: { name: 'Bahasa Melayu', summaryLabel: 'Ringkasan Karakter', positiveLabel: 'Sifat Positif', negativeLabel: 'Sifat Perlu Diperhatikan', personalityLabel: 'Jenis Kepribadian', disclaimer: 'Berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi (1150-1210 M). Ilmu firasat Islam klasik untuk memahami karakter, bukan ramalan nasib.' },
      id: { name: 'Bahasa Indonesia', summaryLabel: 'Ringkasan Karakter', positiveLabel: 'Sifat Positif', negativeLabel: 'Sifat Perlu Diperhatikan', personalityLabel: 'Tipe Kepribadian', disclaimer: 'Berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi (1150-1210 M). Ilmu firasat Islam klasik untuk memahami karakter, bukan ramalan nasib.' }
    };
    const lang = langConfig[language] || langConfig.my;

    // ACCURATE Kitab Firasat Reference with Arabic Terms (from actual book extraction)
    const kitabReference = `
KITAB FIRASAT - Imam Fakhruddin ar-Razi (الفراسة)

DAHI (الجبهة - Al-Jabhah):
• Berkerut & rata → Pemarah | Besar → Pemalas & pemarah | Kecil → Bodoh (otak kecil)
• Banyak kerutan → Congkak | Rata tanpa kerutan → Pengacau

KENING (الحواجب - Al-Hawajib):
• Berbulu lebat → Sering berduka, tutur kata buruk (dominasi empedu hitam)
• Miring ke bawah dari hidung → Congkak & dungu

MATA (العينين - Al-'Aynayn):
• Besar → Pemalas (seperti kerbau) | Melotot → Bodoh & banyak mulut (seperti keledai)
• Cekung → Jahat (seperti kera) | Agak cekung → Jiwa baik (seperti harimau)
• Hitam pekat → Penakut | Merah bara → Pemarah | Biru/putih → Penakut
• Bergerak cepat & tajam → Penipu & pencuri | Lambat/kaku → Banyak berfikir
• Bersinar & mengilap → Gemar bersetubuh

HIDUNG (الأنف - Al-Anf):
• Ujung lancip → Suka permusuhan & peragu (seperti anjing)
• Tebal & penuh → Kurang pemahaman (seperti kerbau) | Pesek → Syahwat besar
• Lubang besar → Pemarah | Melengkung dari dahi → Tidak tahu malu (seperti gagak)
• Melengkung (mancung) → Jiwa baik (seperti elang)

MULUT & BIBIR (الفم - Al-Fam):
• Lebar → Syahwat besar (seperti harimau) | Tebal → Bodoh & keras kepala
• Tipis & lemas → Jiwa baik | Pucat → Sering sakit
• Gigi taring panjang & kuat → Serakah & jahat

WAJAH (الوجه - Al-Wajh):
• Gemuk/berdaging → Pemalas & bodoh (seperti kerbau) | Kurus → Cermat & teliti
• Bundar → Bodoh & jiwa hina (seperti kera) | Besar → Pemalas
• Kecil → Hina & suka merayu | Panjang → Tidak tahu malu (seperti anjing)
• Buruk → Biasanya akhlak buruk

TELINGA (الأذن - Al-Udzun):
• Besar → Bodoh tapi panjang umur (seperti keledai, dominasi sifat kering)

LEHER (العنق - Al-'Unuq):
• Tebal → Kuat & perkasa | Tipis → Lemah | Tebal & penuh → Pemarah
• Seimbang → Jiwa baik (seperti harimau) | Kecil & panjang → Penakut (seperti unta)
• Terlalu pendek → Pembuat tipu daya (seperti serigala)

EMPAT MIZAJ (Kepribadian):
• Sanguinis (Panas/دموي): Cerdas, pemberani, heroik - dada bidang, kulit merah
• Flegmatis (Dingin/بلغمي): Lambat berfikir, penakut - tubuh lemah, suara lirih
• Melankolis (Basah/سوداوي): Mudah mengantuk, tidak tabah - otot lemah, kulit tipis
• Koleris (Kering/صفراوي): Indra peka, tabah, sabar - persendian kuat, kulit kasar

PRINSIP: "Semakin banyak petunjuk yang cocok, semakin mendekati kepastian kesimpulannya"
`;


    const systemPrompt = `You are an expert in Ilmu Firasat based on Kitab Firasat by Imam Fakhruddin ar-Razi.

REFERENCE (USE THIS ACCURATELY - include Arabic terms):
${kitabReference}

OUTPUT LANGUAGE: ${lang.name}

RULES:
1. ONLY use interpretations from the Kitab reference above - NO assumptions
2. Include Arabic terms (e.g., Al-Jabhah للجبهة) in your response
3. If a feature doesn't match the Kitab exactly, provide the closest interpretation
4. Be balanced - mention both positive and negative traits
5. Quote the animal comparisons from Kitab (e.g., "seperti harimau", "seperti kerbau")
6. Write in an engaging, detailed manner - people love reading about themselves!

IMPORTANT - BE COMPREHENSIVE:
- overall_summary: Write 6-8 FULL sentences. Paint a complete picture of this person's character, their strengths, potential challenges, how they interact with others, their inner nature, and advice for self-improvement. Make it personal and insightful.
- positive_traits: List 5-6 traits, each with a brief explanation (e.g., "Kecerdasan tinggi - mampu menganalisis situasi dengan tajam")
- negative_traits: List 3-4 traits with gentle, constructive advice (e.g., "Kecenderungan marah - perlu belajar teknik pernafasan untuk mengawal emosi")
- Each feature description: Write 2-3 detailed sentences connecting the physical feature to character traits

OUTPUT JSON:
{
  "translated_features": {
    "dahi": {"description": "[2-3 sentences: physical observation + Kitab interpretation + character meaning]", "arabic": "الجبهة"},
    "kening": {"description": "[2-3 sentences]", "arabic": "الحواجب"},
    "mata": {"description": "[2-3 sentences]", "arabic": "العينين"},
    "hidung": {"description": "[2-3 sentences]", "arabic": "الأنف"},
    "mulut_bibir": {"description": "[2-3 sentences]", "arabic": "الفم"},
    "bentuk_wajah": {"description": "[2-3 sentences]", "arabic": "الوجه"},
    "rahang_dagu": {"description": "[2-3 sentences]", "arabic": "الذقن"},
    "pipi": {"description": "[2-3 sentences]", "arabic": "الخد"},
    "telinga": {"description": "[2-3 sentences]", "arabic": "الأذن"},
    "garis_rambut": {"description": "[2-3 sentences]", "arabic": "الشعر"}
  },
  "character_interpretation": {
    "positive_traits": ["trait 1 - explanation", "trait 2 - explanation", "trait 3 - explanation", "trait 4 - explanation", "trait 5 - explanation"],
    "negative_traits": ["trait 1 - constructive advice", "trait 2 - constructive advice", "trait 3 - constructive advice"],
    "personality_type": "[Mizaj type] ([Arabic term]) - [2-3 sentences explaining this temperament, its strengths, and how it manifests in daily life]",
    "overall_summary": "[6-8 FULL SENTENCES: Comprehensive character portrait covering personality, strengths, challenges, social nature, inner world, potential, and wisdom from the Kitab. Make it meaningful and personal.]"
  },
  "kitab_references": [
    {"feature": "feature name", "quote": "exact quote from Kitab", "arabic_term": "Arabic"},
    {"feature": "feature name", "quote": "exact quote from Kitab", "arabic_term": "Arabic"},
    {"feature": "feature name", "quote": "exact quote from Kitab", "arabic_term": "Arabic"},
    {"feature": "feature name", "quote": "exact quote from Kitab", "arabic_term": "Arabic"}
  ],
  "disclaimer": "${lang.disclaimer}"
}`;

    const userPrompt = `Analyze these facial features using the Kitab Firasat reference. Write a COMPREHENSIVE, DETAILED interpretation in ${lang.name}. 

People are excited to learn about themselves - give them a rich, insightful reading they'll remember!

FACIAL FEATURES TO ANALYZE:
${llavaAnalysis}

Remember: 
- Overall summary must be 6-8 full sentences
- Each trait needs an explanation
- Include animal comparisons from Kitab
- Make it personal and engaging`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.7,
        max_tokens: 3000,
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
