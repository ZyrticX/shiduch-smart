import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Student {
  id: string;
  full_name: string;
  city: string;
  native_language: string;
  gender: string | null;
  special_requests: string | null;
  latitude: number | null;
  longitude: number | null;
  is_matched: boolean;
}

interface Volunteer {
  id: string;
  full_name: string;
  city: string;
  native_language: string;
  gender: string | null;
  capacity: number;
  current_matches: number;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate match score based on criteria
function calculateMatchScore(
  student: Student,
  volunteer: Volunteer,
  distance: number
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Language match (60 points)
  if (student.native_language === volunteer.native_language) {
    score += 60;
    reasons.push(`שפת אם זהה (${student.native_language})`);
  }

  // City/Distance match (40 points for same city, 20 for nearby <150km)
  if (distance === 0) {
    score += 40;
    reasons.push(`אותה עיר (${student.city})`);
  } else if (distance <= 150) {
    score += 20;
    reasons.push(`עיר סמוכה (${distance.toFixed(0)} ק"מ)`);
  }

  // Gender match (15 points)
  if (student.gender && volunteer.gender && student.gender === volunteer.gender) {
    score += 15;
    reasons.push("התאמת מין");
  }

  // Special requests match (5 points)
  if (student.special_requests && volunteer.native_language) {
    const requestLower = student.special_requests.toLowerCase();
    const volLangLower = volunteer.native_language.toLowerCase();
    if (requestLower.includes(volLangLower) || requestLower.includes("דובר")) {
      score += 5;
      reasons.push("התאמה לבקשות מיוחדות");
    }
  }

  // Cap at 100
  score = Math.min(score, 100);

  const reason = reasons.length > 0 
    ? `התאמה ${score >= 90 ? 'מצוינת' : score >= 80 ? 'טובה מאוד' : score >= 70 ? 'טובה' : 'סבירה'}: ${reasons.join(', ')}`
    : `ציון התאמה: ${score}`;

  return { score, reason };
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

    const { minScore = 60, limit = 100 } = await req.json().catch(() => ({}));

    console.log("Starting match generation...");

    // Load unmatched students
    const { data: students, error: studentsError } = await supabaseClient
      .from("students")
      .select("*")
      .eq("is_matched", false);

    if (studentsError) {
      console.error("Error loading students:", studentsError);
      throw studentsError;
    }

    // Load active volunteers with available capacity
    const { data: volunteers, error: volunteersError } = await supabaseClient
      .from("volunteers")
      .select("*")
      .eq("is_active", true);

    if (volunteersError) {
      console.error("Error loading volunteers:", volunteersError);
      throw volunteersError;
    }

    // Filter volunteers with available capacity
    const availableVolunteers = volunteers.filter(
      (v: Volunteer) => v.current_matches < v.capacity
    );

    console.log(`Found ${students.length} unmatched students`);
    console.log(`Found ${availableVolunteers.length} available volunteers`);

    if (students.length === 0 || availableVolunteers.length === 0) {
      return new Response(
        JSON.stringify({ 
          suggestedCount: 0,
          message: students.length === 0 
            ? "אין סטודנטים ממתינים" 
            : "אין מתנדבים זמינים"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Generate matches
    const matches = [];
    const usedStudents = new Set<string>();
    const volunteerCapacity = new Map<string, number>();

    // Initialize volunteer capacity tracking
    availableVolunteers.forEach((v: Volunteer) => {
      volunteerCapacity.set(v.id, v.capacity - v.current_matches);
    });

    // Calculate all possible matches
    const possibleMatches = [];
    for (const student of students as Student[]) {
      for (const volunteer of availableVolunteers as Volunteer[]) {
        // Calculate distance
        let distance = 0;
        if (
          student.latitude &&
          student.longitude &&
          volunteer.latitude &&
          volunteer.longitude
        ) {
          distance = calculateDistance(
            student.latitude,
            student.longitude,
            volunteer.latitude,
            volunteer.longitude
          );
        }

        // Skip if distance > 150km
        if (distance > 150 && distance !== 0) {
          continue;
        }

        const { score, reason } = calculateMatchScore(student, volunteer, distance);

        // Skip if below minimum score
        if (score < minScore) {
          continue;
        }

        possibleMatches.push({
          student_id: student.id,
          volunteer_id: volunteer.id,
          score,
          reason,
          distance,
        });
      }
    }

    // Sort by score (highest first)
    possibleMatches.sort((a, b) => b.score - a.score);

    console.log(`Generated ${possibleMatches.length} possible matches`);

    // Greedy allocation - assign best matches first
    for (const match of possibleMatches) {
      // Skip if student already matched
      if (usedStudents.has(match.student_id)) {
        continue;
      }

      // Check volunteer capacity
      const capacity = volunteerCapacity.get(match.volunteer_id) || 0;
      if (capacity <= 0) {
        continue;
      }

      // Check if match already exists
      const { data: existingMatch } = await supabaseClient
        .from("matches")
        .select("id")
        .eq("student_id", match.student_id)
        .eq("volunteer_id", match.volunteer_id)
        .maybeSingle();

      if (!existingMatch) {
        matches.push({
          student_id: match.student_id,
          volunteer_id: match.volunteer_id,
          confidence_score: match.score,
          match_reason: match.reason,
          status: "pending",
        });

        usedStudents.add(match.student_id);
        volunteerCapacity.set(match.volunteer_id, capacity - 1);

        // Stop if we reached the limit
        if (matches.length >= limit) {
          break;
        }
      }
    }

    console.log(`Creating ${matches.length} new matches`);

    // Insert matches into database
    if (matches.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("matches")
        .insert(matches);

      if (insertError) {
        console.error("Error inserting matches:", insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({
        suggestedCount: matches.length,
        message: `נוצרו ${matches.length} התאמות חדשות בהצלחה`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in generate-matches:", error);
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
