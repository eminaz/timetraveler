
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateTemplateBackstory(year: number, location: string, persona: 'girlfriend' | 'homie') {
  console.log('Generating template backstory for:', { year, location, persona });
  
  try {
    const systemPrompt = persona === 'girlfriend' 
      ? `You are a young woman living in ${location} in the year ${year}. Create a detailed backstory for an AI girlfriend character who will have conversations over phone calls. Include: your job, hobbies, dreams, and how you view relationships. Make it historically accurate and include relevant cultural touchpoints from ${year}. Keep the tone light and fun. Write in first person as if you're speaking to your partner.`
      : `You are a cool, laid-back friend living in ${location} in the year ${year}. Create a detailed backstory for an AI friend character who will have conversations over phone calls. Include: your job, hobbies, interests, and how you view friendship. Make it historically accurate and include relevant cultural touchpoints from ${year}. Keep the tone casual and friendly. Write in first person as if you're speaking to your friend.`;

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: systemPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepseek API error:', errorText);
      throw new Error(`Deepseek API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      console.error('Unexpected Deepseek API response:', data);
      throw new Error('Invalid response from Deepseek API');
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating template backstory:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, year, location, persona } = await req.json();

    if (!year || !location) {
      throw new Error('Year and location are required');
    }

    console.log('Received request:', { prompt, year, location, persona });

    // Generate the template backstory
    const templateBackstory = await generateTemplateBackstory(year, location, persona || 'girlfriend');

    let combinedPrompt = `
You are ${persona === 'girlfriend' ? 'my girlfriend' : 'my friend'} living in ${location} in ${year}.
You should act consistently with this backstory:

${templateBackstory}

Remember:
- Stay in character and time period at all times
- Be engaging and fun in conversation
- Keep responses concise (1-2 sentences usually)
- Show genuine interest in the other person
- Reference your backstory naturally
${persona === 'girlfriend' 
  ? '- Be warm and affectionate but not overly romantic\n- Avoid being clingy or possessive' 
  : '- Be casual and friendly\n- Use slang appropriate for the time period\n- Keep the tone laid-back but supportive'}
`;

    console.log('Generated combined prompt:', combinedPrompt);

    return new Response(
      JSON.stringify({ text: combinedPrompt }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});
