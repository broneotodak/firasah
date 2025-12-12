// netlify/functions/check-prediction.js
const Replicate = require("replicate");

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const predictionId = event.queryStringParameters?.id;
  
  if (!predictionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No prediction ID provided' })
    };
  }

  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const prediction = await replicate.predictions.get(predictionId);

    // If completed, format the output
    if (prediction.status === 'succeeded') {
      const output = prediction.output;
      const analysis = Array.isArray(output) ? output.join('') : String(output);
      
      // Check for face validation failure
      if (analysis.startsWith('VALIDATION_FAILED:')) {
        const reason = analysis.replace('VALIDATION_FAILED:', '').trim();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            status: 'validation_failed',
            error: reason,
            errorType: 'invalid_face'
          })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: 'completed',
          analysis: analysis,
          model: "LLaVA v1.5 13B",
          duration: prediction.completed_at - prediction.created_at
        })
      };
    }

    // Still processing or failed
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: prediction.status !== 'failed',
        status: prediction.status,
        error: prediction.error
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to check prediction',
        details: error.message
      })
    };
  }
};