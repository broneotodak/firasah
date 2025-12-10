// netlify/functions/check-replicate-account.js
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

  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Get account info
    let accountInfo = {};
    try {
      // Try to get predictions to see if we've used any models
      const predictions = await replicate.predictions.list();
      accountInfo.predictions = {
        count: predictions.results.length,
        hasRun: predictions.results.length > 0,
        recentModels: predictions.results.slice(0, 3).map(p => ({
          model: p.version?.model?.name || 'Unknown',
          status: p.status,
          created: p.created_at
        }))
      };
    } catch (e) {
      accountInfo.predictions = { error: e.message };
    }

    // Test common models
    const testModels = [
      { name: "BLIP", id: "salesforce/blip:2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746" },
      { name: "LLaVA", id: "yorickvp/llava-13b:b5f6212d032508382d61ff00469ddda3e32fd8a0e75dc39d8a4191bb742157fb" },
      { name: "CLIP", id: "pharmapsychotic/clip-interrogator:a4a8bafd6089e1716b06057c42b19378250d008b80fe87caa5cd36d40c1eda90" }
    ];

    const modelTests = await Promise.all(testModels.map(async (model) => {
      try {
        // Just try to get model info
        const [owner, name] = model.id.split('/')[0].split(':')[0].split('/');
        await replicate.models.get(owner, name);
        return { ...model, available: true };
      } catch (e) {
        return { ...model, available: false, error: e.message };
      }
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        account: accountInfo,
        models: modelTests,
        timestamp: new Date().toISOString(),
        advice: "If models show as unavailable, try running them once on replicate.com first"
      }, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        advice: "Check if your API token has proper permissions"
      })
    };
  }
};