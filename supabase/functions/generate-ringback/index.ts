
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from '@supabase/supabase-js';

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

    // Generate new ringback tone using fal.ai
    const response = await fetch('https://api.fal.ai/stable-audio', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${Deno.env.get('FAL_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `phone ringback tone from ${year}, old telephone style`,
        model_name: 'melody',
        duration_seconds: 5,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate audio');
    }

    const audioData = await response.json();

    // Save the new tone to the database
    await supabase
      .from('ringback_tones')
      .insert([{ 
        year: baseYear,
        audio_url: audioData.audio_url,
      }]);

    return new Response(
      JSON.stringify({ audio_url: audioData.audio_url }),
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
