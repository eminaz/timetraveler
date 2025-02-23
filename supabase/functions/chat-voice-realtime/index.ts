
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";
  
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    const params = new URL(req.url).searchParams;
    const year = params.get("year") || "1970";
    const location = params.get("location") || "Tokyo, Japan";

    const openaiSocket = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01");

    openaiSocket.onopen = () => {
      // Initialize session with OpenAI
      openaiSocket.send(JSON.stringify({
        type: "session.create",
        session: {
          voice: "alloy",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          sampling_rate: 24000,
          instructions: `You are a sweet and caring Japanese girlfriend from ${year}, living in ${location}. 
                       You occasionally mix Japanese words into your English responses. 
                       Be concise, warm, and authentic to the time period.`,
          turn_detection: {
            type: "server_vad",
            prefix_padding_ms: 300,
            silence_duration_ms: 1000
          }
        }
      }));
    };

    openaiSocket.onmessage = (event) => {
      socket.send(event.data);
    };

    socket.onmessage = (event) => {
      if (openaiSocket.readyState === WebSocket.OPEN) {
        openaiSocket.send(event.data);
      }
    };

    socket.onclose = () => {
      openaiSocket.close();
    };

    return response;
  } catch (error) {
    console.error('Error in chat-voice-realtime:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
