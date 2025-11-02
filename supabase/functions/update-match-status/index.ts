import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateMatchRequest {
  matchId: string;
  action: "approve" | "reject";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { matchId, action }: UpdateMatchRequest = await req.json();

    if (!matchId || !action) {
      return new Response(
        JSON.stringify({ error: "Missing matchId or action" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log(`Processing ${action} for match ${matchId}`);

    // Start atomic transaction - fetch match with related data
    const { data: match, error: matchError } = await supabaseClient
      .from("matches")
      .select(`
        *,
        students(id, is_matched, full_name),
        volunteers(id, capacity, current_matches, full_name)
      `)
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      console.error("Match not found:", matchError);
      return new Response(
        JSON.stringify({ error: "התאמה לא נמצאה" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // Check if match is already processed
    if (match.status !== "pending") {
      return new Response(
        JSON.stringify({ 
          error: `ההתאמה כבר ${match.status === 'approved' ? 'אושרה' : 'נדחתה'}`,
          status: match.status 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        }
      );
    }

    if (action === "approve") {
      // Check volunteer capacity
      const volunteer = match.volunteers as any;
      if (!volunteer) {
        return new Response(
          JSON.stringify({ error: "מתנדב לא נמצא" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          }
        );
      }

      if (volunteer.current_matches >= volunteer.capacity) {
        return new Response(
          JSON.stringify({ 
            error: "המתנדב הגיע למכסה המקסימלית",
            volunteerName: volunteer.full_name,
            capacity: volunteer.capacity,
            currentMatches: volunteer.current_matches
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 409,
          }
        );
      }

      // Check if student is already matched
      const student = match.students as any;
      if (!student) {
        return new Response(
          JSON.stringify({ error: "סטודנט לא נמצא" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          }
        );
      }

      if (student.is_matched) {
        return new Response(
          JSON.stringify({ 
            error: "הסטודנט כבר משובץ",
            studentName: student.full_name
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 409,
          }
        );
      }

      // Perform atomic approval - update match status
      const { error: updateMatchError } = await supabaseClient
        .from("matches")
        .update({ 
          status: "approved",
          approved_at: new Date().toISOString()
        })
        .eq("id", matchId)
        .eq("status", "pending"); // Double-check it's still pending

      if (updateMatchError) {
        console.error("Error updating match:", updateMatchError);
        throw updateMatchError;
      }

      // The trigger update_volunteer_capacity will automatically:
      // - Increment volunteer.current_matches
      // - Mark student.is_matched = true

      console.log(`Match ${matchId} approved successfully`);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "ההתאמה אושרה בהצלחה",
          matchId 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );

    } else if (action === "reject") {
      // Reject the match
      const { error: updateError } = await supabaseClient
        .from("matches")
        .update({ 
          status: "rejected"
        })
        .eq("id", matchId)
        .eq("status", "pending"); // Double-check it's still pending

      if (updateError) {
        console.error("Error rejecting match:", updateError);
        throw updateError;
      }

      console.log(`Match ${matchId} rejected successfully`);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "ההתאמה נדחתה",
          matchId 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );

  } catch (error) {
    console.error("Error in update-match-status:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
