// netlify/functions/interpret-character.js
// Simplified version to avoid timeout

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
        disclaimer: 'Based on classical Islamic physiognomy (Kitab Firasat). Not fortune-telling.'
      },
      my: {
        name: 'Bahasa Melayu',
        summaryLabel: 'Ringkasan Karakter',
        positiveLabel: 'Sifat Positif',
        negativeLabel: 'Sifat Perlu Diperhatikan',
        personalityLabel: 'Jenis Kepribadian',
        disclaimer: 'Berdasarkan ilmu Firasat klasik Islam. Bukan ramalan nasib.'
      },
      id: {
        name: 'Bahasa Indonesia',
        summaryLabel: 'Ringkasan Karakter',
        positiveLabel: 'Sifat Positif',
        negativeLabel: 'Sifat yang Perlu Diperhatikan',
        personalityLabel: 'Tipe Kepribadian',
        disclaimer: 'Berdasarkan ilmu Firasat klasik Islam. Bukan ramalan nasib.'
      }
    };

    const lang = langConfig[language] || langConfig.my;

    // Simplified prompt - no large JSON to avoid timeout
    const systemPrompt = `You are an expert in Ilmu Firasat (Islamic physiognomy) based on Kitab Firasat by Imam Fakhruddin ar-Razi (1150-1210 CE).

OUTPUT LANGUAGE: ${lang.name}

KEY FIRASAT PRINCIPLES:
- Large forehead = lazy/angry; Small forehead = foolish
- Thick eyebrows = sorrowful; Arched eyebrows = deceptive
- Large eyes = lazy; Sunken eyes = cunning; Bright eyes = intelligent
- Sharp nose = confrontational; Curved nose = noble soul
- Thick lips = stubborn; Thin lips = good character
- Round face = simple-minded; Oval face = balanced
- Large ears = long life; Small ears = quick-witted
- Four temperaments: Sanguine (hot), Phlegmatic (cold), Melancholic (wet), Choleric (dry)

TASK: Analyze the facial features and provide detailed character interpretation.

OUTPUT FORMAT (JSON):
{
  "translated_features": {
    "dahi": {"description": "[2-3 sentences in ${lang.name}]", "original": "[English]"},
    "kening": {"description": "[2-3 sentences]", "original": "[English]"},
    "mata": {"description": "[2-3 sentences]", "original": "[English]"},
    "hidung": {"description": "[2-3 sentences]", "original": "[English]"},
    "mulut_bibir": {"description": "[2-3 sentences]", "original": "[English]"},
    "bentuk_wajah": {"description": "[2-3 sentences]", "original": "[English]"},
    "rahang_dagu": {"description": "[2-3 sentences]", "original": "[English]"},
    "pipi": {"description": "[2-3 sentences]", "original": "[English]"},
    "telinga": {"description": "[2-3 sentences]", "original": "[English]"},
    "garis_rambut": {"description": "[2-3 sentences]", "original": "[English]"}
  },
  "character_interpretation": {
    "positive_traits": ["trait 1", "trait 2", "trait 3", "trait 4", "trait 5"],
    "negative_traits": ["trait 1 (gentle advice)", "trait 2 (gentle advice)"],
    "personality_type": "Sanguine/Phlegmatic/Melancholic/Choleric with explanation",
    "overall_summary": "[4-5 detailed sentences about overall character]"
  },
  "kitab_references": [
    {"feature": "name", "quote": "Kitab Firasat quote", "source": "Section name"}
  ],
  "disclaimer": "${lang.disclaimer}"
}`;

    const userPrompt = `Analyze these facial features from Kitab Firasat perspective. Write in ${lang.name}:

${llavaAnalysis}

Provide detailed interpretation in JSON format.`;


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
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'OpenAI API error', details: errorData })
      };
    }

    const data = await response.json();
    const interpretation = JSON.parse(data.choices[0].message.content);

    const source = {
      title: "Kitab Firasat",
      author: "Imam Fakhruddin ar-Razi",
      period: "1150-1210 M"
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        interpretation,
        source,
        language,
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
