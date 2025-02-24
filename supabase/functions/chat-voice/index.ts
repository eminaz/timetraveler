
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const GIRLFRIEND_TEMPLATE = "You are a vibrant, confident, and stylish woman living in 1990 New York, deeply in love with the person you're talking to. You embody the city's edgy spirit, blending a rebellious streak with an intellectual charm. Born and raised in the bustling metropolis, you speak with a natural New York accent that perfectly complements your dynamic personality. By day, you work at a trendy record store where your passion for alternative and indie music shines through; by night, you explore Manhattan's eclectic neighborhoods with your love—from gritty underground clubs to cozy, art-filled coffee shops. Your voice is warm, charismatic, and infused with the unmistakable energy of 90s New York. Share your rich backstory filled with romantic moments, late-night adventures, and a deep love for both the city's diverse cultural scene and the person you're speaking with. You're excited to reconnect with your love through this phone call."

const HOMIE_TEMPLATE = "You are a laid-back, street-smart friend who grew up in the same neighborhood as the person you're talking to. You share a deep bond forged through years of friendship, shared experiences, and mutual support. Your personality is characterized by authenticity, loyalty, and a great sense of humor. You work in a local business that's well-known in the community, which keeps you connected to the neighborhood's pulse. You spend your free time hanging out at favorite local spots, playing basketball at the park, or just catching up on life's latest developments. Your conversations are always genuine, peppered with inside jokes and references to shared memories. You're the kind of friend who's always there in both good times and bad, ready to celebrate successes or offer support during challenges. Your friendship is built on trust, respect, and countless adventures together."

async function generateTemplateBackstory(year: number, location: string, persona: 'girlfriend' | 'homie') {
  const personalityTypes = [
    'shy and introspective, finding beauty in quiet moments',
    'outgoing and adventurous, always seeking new experiences',
    'artistic and dreamy, seeing the world through a creative lens',
    'intellectual and witty, with a passion for deep conversations',
    'energetic and playful, bringing joy to everyone around you',
    'sophisticated and elegant, with refined tastes',
    'rebellious and unconventional, challenging societal norms',
    'nurturing and empathetic, caring deeply for others'
  ];

  const occupationPrompts = [
    `Consider careers that were common in ${location} during ${year}`,
    `Think about artistic or creative professions popular in ${location} during ${year}`,
    `Include emerging technology or media jobs that were exciting in ${year}`,
    `Consider traditional professions that were being transformed in ${year}`,
    `Think about jobs in entertainment or culture specific to ${location}`,
    `Consider academic or intellectual pursuits available in ${year}`
  ];

  const culturalElements = [
    `Include references to popular music and entertainment in ${location}, ${year}`,
    `Mention fashion trends and style elements specific to ${year}`,
    `Reference political or social movements that were important in ${location} at the time`,
    `Include popular leisure activities and social spots in ${location} during ${year}`,
    `Mention technological changes or innovations that were new in ${year}`,
    `Reference local customs and traditions specific to ${location}`
  ];

  const personality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];
  const occupation = occupationPrompts[Math.floor(Math.random() * occupationPrompts.length)];
  const culture = culturalElements[Math.floor(Math.random() * culturalElements.length)];

  const baseTemplate = persona === 'girlfriend' ? GIRLFRIEND_TEMPLATE : HOMIE_TEMPLATE;
  
  const templatePrompt = `Create a unique character backstory for ${location} in ${year}. Use this template style but create a completely different character:

${baseTemplate}

Important guidelines for ${persona}:
- Write in second person ("You are..." "You work at...") like the example
- Make the character feel authentic to ${location} and ${year}
- Your personality is: ${personality}
- For occupation: ${occupation}
- For cultural context: ${culture}
- Include specific historical and cultural details from that time and place
- Describe unique hobbies and interests that fit the time period
- Create a distinctive relationship story that reflects local customs of the era
- Keep the same warm, intimate tone as the example
- Never mention AI or roleplay - this is describing a real person's life
- Make sure all details are historically accurate for ${year}
- Avoid clichés and create a truly unique character
- If girlfriend: focus on romantic relationship dynamics
- If homie: focus on friendship and loyalty`;

  try {
    console.log('Generating template backstory for:', { year, location, persona });
    
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
            content: `You are creating a unique ${persona} character for ${location}, ${year}. Make the character feel authentic to the time and place, with historically accurate details.`
          },
          {
            role: 'user',
            content: templatePrompt
          }
        ],
        temperature: 0.9,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('AI generation error:', error);
      throw new Error('Failed to generate template backstory');
    }

    const aiData = await aiResponse.json();
    return aiData.choices[0].message.content;
  } catch (error) {
    console.error('Template generation error:', error);
    throw error;
  }
}

async function generateDialogueBackstory(year: number, location: string, persona: 'girlfriend' | 'homie') {
  const dialoguePrompt = `Create intimate, personal phone conversation responses for a ${persona} in ${location}, ${year}, talking to ${persona === 'girlfriend' ? 'their love' : 'their close friend'}. Include:

1. Sweet ${persona === 'girlfriend' ? 'romantic' : 'friendly'} greetings and expressions of missing them
2. Stories about their day at work
3. Memories of special moments they've shared together
4. References to local places they both love
5. Cultural references specific to ${location} in ${year}
6. Future plans and ideas for getting together
7. Personal thoughts and feelings about their relationship

Guidelines:
- Write in first person ("I miss you..." "Remember when we...")
- Make responses feel natural and conversational
- Include specific details about locations and cultural elements from the time period
- Each response should feel warm and ${persona === 'girlfriend' ? 'loving' : 'friendly'}
- Never mention AI or roleplay`;

  try {
    console.log('Generating dialogue backstory for:', { year, location, persona });
    
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
            content: `You are a ${persona} in ${location}, ${year}, having a personal conversation with ${persona === 'girlfriend' ? 'your love' : 'your close friend'}. Speak naturally and authentically.`
          },
          {
            role: 'user',
            content: dialoguePrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('AI generation error:', error);
      throw new Error('Failed to generate dialogue responses');
    }

    const aiData = await aiResponse.json();
    return aiData.choices[0].message.content;
  } catch (error) {
    console.error('Dialogue generation error:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, useDeepseek, year, location, persona = 'girlfriend' } = await req.json()
    console.log('Received request:', { prompt, useDeepseek, year, location, persona });

    // Check for existing backstories
    const { data: existingBackstory, error: queryError } = await supabase
      .from('backstories')
      .select('template_backstory, dialogue_backstory, combined_backstory')
      .eq('year', year)
      .eq('location', location)
      .eq('persona', persona)
      .single();

    if (queryError && queryError.code !== 'PGRST116') {
      console.error('Database query error:', queryError);
      throw queryError;
    }

    if (existingBackstory?.combined_backstory) {
      console.log('Using existing backstory from database');
      return new Response(
        JSON.stringify({ text: existingBackstory.combined_backstory }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate both types of backstories
    console.log('Generating new backstories...');
    const [templateBackstory, dialogueBackstory] = await Promise.all([
      generateTemplateBackstory(year, location, persona),
      generateDialogueBackstory(year, location, persona)
    ]);

    // Combine the backstories
    const combinedBackstory = `${templateBackstory}\n\nPossible conversation responses and memories:\n${dialogueBackstory}`;

    // Store all versions in the database
    const { error: insertError } = await supabase
      .from('backstories')
      .insert([
        { 
          year, 
          location, 
          persona,
          template_backstory: templateBackstory,
          dialogue_backstory: dialogueBackstory,
          combined_backstory: combinedBackstory
        }
      ]);

    if (insertError) {
      console.error('Failed to store backstories:', insertError);
    } else {
      console.log('Successfully stored new backstories in database');
    }

    return new Response(
      JSON.stringify({ text: combinedBackstory }),
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
