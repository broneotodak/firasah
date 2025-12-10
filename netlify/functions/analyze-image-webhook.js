// netlify/functions/analyze-image-webhook.js
const Replicate = require("replicate");

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
    const { image } = JSON.parse(event.body);
    
    if (!image) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image provided' })
      };
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Create prediction instead of waiting for it
    const prediction = await replicate.predictions.create({
      version: "yorickvp/llava-13b:b5f6212d032508382d61ff00469ddda3e32fd8a0e75dc39d8a4191bb742157fb",
      input: {
        image: image,
        prompt: `Please analyze this face image in detail for the purpose of classical character reading (Ilmu Firasat). Focus only on the following facial features and describe them neutrally and structurally, without modern beauty judgment. Your analysis should help deduce personality traits based on the shape, size, position, and impression of each part:

1. FOREHEAD (Jabhah): Describe the size, width, height, and any natural wrinkles. Is it broad, narrow, or furrowed?

2. EYEBROWS (Al-Hawajib): Describe the thickness, arch/shape, and distance from the eyes. Are they close together or far apart?

3. EYES (Al-'Aynayn): Describe the size (big/small), shape (round/sharp), gaze direction (direct/squinting/downward), and eyelid posture.

4. NOSE (Al-Anf): Describe the nose bridge, tip shape, and nostril size. Is it sharp, broad, flat, hooked?

5. LIPS & MOUTH (Al-Fam): Describe the lip thickness (thin/thick), mouth width (wide/narrow), and natural expression (neutral/smiling/pressed).

6. JAWLINE & CHIN (Al-Diqn): Describe the shape of the jaw (wide/narrow/strong) and chin (pointed, round, flat).

7. CHEEKBONES (Al-Khadd): Describe whether cheekbones are prominent or flat. Note height and structure.

8. EARS (Al-Udzun): Describe the size, position (close to head or sticking out), and overall impression.

9. FACE SHAPE (Wajh): Describe the overall shape of the face: round, oval, square, heart-shaped, etc.

10. HAIRLINE (Sha'r): If visible, describe the hairline shape, such as straight, M-shaped, widow's peak (V-shaped), etc.

Output each section clearly. This analysis is meant to match classical 'Kitab Firasat' methodology, so keep tone descriptive, structural, and free from cultural or cosmetic bias.`,
        max_tokens: 1024,
        temperature: 0.2,
        top_p: 1
      }
    });

    // Return immediately with prediction ID
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        predictionId: prediction.id,
        status: prediction.status,
        message: "Analysis started. Check status in a few seconds."
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to start analysis',
        details: error.message
      })
    };
  }
};