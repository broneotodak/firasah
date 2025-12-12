// netlify/functions/analyze-image-webhook.js
// Enhanced Kitab Firasat Prompt - Version 2.0
// Updated to provide rich, varied descriptions based on classical physiognomy

const Replicate = require("replicate");

// ENHANCED KITAB FIRASAT PROMPT - Detailed vocabulary for varied descriptions
const KITAB_FIRASAT_PROMPT = `You are an expert in classical Islamic physiognomy (Ilmu Firasat / علم الفراسة). 
Analyze this face image with the precision of a traditional Kitab Firasat scholar.

CRITICAL: Provide UNIQUE, DETAILED descriptions. Do NOT use generic phrases. 
Observe carefully and describe EXACTLY what you see with rich vocabulary.

═══════════════════════════════════════════════════════════════════════════════
1. FOREHEAD (الجبهة - Jabhah)
═══════════════════════════════════════════════════════════════════════════════
Describe with precision:
- HEIGHT: Very high / High / Medium / Low / Very low (relative to face)
- WIDTH: Very broad / Broad / Medium / Narrow / Very narrow
- SHAPE: Rounded / Flat / Slightly convex / Sloped backward / Prominent
- SURFACE: Smooth / With horizontal lines / With vertical lines / Furrowed / Bumpy
- TEMPLES: Prominent / Flat / Sunken / Wide / Narrow
- BROW RIDGE: Pronounced / Moderate / Subtle / None visible
- PROPORTIONS: Ratio compared to lower face (larger/equal/smaller)

═══════════════════════════════════════════════════════════════════════════════
2. EYEBROWS (الحواجب - Al-Hawajib)
═══════════════════════════════════════════════════════════════════════════════
Describe with precision:
- THICKNESS: Very thick/bushy / Thick / Medium / Thin / Very thin/sparse
- SHAPE: Straight / Gently arched / Highly arched / Angled / S-curved / Rounded
- LENGTH: Long extending past eye / Medium / Short ending before eye corner
- SPACING: Very close (almost meeting) / Close / Moderate / Wide / Very wide apart
- POSITION: High above eyes / Medium height / Low near eyes
- TEXTURE: Dense and uniform / Feathered / Sparse at ends / Wild/unruly
- TAIL: Tapered / Blunt / Upward / Downward / Straight
- INNER CORNERS: Sharp / Rounded / Thick / Thin / Tapered

═══════════════════════════════════════════════════════════════════════════════
3. EYES (العينان - Al-'Aynayn)
═══════════════════════════════════════════════════════════════════════════════
Describe with precision:
- SIZE: Very large / Large / Medium / Small / Very small (relative to face)
- SHAPE: Round / Almond / Hooded / Upturned / Downturned / Monolid / Deep-set / Protruding
- SET: Wide-set / Normal / Close-set (distance between eyes)
- DEPTH: Deep-set / Average depth / Protruding/prominent
- IRIS VISIBILITY: Full iris visible / Partial white showing below / Above / Both
- UPPER EYELID: Heavy / Medium fold / Light fold / No fold / Hooded
- LOWER EYELID: Tight / Slightly loose / Puffy / Dark circles present
- EYE CORNERS (inner): Rounded / Pointed / Covered by epicanthic fold
- EYE CORNERS (outer): Upturned / Straight / Downturned
- GAZE DIRECTION: Direct / Upward / Downward / Sideways / Distant
- EXPRESSION: Alert / Calm / Intense / Soft / Penetrating / Dreamy

═══════════════════════════════════════════════════════════════════════════════
4. NOSE (الأنف - Al-Anf)
═══════════════════════════════════════════════════════════════════════════════
Describe with precision:
- OVERALL LENGTH: Long / Medium / Short (proportion to face)
- BRIDGE: High / Medium / Low / Flat / Humped / Straight / Curved
- BRIDGE WIDTH: Wide / Medium / Narrow
- TIP SHAPE: Bulbous / Round / Pointed / Upturned / Downturned / Hooked
- TIP SIZE: Large / Medium / Small / Refined
- NOSTRILS: Wide and flared / Medium / Narrow / Round / Oval / Visible from front / Hidden
- NOSTRIL FLARE: Prominent / Moderate / Subtle / None
- ROOT (between eyes): Wide / Medium / Narrow / Deep / Shallow
- OVERALL SHAPE: Roman / Greek / Nubian / Snub / Aquiline / Button / Hawk

═══════════════════════════════════════════════════════════════════════════════
5. LIPS & MOUTH (الفم والشفتان - Al-Fam wa Al-Shafatan)
═══════════════════════════════════════════════════════════════════════════════
Describe with precision:
- UPPER LIP: Very full / Full / Medium / Thin / Very thin
- LOWER LIP: Very full / Full / Medium / Thin / Very thin
- LIP RATIO: Upper fuller / Equal / Lower fuller (and by how much)
- CUPID'S BOW: Very defined/sharp / Defined / Soft / Flat / None visible
- LIP WIDTH: Very wide / Wide / Medium / Narrow / Very narrow
- LIP CORNERS: Upturned / Straight / Slightly downturned / Clearly downturned
- PHILTRUM (groove above lip): Deep / Medium / Shallow / Long / Short / Wide / Narrow
- LIP COLOR: Naturally dark / Medium / Light / Pale (relative to skin)
- LIP TEXTURE: Smooth / Slightly lined / Chapped appearance
- MOUTH POSITION: Slightly forward / Neutral / Slightly recessed
- EXPRESSION: Neutral / Slight smile / Tense / Relaxed / Pursed
- TEETH VISIBILITY: Visible when neutral / Not visible / Slight showing
- PROPORTION: Wide compared to nose / Equal to nose width / Narrower than nose

═══════════════════════════════════════════════════════════════════════════════
6. JAWLINE & CHIN (الذقن والفك - Al-Diqn wa Al-Fakk)
═══════════════════════════════════════════════════════════════════════════════
Describe with precision:
- JAWLINE SHAPE: Square / Angular / Round / Soft / Sharp / Undefined
- JAWLINE DEFINITION: Very defined / Defined / Moderate / Soft / Hidden
- JAW WIDTH: Very wide / Wide / Medium / Narrow / Very narrow
- JAW ANGLE: Sharp angle / Moderate angle / Soft angle / Rounded
- CHIN SHAPE: Square / Round / Pointed / Cleft / Dimpled / Flat
- CHIN SIZE: Prominent/strong / Medium / Receding / Small
- CHIN PROJECTION: Jutting forward / Neutral / Recessed
- CHIN WIDTH: Broad / Medium / Narrow / Tapered
- MANDIBLE LINE: Visible / Partially visible / Soft / Hidden
- OVERALL LOWER FACE: Strong / Balanced / Delicate / Soft

═══════════════════════════════════════════════════════════════════════════════
7. CHEEKBONES (الخد - Al-Khadd)
═══════════════════════════════════════════════════════════════════════════════
Describe with precision:
- PROMINENCE: Very prominent / Prominent / Moderate / Flat / Sunken
- HEIGHT: High-set / Medium / Low-set
- WIDTH: Wide / Medium / Narrow (contribution to face width)
- DEFINITION: Sharp/angular / Soft/rounded / Subtle
- CHEEK HOLLOW: Present and deep / Present and subtle / Not present
- FULLNESS BELOW: Full/fleshy / Medium / Lean / Hollow
- SYMMETRY: Symmetrical / Slight asymmetry / Noticeable asymmetry
- APPLE OF CHEEKS: Prominent when neutral / Subtle / Not visible

═══════════════════════════════════════════════════════════════════════════════
8. EARS (الأذنان - Al-Udzun)
═══════════════════════════════════════════════════════════════════════════════
Describe with precision:
- SIZE: Large / Medium-large / Medium / Medium-small / Small
- POSITION: High-set / Level with eyes / Low-set
- PROTRUSION: Close to head / Slight protrusion / Moderate / Prominent
- SHAPE: Round / Oval / Rectangular / Pointed / Square
- LOBE: Attached / Free/detached / Long / Short / Fleshy / Thin
- EAR ANGLE: Forward-facing / Side-facing / Backward-angled
- HELIX (outer rim): Thick / Medium / Thin / Folded / Pointed
- VISIBILITY: Fully visible / Partially covered by hair / Hidden
- SYMMETRY: Symmetrical / Slightly different / Noticeably different

═══════════════════════════════════════════════════════════════════════════════
9. FACE SHAPE (الوجه - Al-Wajh)
═══════════════════════════════════════════════════════════════════════════════
Describe with precision:
- PRIMARY SHAPE: Oval / Round / Square / Rectangular / Heart / Diamond / Oblong / Triangle
- PROPORTIONS: Upper face wider / Balanced / Lower face wider
- LENGTH VS WIDTH: Long / Balanced / Wide
- FOREHEAD TO JAW: Tapers down / Even width / Widens at jaw
- FACIAL THIRDS: Upper/Middle/Lower - which is longest/shortest
- SYMMETRY: Highly symmetrical / Generally symmetrical / Some asymmetry
- ANGULARITY: Angular / Soft angles / Rounded / Mixed
- OVERALL IMPRESSION: Strong / Delicate / Balanced / Distinguished / Gentle

═══════════════════════════════════════════════════════════════════════════════
10. HAIRLINE (الشعر - Al-Sha'r)
═══════════════════════════════════════════════════════════════════════════════
Describe with precision:
- PRESENCE: Full hair / Receding / Balding / Bald / Shaved
- SHAPE: Straight / M-shaped / Widow's peak / Rounded / Uneven
- HEIGHT: High hairline / Medium / Low hairline
- CORNERS: Deep recession / Slight recession / No recession
- DENSITY AT FRONT: Thick / Medium / Thin / Sparse
- HAIR TEXTURE: Straight / Wavy / Curly / Coily (if visible)
- HAIR COLOR: Black / Dark brown / Brown / Light / Gray / Mixed
- IF BALD: Completely bald / Bald crown / Receded pattern / Shaved style

═══════════════════════════════════════════════════════════════════════════════
OUTPUT INSTRUCTIONS:
═══════════════════════════════════════════════════════════════════════════════
- Number each section 1-10 with the feature name
- Be SPECIFIC - no generic descriptions
- Describe EXACTLY what you observe
- Use comparative language (larger than, similar to, contrasts with)
- Note any distinctive or unusual features
- Keep tone neutral and observational
- This is for Kitab Firasat character analysis - precision matters`;

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

    // Create prediction with ENHANCED prompt
    const prediction = await replicate.predictions.create({
      version: "yorickvp/llava-13b:b5f6212d032508382d61ff00469ddda3e32fd8a0e75dc39d8a4191bb742157fb",
      input: {
        image: image,
        prompt: KITAB_FIRASAT_PROMPT,
        max_tokens: 2048,  // Increased for detailed descriptions
        temperature: 0.4,  // Slightly higher for more varied output
        top_p: 0.95
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
        message: "Analysis started with enhanced Kitab Firasat prompt."
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
