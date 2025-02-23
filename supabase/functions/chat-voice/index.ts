
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
    const { action } = await req.json()

    if (action === 'get_signed_url') {
      // Generate signed URL for conversation using the provided agent_id
      const response = await fetch(
        "https://api.elevenlabs.io/v1/conversation/get_signed_url?agent_id=8N0GDbdmFxk25bHMHXdr",
        {
          method: "GET",
          headers: {
            'xi-api-key': Deno.env.get('ELEVEN_LABS_API_KEY') ?? '',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate signed URL');
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ signed_url: data.signed_url }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
