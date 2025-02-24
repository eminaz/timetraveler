
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { year } = await req.json()

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if we already have a tone for this year range
    const baseYear = Math.floor(year / 5) * 5
    const { data: existingTone } = await supabase
      .from('ringback_tones')
      .select('audio_url')
      .eq('year', baseYear)
      .single()

    if (existingTone?.audio_url) {
      return new Response(
        JSON.stringify({ audio_url: existingTone.audio_url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate new ringback tone using fal.ai
    const response = await fetch('https://api.fal.ai/stable-audio', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${Deno.env.get('FAL_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `ringback tone in ${year}`,
        model_name: 'melody',
        duration_seconds: 5,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to generate audio')
    }

    const audioData = await response.json()

    // Save the new tone to the database
    const { error: insertError } = await supabase
      .from('ringback_tones')
      .insert([
        { 
          year: baseYear,
          audio_url: audioData.audio_url,
        }
      ])

    if (insertError) {
      throw insertError
    }

    return new Response(
      JSON.stringify({ audio_url: audioData.audio_url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
