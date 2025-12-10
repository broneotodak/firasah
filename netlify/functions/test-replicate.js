// netlify/functions/test-replicate.js
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  try {
    // Test 1: Check if function runs at all
    console.log('Function started');
    
    // Test 2: Check environment variable
    const hasToken = !!process.env.REPLICATE_API_TOKEN;
    console.log('Has token:', hasToken);
    
    // Test 3: Try to load Replicate
    let replicateLoaded = false;
    try {
      const Replicate = require("replicate");
      replicateLoaded = true;
      console.log('Replicate loaded successfully');
    } catch (err) {
      console.error('Failed to load Replicate:', err.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Test successful',
        hasToken,
        replicateLoaded,
        tokenLength: process.env.REPLICATE_API_TOKEN ? process.env.REPLICATE_API_TOKEN.length : 0
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Test failed',
        details: error.message
      })
    };
  }
};