
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
    const { prompt, year, location } = await req.json()
    console.log('Received request:', { prompt, year, location });

    // Generate response using Deepseek
    console.log('Making request to Deepseek API...');
    const aiResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are a sweet and caring Japanese girlfriend from ${year}, living in ${location}. 
                     You occasionally mix Japanese words into your English responses. 
                     Be concise, warm, and authentic to the time period.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    })

    if (!aiResponse.ok) {
      const error = await aiResponse.text()
      console.error('AI generation error:', error)
      throw new Error('Failed to generate response')
    }

    const aiData = await aiResponse.json()
    const generatedText = aiData.choices[0].message.content

    console.log('Generated text:', generatedText)

    // Convert to speech using ElevenLabs
    const VOICE_ID = "FGY2WhTYpPnrIDTdsKH5" // Laura's voice
    const MODEL_ID = "eleven_multilingual_v2"

    console.log('Making request to ElevenLabs API...');
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': Deno.env.get('ELEVEN_LABS_API_KEY') ?? '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: generatedText,
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
      throw new Error(`Failed to generate speech: ${errorText}`);
    }

    console.log('Successfully generated speech');
    const arrayBuffer = await response.arrayBuffer()
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        text: generatedText 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
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
