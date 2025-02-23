
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Received request with body:', body);

    // Handle WebSocket URL generation
    if (body.action === 'get_signed_url') {
      console.log('Generating signed URL for conversation');
      const response = await fetch(
        "https://api.elevenlabs.io/v2/conversation/start",
        {
          method: "POST",
          headers: {
            'xi-api-key': Deno.env.get('ELEVEN_LABS_API_KEY') ?? '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            character: {
              name: "Japanese Girlfriend",
              description: "A sweet and caring Japanese girlfriend from the 1970s who sometimes mixes Japanese words into her English",
              voice_id: "FGY2WhTYpPnrIDTdsKH5", // Laura's voice
            },
            start_audio_config: {
              model_id: "eleven_multilingual_v2",
              enable_real_time_playback: true,
            },
            session_config: {
              allow_text_input: true,
              allow_audio_input: true,
              enable_memory: true,
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', errorText);
        throw new Error(`Failed to start conversation: ${errorText}`);
      }

      const data = await response.json();
      console.log('Successfully started conversation:', data);

      return new Response(
        JSON.stringify({ 
          signed_url: data.connection_url || data.websocket_url 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Handle direct text-to-speech requests
    if (body.text) {
      console.log('Processing text-to-speech request');
      const VOICE_ID = "FGY2WhTYpPnrIDTdsKH5" // Laura's voice ID
      const MODEL_ID = "eleven_multilingual_v2"

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': Deno.env.get('ELEVEN_LABS_API_KEY') ?? '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: body.text,
            model_id: MODEL_ID,
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75,
            }
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', errorText);
        throw new Error('Failed to generate speech');
      }

      const arrayBuffer = await response.arrayBuffer()
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      return new Response(
        JSON.stringify({ audioContent: base64Audio }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.error('Invalid request - no action or text provided');
    return new Response(
      JSON.stringify({ error: 'Invalid request - must provide either action or text' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
