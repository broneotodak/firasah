// netlify/functions/analyze-image-replicate.js
const Replicate = require("replicate");

exports.handler = async (event, context) => {
  console.log('=== Function Started ===');
  
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('1. Parsing request body...');
    const { image } = JSON.parse(event.body);
    
    if (!image) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image provided' })
      };
    }

    console.log('2. Image received, size:', image.length, 'characters');
    console.log('3. Token exists:', !!process.env.REPLICATE_API_TOKEN);
    
    // Initialize Replicate
    console.log('4. Initializing Replicate client...');
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
    console.log('5. Replicate client initialized');

    // Kitab Firasat classical physiognomy prompt
    const prompt = `Please analyze this face image in detail for the purpose of classical character reading (Ilmu Firasat). Focus only on the following facial features and describe them neutrally and structurally, without modern beauty judgment. Your analysis should help deduce personality traits based on the shape, size, position, and impression of each part:

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

Output each section clearly. This analysis is meant to match classical 'Kitab Firasat' methodology, so keep tone descriptive, structural, and free from cultural or cosmetic bias.`;

    console.log('6. Starting Replicate API call...');
    const startTime = Date.now();
    
    // Run the model with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Replicate timeout after 9 seconds')), 9000)
    );
    
    let output;
    try {
      output = await Promise.race([
        replicate.run(
          "yorickvp/llava-13b:b5f6212d032508382d61ff00469ddda3e32fd8a0e75dc39d8a4191bb742157fb",
          {
            input: {
              image: image,
              prompt: prompt,
              max_tokens: 1024,
              temperature: 0.2,
              top_p: 1
            }
          }
        ),
        timeoutPromise
      ]);
      
      console.log('7. Raw output type:', typeof output);
      console.log('7a. Raw output:', JSON.stringify(output).slice(0, 200) + '...');
    } catch (replicateError) {
      console.error('7b. Replicate API error:', replicateError);
      throw replicateError;
    }

    const duration = Date.now() - startTime;
    console.log('8. Analysis complete in', duration, 'ms');

    // Format the response - handle both array and string outputs
    let analysis;
    if (Array.isArray(output)) {
      console.log('9. Output is array with', output.length, 'items');
      analysis = output.join('');
    } else if (typeof output === 'string') {
      console.log('9. Output is string');
      analysis = output;
    } else {
      console.log('9. Unexpected output type:', typeof output);
      analysis = JSON.stringify(output);
    }
    
    console.log('10. Final analysis length:', analysis.length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        analysis: analysis,
        model: "LLaVA v1.5 13B - Kitab Firasat Analysis",
        duration: duration
      })
    };

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Analysis failed',
        details: error.message,
        type: error.constructor.name
      })
    };
  }
};