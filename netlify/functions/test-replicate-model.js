// netlify/functions/test-replicate-model.js
const Replicate = require("replicate");

exports.handler = async (event, context) => {
  console.log('=== Test Replicate Model Function ===');
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { image } = JSON.parse(event.body || '{}');
    
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Test 1: Check if model exists
    console.log('Testing model availability...');
    let modelInfo = {};
    try {
      // Try to get model info
      const model = await replicate.models.get("yorickvp", "llava-13b");
      modelInfo = {
        exists: true,
        name: model.name,
        description: model.description
      };
    } catch (e) {
      modelInfo = {
        exists: false,
        error: e.message
      };
    }

    // Test 2: Try a known working model (BLIP-2)
    let blipTest = {};
    if (image) {
      console.log('Testing with BLIP-2 model...');
      try {
        const output = await replicate.run(
          "andreasjansson/blip-2:4b32258c42e9efd4288bb9910bc532a69727f9acd26aa08e175713a0a857a608",
          {
            input: {
              image: image,
              question: "What do you see in this image?"
            }
          }
        );
        blipTest = {
          success: true,
          output: output
        };
      } catch (e) {
        blipTest = {
          success: false,
          error: e.message
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        llavaModel: modelInfo,
        blipTest: blipTest,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        stack: error.stack
      })
    };
  }
};