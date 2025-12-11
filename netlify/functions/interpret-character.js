// netlify/functions/interpret-character.js
// Comprehensive Kitab Firasat interpretation - Netlify Pro (26s timeout)

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
      en: { name: 'English', disclaimer: 'Based on Kitab Firasat by Imam Fakhruddin ar-Razi (1150-1210 CE). Classical Islamic physiognomy for character understanding, not fortune-telling. Character can change through effort and divine will.' },
      my: { name: 'Bahasa Melayu', disclaimer: 'Berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi (1150-1210 M). Ilmu firasat Islam klasik untuk memahami karakter, bukan ramalan nasib. Karakter boleh berubah melalui usaha dan kehendak Ilahi.' },
      id: { name: 'Bahasa Indonesia', disclaimer: 'Berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi (1150-1210 M). Ilmu firasat Islam klasik untuk memahami karakter, bukan ramalan nasib. Karakter dapat berubah melalui usaha dan kehendak Ilahi.' }
    };
    const lang = langConfig[language] || langConfig.my;

    // Complete Kitab Firasat Reference with Arabic Terms
    const kitabReference = `KITAB FIRASAT (الفراسة) - Imam Fakhruddin ar-Razi (1150-1210 M)

DAHI (الجبهة - Al-Jabhah):
• Besar → Pemalas & pemarah | Kecil → Bodoh (otak kecil)
• Banyak kerutan → Congkak | Rata tanpa kerutan → Pengacau
• Berkerut & rata → Pemarah

KENING (الحواجب - Al-Hawajib):
• Berbulu lebat → Sering berduka, tutur kata buruk (dominasi empedu hitam)
• Miring ke bawah dari hidung → Congkak & dungu

MATA (العينين - Al-'Aynayn):
• Besar → Pemalas (seperti kerbau) | Melotot → Bodoh & banyak mulut (seperti keledai)
• Cekung → Jahat (seperti kera) | Agak cekung → Jiwa baik (seperti harimau)
• Hitam pekat → Penakut | Merah bara → Pemarah | Biru/putih → Penakut
• Bergerak cepat & tajam → Penipu & pencuri | Lambat/kaku → Banyak berfikir
• Bersinar & mengilap → Cerdas, tajam fikiran

HIDUNG (الأنف - Al-Anf):
• Ujung lancip → Suka permusuhan & peragu (seperti anjing)
• Tebal & penuh → Kurang pemahaman (seperti kerbau) | Pesek → Syahwat besar
• Lubang besar → Pemarah | Melengkung dari dahi → Tidak tahu malu (seperti gagak)
• Melengkung/mancung → Jiwa mulia & baik (seperti elang)

MULUT & BIBIR (الفم - Al-Fam):
• Lebar → Syahwat besar (seperti harimau) | Tebal → Bodoh & keras kepala
• Tipis & lemas → Jiwa baik | Pucat → Sering sakit
• Gigi taring panjang & kuat → Serakah & jahat

WAJAH (الوجه - Al-Wajh):
• Gemuk/berdaging → Pemalas & bodoh (seperti kerbau) | Kurus → Cermat & teliti
• Bundar → Bodoh & jiwa hina (seperti kera) | Besar → Pemalas
• Kecil → Hina & suka merayu | Panjang → Tidak tahu malu (seperti anjing)
• Oval/seimbang → Karakter seimbang & baik

TELINGA (الأذن - Al-Udzun):
• Besar → Bodoh tapi panjang umur (seperti keledai)
• Kecil → Cerdas & cepat berfikir

LEHER (العنق - Al-'Unuq):
• Tebal → Kuat & perkasa | Tipis → Lemah | Tebal & penuh → Pemarah
• Seimbang → Jiwa baik (seperti harimau) | Kecil & panjang → Penakut (seperti unta)
• Terlalu pendek → Pembuat tipu daya (seperti serigala)

EMPAT MIZAJ (Temperamen):
• Sanguinis (دموي - Damawi): Panas - Cerdas, pemberani, heroik, optimis
• Flegmatis (بلغمي - Balghami): Dingin - Tenang, sabar, lambat berfikir
• Melankolis (سوداوي - Sawdawi): Basah - Sensitif, pemikir mendalam, mudah sedih
• Koleris (صفراوي - Safrawi): Kering - Tabah, sabar, tegas, indra peka

PRINSIP UTAMA: "Semakin banyak petunjuk yang cocok, semakin mendekati kepastian kesimpulannya"`;


    const systemPrompt = `Anda adalah pakar dalam ilmu Firasat berdasarkan Kitab Firasat karya Imam Fakhruddin ar-Razi.

RUJUKAN KITAB (gunakan dengan tepat, sertakan istilah Arab):
${kitabReference}

BAHASA OUTPUT: ${lang.name}

PERATURAN PENTING:
1. HANYA gunakan tafsiran dari rujukan Kitab di atas - TIADA andaian
2. Sertakan istilah Arab (contoh: Al-Jabhah الجبهة)
3. Gunakan perbandingan haiwan dari Kitab (seperti harimau, kerbau, elang, dll)
4. Seimbangkan sifat positif dan negatif
5. Tulis dengan gaya menarik - orang suka membaca tentang diri mereka!

FORMAT OUTPUT (JSON):
{
  "translated_features": {
    "dahi": {"description": "[2-3 ayat: pemerhatian fizikal + tafsiran Kitab + makna karakter]", "arabic": "الجبهة"},
    "kening": {"description": "[2-3 ayat terperinci]", "arabic": "الحواجب"},
    "mata": {"description": "[2-3 ayat terperinci]", "arabic": "العينين"},
    "hidung": {"description": "[2-3 ayat terperinci]", "arabic": "الأنف"},
    "mulut_bibir": {"description": "[2-3 ayat terperinci]", "arabic": "الفم"},
    "bentuk_wajah": {"description": "[2-3 ayat terperinci]", "arabic": "الوجه"},
    "rahang_dagu": {"description": "[2-3 ayat terperinci]", "arabic": "الذقن"},
    "telinga": {"description": "[2-3 ayat terperinci]", "arabic": "الأذن"}
  },
  "character_interpretation": {
    "positive_traits": [
      "Sifat 1 - penjelasan ringkas kenapa ini kekuatan",
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
    "personality_type": "[Jenis Mizaj] (istilah Arab) - [2-3 ayat menjelaskan temperamen ini, kekuatannya, dan bagaimana ia muncul dalam kehidupan seharian]",
    "overall_summary": "[TULIS 6-8 AYAT PENUH: Gambaran karakter menyeluruh merangkumi personaliti, kekuatan utama, cabaran yang perlu dihadapi, cara bergaul dengan orang lain, dunia dalaman, potensi diri, dan hikmah dari Kitab Firasat. Jadikan ia bermakna, peribadi dan memberi inspirasi!]"
  },
  "kitab_references": [
    {"feature": "nama ciri", "quote": "petikan tepat dari Kitab", "arabic_term": "istilah Arab"},
    {"feature": "nama ciri", "quote": "petikan tepat dari Kitab", "arabic_term": "istilah Arab"},
    {"feature": "nama ciri", "quote": "petikan tepat dari Kitab", "arabic_term": "istilah Arab"},
    {"feature": "nama ciri", "quote": "petikan tepat dari Kitab", "arabic_term": "istilah Arab"}
  ],
  "disclaimer": "${lang.disclaimer}"
}`;

    const userPrompt = `Analisis ciri-ciri wajah berikut menggunakan rujukan Kitab Firasat. Berikan tafsiran yang LENGKAP, TERPERINCI dan MENARIK dalam ${lang.name}.

Orang sangat teruja untuk mengetahui tentang diri mereka - berikan bacaan yang kaya dan bernas yang akan mereka ingati!

CIRI-CIRI WAJAH UNTUK DIANALISIS:
${llavaAnalysis}

INGAT:
- Ringkasan keseluruhan MESTI 6-8 ayat penuh
- Setiap sifat perlu penjelasan
- Sertakan perbandingan haiwan dari Kitab (harimau, kerbau, elang, kera, dll)
- Jadikan ia peribadi dan menarik
- Gunakan istilah Arab yang sesuai`;

    // OpenAI API call with 20 second timeout (Netlify Pro allows 26s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

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
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

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
    
    if (error.name === 'AbortError') {
      return { statusCode: 504, headers, body: JSON.stringify({ error: 'Request timeout', message: 'OpenAI took too long to respond' }) };
    }
    
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error', message: error.message }) };
  }
};
