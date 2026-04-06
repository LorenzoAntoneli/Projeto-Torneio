
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { text, voiceId, model_id } = JSON.parse(event.body);
    const ELEVENLABS_KEY = process.env.ELEVENLABS_KEY;

    if (!ELEVENLABS_KEY) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'ELEVENLABS_KEY not found in Netlify env' }) 
      };
    }

    // Usando o fetch nativo do Node.js 18+
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_KEY.trim(),
      },
      body: JSON.stringify({
        text,
        model_id: model_id || 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        return { statusCode: response.status, body: errorText };
    }

    const arrayBuffer = await response.arrayBuffer();
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache'
      },
      body: Buffer.from(arrayBuffer).toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Internal Server Error', detail: error.message }) 
    };
  }
};
