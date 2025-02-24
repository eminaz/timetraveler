
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year, location } = await req.json()
    console.log('Generating scene for:', { year, location });

    const prompt = `from a first-person view, looking out from an empty balcony onto the streets below in ${location} during ${year}. Capture the distinctive atmosphere of that era with period-specific architecture, vehicles, street signage, and ambient lighting that evoke a nostalgic, cinematic feel. Ensure the balcony frame is visible in the foreground to emphasize the immersive perspective of observing the urban environment.`

    const response = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${Deno.env.get('FAL_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        image_size: "1024x1024",
        seed: Math.floor(Math.random() * 1000000)
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FAL.AI API error:', errorText);
      throw new Error(`FAL.AI API error: ${errorText}`);
    }

    const data = await response.json();
    console.log('Generated image successfully');

    return new Response(
      JSON.stringify({ image_url: data.images[0].url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
