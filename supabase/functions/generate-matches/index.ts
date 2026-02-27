import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

interface User {
  id: string;
  full_name: string;
  city: string;
  native_language: string;
  gender: string | null;
  capacity_max: number;
  current_students: number;
  latitude: number | null;
  longitude: number | null;
  scholarship_active: boolean;
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

// Check if student has no gender preference (from special_requests field)
const NO_GENDER_PREFERENCE_PATTERNS = [
  'אין העדפה', 'ללא העדפה', 'לא משנה', 'לא חשוב',
  'אין לי העדפה', 'ללא העדפת מין', 'לא משנה מין',
  'no preference', 'any gender', "doesn't matter",
  'אין העדפה למין', 'ללא העדפה למין'
];

function hasNoGenderPreference(specialRequests: string | null): boolean {
  if (!specialRequests) return false;
  const lower = specialRequests.toLowerCase();
  return NO_GENDER_PREFERENCE_PATTERNS.some(p => lower.includes(p));
}

/**
 * New scoring algorithm based on the decision table:
 *
 * The distance score (0-100%) is the BASE. Gender + Language act as MULTIPLIERS:
 *
 * | Gender | Language | Available | Result                                    |
 * |--------|----------|-----------|-------------------------------------------|
 * |   ✅   |   ✅     |    ✅     | finalScore = distanceScore (max ~88%)      |
 * |   ❌   |   ✅     |    ✅     | finalScore = distanceScore * 0.70 (max ~65%)|
 * |   ✅   |   ❌     |    ✅     | finalScore = distanceScore * 0.55 (max ~50%)|
 * |   ✅   |   ✅     |    ❌     | NO MATCH (user has no capacity)            |
 * |   ❌   |   ❌     |    ✅     | NO MATCH (no gender + no language)          |
 *
 * Distance score: 100% = same city (0 km), 0% = max distance, linear scale.
 * "No gender preference" in special_requests counts as gender match.
 * Tie-breaker: prefer volunteer with fewer current students.
 */
function calculateMatchScore(
  student: Student,
  user: User,
  distance: number,
  maxDistanceKm: number
): { score: number; reason: string; skip: boolean; skipReason: string } {
  const reasons: string[] = [];

  // --- Check gender match ---
  const studentNoPreference = hasNoGenderPreference(student.special_requests);
  const genderMatch = studentNoPreference ||
    (student.gender != null && user.gender != null && student.gender === user.gender);

  if (studentNoPreference) {
    reasons.push("אין העדפת מין");
  } else if (genderMatch) {
    reasons.push("התאמת מין");
  }

  // --- Check language match ---
  const languageMatch = student.native_language != null &&
    user.native_language != null &&
    student.native_language === user.native_language;

  if (languageMatch) {
    reasons.push(`שפת אם זהה (${student.native_language})`);
  }

  // --- RULE: No gender AND no language = NO MATCH ---
  if (!genderMatch && !languageMatch) {
    return {
      score: 0,
      reason: "אין התאמת מגדר ואין התאמת שפה",
      skip: true,
      skipReason: "no_gender_no_language",
    };
  }

  // --- Calculate distance score (100% = same city, 0% = maxDistance) ---
  let distanceScore: number;
  if (distance <= 0) {
    distanceScore = 100;
    reasons.push(`אותה עיר (${student.city})`);
  } else if (distance >= maxDistanceKm) {
    distanceScore = 0;
    reasons.push(`ערים רחוקות (${distance.toFixed(0)} ק"מ)`);
  } else {
    // Linear interpolation: 0 km → 100%, maxDistanceKm → 0%
    distanceScore = Math.round(100 * (1 - distance / maxDistanceKm));
    reasons.push(`מרחק ${distance.toFixed(0)} ק"מ (${distanceScore}%)`);
  }

  // --- Apply multiplier based on gender + language ---
  let multiplier: number;
  let tier: string;

  if (genderMatch && languageMatch) {
    // Best case: both match → score ≈ distanceScore (cap at 88%)
    multiplier = 0.88;
    tier = "מגדר + שפה";
  } else if (!genderMatch && languageMatch) {
    // Language only → reduced score (cap at ~65%)
    multiplier = 0.65;
    tier = "שפה בלבד";
  } else {
    // Gender only → further reduced (cap at ~55%)
    multiplier = 0.55;
    tier = "מגדר בלבד";
  }

  const finalScore = Math.round(distanceScore * multiplier);
  reasons.push(`קטגוריה: ${tier}`);

  // Build reason string
  const matchQuality = finalScore >= 80 ? 'מצוינת' : finalScore >= 60 ? 'טובה' : finalScore >= 40 ? 'סבירה' : 'נמוכה';
  const reason = `התאמה ${matchQuality} (${finalScore}%) - ${reasons.join(' • ')}`;

  return { score: finalScore, reason, skip: false, skipReason: "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Load settings from database
    const { data: settingsData, error: settingsError } = await supabaseClient
      .from("settings")
      .select("key, value");

    if (settingsError) {
      console.error("Error loading settings:", settingsError);
    }

    const settings: Record<string, string> = {};
    if (settingsData) {
      settingsData.forEach((s) => {
        settings[s.key] = s.value;
      });
    }

    // Configurable parameters
    const maxDistanceKm = parseInt(settings.nearby_city_distance_km || "150", 10);
    const minScore = parseInt(settings.min_match_score || "30", 10);
    const limit = parseInt(settings.max_matches_limit || "100", 10);

    const { minScore: reqMinScore, limit: reqLimit } = await req.json().catch(() => ({}));
    const finalMinScore = reqMinScore || minScore;
    const finalLimit = reqLimit || limit;

    console.log("Starting match generation...");
    console.log(`Settings: maxDistanceKm=${maxDistanceKm}, minScore=${finalMinScore}, limit=${finalLimit}`);

    // Load unmatched students
    const { data: students, error: studentsError } = await supabaseClient
      .from("students")
      .select("*")
      .eq("is_matched", false);

    if (studentsError) {
      console.error("Error loading students:", studentsError);
      throw studentsError;
    }

    // Load active users
    const { data: users, error: usersError } = await supabaseClient
      .from("users")
      .select("*")
      .eq("is_active", true);

    if (usersError) {
      console.error("Error loading users:", usersError);
      throw usersError;
    }

    console.log(`Found ${students.length} unmatched students, ${users.length} active users`);

    // Filter users: must have capacity AND scholarship active
    const availableUsers = users.filter((u: User) => {
      const hasCapacity = u.current_students < u.capacity_max;
      const hasScholarship = u.scholarship_active !== false;
      return hasCapacity && hasScholarship;
    });

    console.log(`Available users after filtering: ${availableUsers.length}`);

    if (students.length === 0 || availableUsers.length === 0) {
      return new Response(
        JSON.stringify({
          suggestedCount: 0,
          message: students.length === 0
            ? "אין סטודנטים ממתינים (כולם כבר משובצים או שאין נתונים)"
            : `אין משתמשים זמינים (נמצאו ${users.length} משתמשים אך אף אחד לא עומד בתנאי הקיבולת והמלגה)`,
          debug: {
            studentsCount: students.length,
            usersCount: users.length,
            availableUsersCount: availableUsers.length,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Track capacity and suggestion limits
    const userCapacity = new Map<string, number>();
    const userSuggestedMatches = new Map<string, number>();
    const studentSuggestedMatches = new Map<string, number>();

    availableUsers.forEach((u: User) => {
      userCapacity.set(u.id, u.capacity_max - u.current_students);
      userSuggestedMatches.set(u.id, 0);
    });

    students.forEach((s: Student) => {
      studentSuggestedMatches.set(s.id, 0);
    });

    // Count existing suggested matches
    const { data: existingSuggestedMatches } = await supabaseClient
      .from("matches")
      .select("user_id, student_id")
      .eq("status", "Suggested");

    if (existingSuggestedMatches) {
      existingSuggestedMatches.forEach((match: any) => {
        const uc = userSuggestedMatches.get(match.user_id) || 0;
        userSuggestedMatches.set(match.user_id, uc + 1);
        const sc = studentSuggestedMatches.get(match.student_id) || 0;
        studentSuggestedMatches.set(match.student_id, sc + 1);
      });
    }

    // --- Calculate all possible matches ---
    const possibleMatches = [];
    let skippedNoGenderNoLang = 0;
    let skippedByScore = 0;
    let skippedByDistance = 0;

    for (const student of students as Student[]) {
      for (const user of availableUsers as User[]) {
        if (student.id === user.id) continue;

        // Calculate distance
        let distance = -1; // -1 means unknown
        if (
          student.latitude && student.longitude &&
          user.latitude && user.longitude
        ) {
          distance = calculateDistance(
            Number(student.latitude), Number(student.longitude),
            Number(user.latitude), Number(user.longitude)
          );

          // Skip if too far
          if (distance > maxDistanceKm) {
            skippedByDistance++;
            continue;
          }
        } else {
          // No coordinates - compare city names
          const sc = (student.city || '').trim().toLowerCase();
          const uc = (user.city || '').trim().toLowerCase();
          if (sc === uc && sc !== '' && sc !== 'לא צוין') {
            distance = 0;
          } else {
            distance = maxDistanceKm + 1;
            skippedByDistance++;
            continue;
          }
        }

        const { score, reason, skip, skipReason } = calculateMatchScore(
          student, user, distance, maxDistanceKm
        );

        if (skip) {
          if (skipReason === "no_gender_no_language") skippedNoGenderNoLang++;
          continue;
        }

        if (score < finalMinScore) {
          skippedByScore++;
          continue;
        }

        // Include current_students for tie-breaking (prefer volunteer with fewer students)
        possibleMatches.push({
          student_id: student.id,
          user_id: user.id,
          score,
          reason,
          distance,
          userCurrentStudents: user.current_students,
        });
      }
    }

    console.log(`Pairs checked: ${students.length * availableUsers.length}`);
    console.log(`Skipped - no gender & no language: ${skippedNoGenderNoLang}`);
    console.log(`Skipped - distance too far: ${skippedByDistance}`);
    console.log(`Skipped - below min score (${finalMinScore}): ${skippedByScore}`);
    console.log(`Possible matches: ${possibleMatches.length}`);

    // Sort: highest score first, then prefer volunteer with FEWER current students
    possibleMatches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.userCurrentStudents - b.userCurrentStudents; // fewer students = higher priority
    });

    // --- Greedy allocation ---
    const MAX_SUGGESTED_PER_STUDENT = 3;
    const MAX_SUGGESTED_PER_USER = 5;
    const matches = [];
    let skippedByStudentLimit = 0;
    let skippedByUserLimit = 0;
    let skippedByExisting = 0;

    for (const match of possibleMatches) {
      const capacity = userCapacity.get(match.user_id) || 0;
      if (capacity <= 0) continue;

      const studentCount = studentSuggestedMatches.get(match.student_id) || 0;
      if (studentCount >= MAX_SUGGESTED_PER_STUDENT) {
        skippedByStudentLimit++;
        continue;
      }

      const userCount = userSuggestedMatches.get(match.user_id) || 0;
      if (userCount >= MAX_SUGGESTED_PER_USER) {
        skippedByUserLimit++;
        continue;
      }

      // Check if match already exists
      const { data: existingMatch } = await supabaseClient
        .from("matches")
        .select("id")
        .eq("student_id", match.student_id)
        .eq("user_id", match.user_id)
        .maybeSingle();

      if (existingMatch) {
        skippedByExisting++;
        continue;
      }

      matches.push({
        student_id: match.student_id,
        user_id: match.user_id,
        confidence_score: match.score,
        match_reason: match.reason,
        status: "Suggested",
      });

      studentSuggestedMatches.set(match.student_id, studentCount + 1);
      userSuggestedMatches.set(match.user_id, userCount + 1);

      if (matches.length >= finalLimit) break;
    }

    console.log(`New matches: ${matches.length}`);
    console.log(`Skipped - student limit (${MAX_SUGGESTED_PER_STUDENT}): ${skippedByStudentLimit}`);
    console.log(`Skipped - user limit (${MAX_SUGGESTED_PER_USER}): ${skippedByUserLimit}`);
    console.log(`Skipped - already exists: ${skippedByExisting}`);

    // Insert matches
    if (matches.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("matches")
        .insert(matches);

      if (insertError) {
        console.error("Error inserting matches:", insertError);
        throw insertError;
      }
    }

    // Log scan to history
    await supabaseClient.from("scan_history").insert({
      scan_type: reqMinScore || reqLimit ? 'manual' : 'automatic',
      parameters: {
        minScore: finalMinScore,
        limit: finalLimit,
        maxDistanceKm,
        algorithm: "v2_distance_based",
      },
      results: {
        suggestedCount: matches.length,
        studentsScanned: students.length,
        usersAvailable: availableUsers.length,
        possibleMatchesFound: possibleMatches.length,
        skippedNoGenderNoLang,
        skippedByDistance,
        skippedByScore,
      },
      created_by: 'system',
    }).catch((err) => {
      console.error("Error logging scan history:", err);
    });

    return new Response(
      JSON.stringify({
        suggestedCount: matches.length,
        message: `נוצרו ${matches.length} התאמות חדשות בהצלחה`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in generate-matches:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
