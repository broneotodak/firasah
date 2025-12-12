// netlify/functions/analyze-image-replicate.js
// Enhanced Kitab Firasat Prompt - Version 2.0 (Fallback/Direct Method)

const Replicate = require("replicate");

// ENHANCED KITAB FIRASAT PROMPT - Same as webhook version for consistency
const KITAB_FIRASAT_PROMPT = `You are an expert in classical Islamic physiognomy (Ilmu Firasat / علم الفراسة). 
Analyze this face image with the precision of a traditional Kitab Firasat scholar.

CRITICAL: Provide UNIQUE, DETAILED descriptions. Do NOT use generic phrases.

═══════════════════════════════════════════════════════════════════════════════
1. FOREHEAD (الجبهة - Jabhah)
═══════════════════════════════════════════════════════════════════════════════
Describe: HEIGHT (very high/high/medium/low), WIDTH (broad/medium/narrow), 
SHAPE (rounded/flat/convex/sloped), SURFACE (smooth/lined/furrowed), 
TEMPLES (prominent/flat/sunken), BROW RIDGE visibility.

═══════════════════════════════════════════════════════════════════════════════
2. EYEBROWS (الحواجب - Al-Hawajib)
═══════════════════════════════════════════════════════════════════════════════
Describe: THICKNESS (bushy/thick/medium/thin/sparse), SHAPE (straight/arched/angled/S-curved),
LENGTH (long/medium/short), SPACING (close/moderate/wide), POSITION (high/medium/low above eyes),
TEXTURE (dense/feathered/sparse), TAIL direction and shape.

═══════════════════════════════════════════════════════════════════════════════
3. EYES (العينان - Al-'Aynayn)
═══════════════════════════════════════════════════════════════════════════════
Describe: SIZE (large/medium/small), SHAPE (round/almond/hooded/upturned/downturned/deep-set/protruding),
SET (wide-set/normal/close-set), DEPTH (deep-set/average/protruding), 
UPPER EYELID (heavy/medium/light fold), LOWER EYELID condition, 
EYE CORNERS (inner and outer), GAZE direction, EXPRESSION quality.

═══════════════════════════════════════════════════════════════════════════════
4. NOSE (الأنف - Al-Anf)
═══════════════════════════════════════════════════════════════════════════════
Describe: LENGTH (long/medium/short), BRIDGE (high/medium/low/humped/straight/curved),
TIP SHAPE (bulbous/round/pointed/upturned/downturned/hooked), TIP SIZE,
NOSTRILS (wide/medium/narrow/flared), ROOT width, 
OVERALL TYPE (Roman/Greek/Nubian/Snub/Aquiline/Button/Hawk).

═══════════════════════════════════════════════════════════════════════════════
5. LIPS & MOUTH (الفم والشفتان - Al-Fam wa Al-Shafatan)
═══════════════════════════════════════════════════════════════════════════════
Describe: UPPER LIP (very full/full/medium/thin), LOWER LIP fullness,
LIP RATIO (which is fuller and by how much), CUPID'S BOW (defined/soft/flat),
LIP WIDTH (wide/medium/narrow), CORNERS (upturned/straight/downturned),
PHILTRUM (deep/shallow, long/short, wide/narrow), LIP COLOR relative to skin,
MOUTH POSITION (forward/neutral/recessed), EXPRESSION, TEETH visibility.

═══════════════════════════════════════════════════════════════════════════════
6. JAWLINE & CHIN (الذقن والفك - Al-Diqn wa Al-Fakk)
═══════════════════════════════════════════════════════════════════════════════
Describe: JAWLINE SHAPE (square/angular/round/soft/sharp), DEFINITION level,
JAW WIDTH and ANGLE, CHIN SHAPE (square/round/pointed/cleft/dimpled),
CHIN SIZE (prominent/medium/receding), CHIN PROJECTION direction.

═══════════════════════════════════════════════════════════════════════════════
7. CHEEKBONES (الخد - Al-Khadd)
═══════════════════════════════════════════════════════════════════════════════
Describe: PROMINENCE (very prominent/moderate/flat/sunken), HEIGHT (high/medium/low),
WIDTH contribution, DEFINITION (sharp/soft/subtle), CHEEK HOLLOW presence,
FULLNESS below cheekbones, SYMMETRY level.

═══════════════════════════════════════════════════════════════════════════════
8. EARS (الأذنان - Al-Udzun)
═══════════════════════════════════════════════════════════════════════════════
Describe: SIZE (large/medium/small), POSITION (high/level/low), 
PROTRUSION (close to head/moderate/prominent), SHAPE (round/oval/rectangular/pointed),
LOBE (attached/free, long/short, fleshy/thin), VISIBILITY.

═══════════════════════════════════════════════════════════════════════════════
9. FACE SHAPE (الوجه - Al-Wajh)
═══════════════════════════════════════════════════════════════════════════════
Describe: PRIMARY SHAPE (oval/round/square/rectangular/heart/diamond/oblong/triangle),
PROPORTIONS (upper vs lower face width), LENGTH vs WIDTH ratio,
FACIAL THIRDS balance, SYMMETRY level, ANGULARITY, OVERALL IMPRESSION.

═══════════════════════════════════════════════════════════════════════════════
10. HAIRLINE (الشعر - Al-Sha'r)
═══════════════════════════════════════════════════════════════════════════════
Describe: PRESENCE (full/receding/balding/bald/shaved), SHAPE (straight/M-shaped/widow's peak/rounded),
HEIGHT (high/medium/low), CORNERS recession, DENSITY at front, 
HAIR TEXTURE and COLOR if visible.

═══════════════════════════════════════════════════════════════════════════════
OUTPUT: Number each section 1-10. Be SPECIFIC. Describe EXACTLY what you observe.
Keep tone neutral. This is for Kitab Firasat character analysis.`;

exports.handler = async (event, context) => {
  console.log('=== Function Started (Direct/Fallback Method) ===');
  
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
    
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    console.log('3. Starting Replicate API call with ENHANCED prompt...');
    const startTime = Date.now();
    
    // Run with timeout
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
              prompt: KITAB_FIRASAT_PROMPT,
              max_tokens: 2048,  // Increased for detailed output
              temperature: 0.4,  // Slightly higher for varied descriptions
              top_p: 0.95
            }
          }
        ),
        timeoutPromise
      ]);
    } catch (replicateError) {
      console.error('Replicate API error:', replicateError);
      throw replicateError;
    }

    const duration = Date.now() - startTime;
    console.log('4. Analysis complete in', duration, 'ms');

    // Format response
    let analysis;
    if (Array.isArray(output)) {
      analysis = output.join('');
    } else if (typeof output === 'string') {
      analysis = output;
    } else {
      analysis = JSON.stringify(output);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        analysis: analysis,
        model: "LLaVA v1.5 13B - Enhanced Kitab Firasat Analysis v2.0",
        duration: duration
      })
    };

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error:', error.message);
    
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
