// netlify/functions/check-interpret.js
// Polls Supabase for interpretation job status

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const jobId = event.queryStringParameters?.id;
  
  if (!jobId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing job id' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uzamamymfzhelvkwpvgt.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config error' }) };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/firasah_jobs?job_id=eq.${jobId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }

    const jobs = await response.json();
    
    if (!jobs || jobs.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Job not found', jobId })
      };
    }

    const job = jobs[0];

    if (job.status === 'completed') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'completed',
          jobId: job.job_id,
          ...job.result,
          provider: job.provider,
          duration: job.duration_ms
        })
      };
    } else if (job.status === 'failed') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'failed',
          jobId: job.job_id,
          error: job.error
        })
      };
    } else {
      // Still processing
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'processing',
          jobId: job.job_id,
          startedAt: job.created_at
        })
      };
    }

  } catch (error) {
    console.error('Error checking job:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
