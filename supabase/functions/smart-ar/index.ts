import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { brief, track_count, workspace_id } = await req.json();

    if (!brief || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: brief, workspace_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tracks, error: tracksError } = await supabase
      .from("tracks")
      .select("id, title, artist, genre, bpm, key, mood, voice, duration_sec, status, featuring, language")
      .eq("workspace_id", workspace_id);

    if (tracksError) {
      return new Response(
        JSON.stringify({ error: tracksError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tracks || tracks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No tracks found in workspace" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedTracks = tracks
      .map(
        (t, i) =>
          (i + 1) +
          ". [" +
          t.id +
          "] " +
          t.title +
          " - " +
          (t.artist || "Unknown") +
          " | genre: " +
          (t.genre || "N/A") +
          " | bpm: " +
          (t.bpm || "N/A") +
          " | key: " +
          (t.key || "N/A") +
          " | mood: " +
          (t.mood || "N/A") +
          " | voice: " +
          (t.voice || "N/A") +
          " | duration: " +
          (t.duration_sec || "N/A") +
          "s | status: " +
          (t.status || "N/A") +
          " | featuring: " +
          (t.featuring || "N/A") +
          " | language: " +
          (t.language || "N/A")
      )
      .join("\n");

    const selectionInstruction =
      track_count === "all"
        ? "Select ALL tracks that match the brief, ranked by relevance."
        : "Select the top " + track_count + " tracks that best match the brief, ranked by relevance.";

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + Deno.env.get("GROQ_API_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are a music A&R assistant. Given a brief and a catalog of tracks with metadata, select the best matching tracks ranked by relevance. Return valid JSON only, no markdown fences.",
          },
          {
            role: "user",
            content:
              "Brief: " +
              brief +
              "\n\nCatalog (" +
              tracks.length +
              " tracks):\n" +
              formattedTracks +
              "\n\n" +
              selectionInstruction +
              "\n\nRespond with JSON in this exact format:\n" +
              '{ "playlist_name": string, "criteria": string[], "tracks": [{ "id": string, "score": number, "reason": string }] }',
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      return new Response(
        JSON.stringify({ error: "Groq API error: " + errorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqResponse.json();
    const content = groqData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Empty response from Groq API" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
