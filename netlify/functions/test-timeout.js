// netlify/functions/test-timeout.js
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

  const startTime = Date.now();

  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Test with a simple, fast model
    console.log('Starting Replicate test...');
    
    // Just list models - this should be fast
    const models = await replicate.models.list();
    
    const duration = Date.now() - startTime;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        duration: duration + 'ms',
        modelsFound: models.results.length,
        message: 'Replicate API works!'
      })
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Test failed',
        details: error.message,
        duration: duration + 'ms'
      })
    };
  }
};