
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year } = await req.json();

    // Check if we already have a tone for this year range in the database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Round year to nearest 5 to reduce number of unique tones needed
    const baseYear = Math.floor(year / 5) * 5;
    
    const { data: existingTone } = await supabase
      .from('ringback_tones')
      .select('audio_url')
      .eq('year', baseYear)
      .single();

    if (existingTone?.audio_url) {
      return new Response(
        JSON.stringify({ audio_url: existingTone.audio_url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate new ringback tone using fal.ai queue API
    const queueResponse = await fetch('https://queue.fal.run/fal-ai/stable-audio', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${Deno.env.get('FAL_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `phone ringback tone from ${year}, old telephone style`,
      }),
    });

    if (!queueResponse.ok) {
      const errorData = await queueResponse.text();
      console.error('Fal.ai queue API error:', errorData);
      throw new Error(`Failed to queue audio generation: ${errorData}`);
    }

    const queueData = await queueResponse.json();
    console.log('Queue response:', queueData);

    if (!queueData.request_id) {
      throw new Error('No request ID in queue response');
    }

    // Poll for the result
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    let resultData = null;

    while (attempts < maxAttempts) {
      const resultResponse = await fetch(`https://queue.fal.run/fal-ai/stable-audio/status/${queueData.request_id}`, {
        headers: {
          'Authorization': `Key ${Deno.env.get('FAL_KEY')}`,
        },
      });

      if (!resultResponse.ok) {
        console.error('Error checking status:', await resultResponse.text());
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;
        continue;
      }

      const status = await resultResponse.json();
      console.log('Status response:', status);

      if (status.status === 'COMPLETED' && status.output?.audio_url) {
        resultData = status.output;
        break;
      } else if (status.status === 'FAILED') {
        throw new Error('Audio generation failed: ' + status.error);
      }

      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      attempts++;
    }

    if (!resultData?.audio_url) {
      throw new Error('Failed to get audio URL after maximum attempts');
    }

    // Save the new tone to the database
    await supabase
      .from('ringback_tones')
      .insert([{ 
        year: baseYear,
        audio_url: resultData.audio_url,
      }]);

    return new Response(
      JSON.stringify({ audio_url: resultData.audio_url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-ringback function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
