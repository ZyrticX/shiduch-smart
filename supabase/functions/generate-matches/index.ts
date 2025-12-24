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

// Calculate match score based on criteria
function calculateMatchScore(
  student: Student,
  user: User,
  distance: number,
  scoringConfig: {
    languageMatchPoints: number;
    sameCityPoints: number;
    nearbyCityPoints: number;
    nearbyCityDistanceKm: number;
    genderMatchPoints: number;
    specialRequestsPoints: number;
  }
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Language match
  if (student.native_language === user.native_language) {
    score += scoringConfig.languageMatchPoints;
    reasons.push(`שפת אם זהה (${student.native_language})`);
  }

  // City/Distance match
  if (distance === 0) {
    score += scoringConfig.sameCityPoints;
    reasons.push(`אותה עיר (${student.city})`);
  } else if (distance > 0 && distance <= scoringConfig.nearbyCityDistanceKm) {
    score += scoringConfig.nearbyCityPoints;
    reasons.push(`מרחק ${distance.toFixed(0)} ק"מ`);
  } else if (distance > scoringConfig.nearbyCityDistanceKm) {
    // Cities are far apart - add negative note
    reasons.push(`ערים רחוקות (${distance.toFixed(0)} ק"מ)`);
  }

  // Gender match
  if (student.gender && user.gender && student.gender === user.gender) {
    score += scoringConfig.genderMatchPoints;
    reasons.push("התאמת מין");
  }

  // Special requests match
  if (student.special_requests && user.native_language) {
    const requestLower = student.special_requests.toLowerCase();
    const userLangLower = user.native_language.toLowerCase();
    if (requestLower.includes(userLangLower) || requestLower.includes("דובר")) {
      score += scoringConfig.specialRequestsPoints;
      reasons.push("התאמה לבקשות מיוחדות");
    }
  }

  // Cap at 100
  score = Math.min(score, 100);

  // Build detailed reason string
  const matchQuality = score >= 90 ? 'מצוינת' : score >= 80 ? 'טובה מאוד' : score >= 70 ? 'טובה' : 'סבירה';
  const reason = reasons.length > 0 
    ? `התאמה ${matchQuality} (${score}%) - ${reasons.join(' • ')}`
    : `ציון התאמה: ${score}%`;

  return { score, reason };
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Convert settings array to object for easy access
    const settings: Record<string, string> = {};
    if (settingsData) {
      settingsData.forEach((s) => {
        settings[s.key] = s.value;
      });
    }

    // Get configurable parameters with defaults
    const nearbyCityDistanceKm = parseInt(settings.nearby_city_distance_km || "150", 10);
    const minScore = parseInt(settings.min_match_score || "60", 10);
    const limit = parseInt(settings.max_matches_limit || "100", 10);
    const languageMatchPoints = parseInt(settings.language_match_points || "60", 10);
    const sameCityPoints = parseInt(settings.same_city_points || "40", 10);
    const nearbyCityPoints = parseInt(settings.nearby_city_points || "20", 10);
    const genderMatchPoints = parseInt(settings.gender_match_points || "15", 10);
    const specialRequestsPoints = parseInt(settings.special_requests_points || "5", 10);

    const { minScore: reqMinScore, limit: reqLimit } = await req.json().catch(() => ({}));
    const finalMinScore = reqMinScore || minScore;
    const finalLimit = reqLimit || limit;

    console.log("Starting match generation...");
    console.log(`Using settings: nearbyCityDistanceKm=${nearbyCityDistanceKm}, minScore=${finalMinScore}, limit=${finalLimit}`);

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

    console.log(`DEBUG: Found ${students.length} unmatched students in database`);
    console.log(`DEBUG: Found ${users.length} active users in database`);

    // Filter users with available capacity and scholarship active (if required)
    const availableUsers = users.filter((u: User) => {
      const hasCapacity = u.current_students < u.capacity_max;
      const hasScholarship = u.scholarship_active !== false; // Only exclude if explicitly false
      return hasCapacity && hasScholarship;
    });

    console.log(`DEBUG: Available users after filtering (capacity & scholarship): ${availableUsers.length}`);
    
    if (users.length > 0 && availableUsers.length === 0) {
      const usersWithNoCapacity = users.filter(u => u.current_students >= u.capacity_max).length;
      const usersWithNoScholarship = users.filter(u => u.scholarship_active === false).length;
      console.log(`DEBUG: Reasons for 0 available users: ${usersWithNoCapacity} full capacity, ${usersWithNoScholarship} inactive scholarship`);
    }

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
            availableUsersCount: availableUsers.length
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Generate matches
    const matches = [];
    const userCapacity = new Map<string, number>();
    const userSuggestedMatches = new Map<string, number>(); // Track suggested matches per user
    const studentSuggestedMatches = new Map<string, number>(); // Track suggested matches per student

    // Initialize user capacity tracking
    availableUsers.forEach((u: User) => {
      userCapacity.set(u.id, u.capacity_max - u.current_students);
      userSuggestedMatches.set(u.id, 0); // Initialize suggested matches counter
    });

    // Initialize student suggested matches counter
    students.forEach((s: Student) => {
      studentSuggestedMatches.set(s.id, 0);
    });

    // Count existing suggested matches per user and per student
    const { data: existingSuggestedMatches } = await supabaseClient
      .from("matches")
      .select("user_id, student_id")
      .eq("status", "Suggested");

    if (existingSuggestedMatches) {
      existingSuggestedMatches.forEach((match: any) => {
        // Count for user
        const userCount = userSuggestedMatches.get(match.user_id) || 0;
        userSuggestedMatches.set(match.user_id, userCount + 1);
        
        // Count for student
        const studentCount = studentSuggestedMatches.get(match.student_id) || 0;
        studentSuggestedMatches.set(match.student_id, studentCount + 1);
      });
    }

    // Calculate all possible matches
    const possibleMatches = [];
    let skippedByScore = 0;
    let skippedByDistance = 0;
    let skippedByQuality = 0;

    for (const student of students as Student[]) {
      for (const user of availableUsers as User[]) {
        // CRITICAL: Prevent matching the same ID (student ID should never equal user ID)
        if (student.id === user.id) {
          console.warn(`WARNING: Skipping match attempt - same ID detected: ${student.id}`);
          continue;
        }
        
        // Calculate distance
        let distance = 0;
        let hasCoordinates = false;
        
        if (
          student.latitude &&
          student.longitude &&
          user.latitude &&
          user.longitude
        ) {
          hasCoordinates = true;
          distance = calculateDistance(
            Number(student.latitude),
            Number(student.longitude),
            Number(user.latitude),
            Number(user.longitude)
          );
          
          // Skip if distance exceeds configured limit
          if (distance > nearbyCityDistanceKm) {
            skippedByDistance++;
            continue;
          }
        } else {
          // No coordinates - compare cities by name (case-insensitive, trimmed)
          const studentCity = (student.city || '').trim().toLowerCase();
          const userCity = (user.city || '').trim().toLowerCase();
          
          if (studentCity === userCity && studentCity !== '' && studentCity !== 'לא צוין') {
            // Same city by name
            distance = 0;
          } else {
            // Different cities and no way to calculate distance - use high distance
            distance = nearbyCityDistanceKm + 1;
            // This will be filtered out by the scoring logic
          }
        }

        const scoringConfig = {
          languageMatchPoints,
          sameCityPoints,
          nearbyCityPoints,
          nearbyCityDistanceKm,
          genderMatchPoints,
          specialRequestsPoints,
        };

        const { score, reason } = calculateMatchScore(student, user, distance, scoringConfig);

        // Skip if below minimum score
        if (score < finalMinScore) {
          skippedByScore++;
          continue;
        }

        // Additional quality checks for better precision:
        // 1. Require at least language match OR same city for high-quality matches
        const hasLanguageMatch = student.native_language === user.native_language;
        const hasSameCity = distance === 0;
        
        // If score is below 70, require at least language match OR same city
        if (score < 70 && !hasLanguageMatch && !hasSameCity) {
          skippedByQuality++;
          continue; // Skip low-quality matches without key criteria
        }

        possibleMatches.push({
          student_id: student.id,
          user_id: user.id,
          score,
          reason,
          distance,
        });
      }
    }

    console.log(`DEBUG: Total pairs checked: ${students.length * availableUsers.length}`);
    console.log(`DEBUG: Skipped by score (<${finalMinScore}): ${skippedByScore}`);
    console.log(`DEBUG: Skipped by distance (>${nearbyCityDistanceKm}km): ${skippedByDistance}`);
    console.log(`DEBUG: Skipped by quality (score<70 & no lang/city match): ${skippedByQuality}`);

    // Sort by score (highest first)
    possibleMatches.sort((a, b) => b.score - a.score);

    console.log(`Generated ${possibleMatches.length} possible matches`);

    // Greedy allocation - assign best matches first
    // Limits: 
    // - max 3 suggested matches per student (to ensure quality)
    // - max 5 suggested matches per user (to prevent spam)
    const MAX_SUGGESTED_MATCHES_PER_STUDENT = 3;
    const MAX_SUGGESTED_MATCHES_PER_USER = 5;

    let skippedByStudentLimit = 0;
    let skippedByUserLimit = 0;
    let skippedByExistingMatch = 0;

    for (const match of possibleMatches) {
      // Check user capacity (for approved matches)
      const capacity = userCapacity.get(match.user_id) || 0;
      if (capacity <= 0) {
        continue;
      }

      // Check how many suggested matches this student already has
      const currentStudentSuggestedCount = studentSuggestedMatches.get(match.student_id) || 0;
      if (currentStudentSuggestedCount >= MAX_SUGGESTED_MATCHES_PER_STUDENT) {
        skippedByStudentLimit++;
        continue; // Skip - student already has enough suggested matches
      }

      // Check how many suggested matches this user already has
      const currentUserSuggestedCount = userSuggestedMatches.get(match.user_id) || 0;
      if (currentUserSuggestedCount >= MAX_SUGGESTED_MATCHES_PER_USER) {
        skippedByUserLimit++;
        continue; // Skip - user already has enough suggested matches
      }

      // Check if match already exists
      const { data: existingMatch } = await supabaseClient
        .from("matches")
        .select("id")
        .eq("student_id", match.student_id)
        .eq("user_id", match.user_id)
        .maybeSingle();

      if (!existingMatch) {
        matches.push({
          student_id: match.student_id,
          user_id: match.user_id,
          confidence_score: match.score,
          match_reason: match.reason,
          status: "Suggested", // Use Suggested status
        });

        // Update suggested matches counters
        studentSuggestedMatches.set(match.student_id, currentStudentSuggestedCount + 1);
        userSuggestedMatches.set(match.user_id, currentUserSuggestedCount + 1);

        // Stop if we reached the limit
        if (matches.length >= finalLimit) {
          break;
        }
      } else {
        skippedByExistingMatch++;
      }
    }

    console.log(`DEBUG: Final allocation results:`);
    console.log(`DEBUG: - New matches created: ${matches.length}`);
    console.log(`DEBUG: - Skipped by student suggestion limit (${MAX_SUGGESTED_MATCHES_PER_STUDENT}): ${skippedByStudentLimit}`);
    console.log(`DEBUG: - Skipped by user suggestion limit (${MAX_SUGGESTED_MATCHES_PER_USER}): ${skippedByUserLimit}`);
    console.log(`DEBUG: - Skipped because match already exists: ${skippedByExistingMatch}`);

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

    // Log scan to history
    const scanRecord = {
      scan_type: reqMinScore || reqLimit ? 'manual' : 'automatic',
      parameters: {
        minScore: finalMinScore,
        limit: finalLimit,
        nearbyCityDistanceKm,
        languageMatchPoints,
        sameCityPoints,
        nearbyCityPoints,
        genderMatchPoints,
        specialRequestsPoints,
      },
      results: {
        suggestedCount: matches.length,
        studentsScanned: students.length,
        usersAvailable: availableUsers.length,
        possibleMatchesFound: possibleMatches.length,
      },
      created_by: 'system',
    };

    await supabaseClient.from("scan_history").insert(scanRecord).catch((err) => {
      console.error("Error logging scan history:", err);
      // Don't fail the request if logging fails
    });

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
