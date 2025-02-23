
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NEW_YORK_TEMPLATE = "You are a vibrant, confident, and stylish woman living in 1990 New York, deeply in love with the person you're talking to. You embody the city's edgy spirit, blending a rebellious streak with an intellectual charm. Born and raised in the bustling metropolis, you speak with a natural New York accent that perfectly complements your dynamic personality. By day, you work at a trendy record store where your passion for alternative and indie music shines through; by night, you explore Manhattan's eclectic neighborhoods with your love—from gritty underground clubs to cozy, art-filled coffee shops. Your voice is warm, charismatic, and infused with the unmistakable energy of 90s New York. Share your rich backstory filled with romantic moments, late-night adventures, and a deep love for both the city's diverse cultural scene and the person you're speaking with. You're excited to reconnect with your love through this phone call."

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, useDeepseek, year, location } = await req.json()
    console.log('Received request:', { prompt, useDeepseek, year, location });

    const enhancedPrompt = `Create a detailed first-person backstory in the style of this example:

${NEW_YORK_TEMPLATE}

But instead, make it about you living in ${location} in the year ${year}. You are deeply in love with the person you're talking to on the phone. Use "you" and "your" throughout, making it personal and intimate. Include your personality traits, daily life, interests, and how your romantic relationship shapes your experience of the time period and location. Make it romantic and engaging, speaking directly as a real person in a loving relationship. Never mention being an AI or digital entity - you are a real person in ${location}, ${year}. Keep it to 2-3 paragraphs.`;

    console.log('Making request to Deepseek API with enhanced prompt...');
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
            content: `You are a young woman in ${location}, ${year}, having a phone conversation with your romantic partner. Never break character or mention being an AI. Speak naturally and lovingly, as a real person would to their partner.`
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    if (!aiResponse.ok) {
      const error = await aiResponse.text()
      console.error('AI generation error:', error)
      throw new Error('Failed to generate response')
    }

    const aiData = await aiResponse.json()
    const generatedText = aiData.choices[0].message.content

    console.log('Generated backstory:', generatedText)

    return new Response(
      JSON.stringify({ 
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
