// netlify/functions/test-openai.js
// Quick test to verify OpenAI API key is working

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'OPENAI_API_KEY not found in environment',
          keyExists: false
        })
      };
    }

    // Test with a simple API call
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    });

    if (response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'OpenAI API key is valid!',
          keyPrefix: OPENAI_API_KEY.substring(0, 10) + '...'
        })
      };
    } else {
      const error = await response.json();
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: error,
          keyPrefix: OPENAI_API_KEY.substring(0, 10) + '...'
        })
      };
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
