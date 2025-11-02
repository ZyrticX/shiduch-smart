import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Built-in coordinates for common Israeli cities
const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'ירושלים': { lat: 31.7683, lon: 35.2137 },
  'jerusalem': { lat: 31.7683, lon: 35.2137 },
  'תל אביב': { lat: 32.0853, lon: 34.7818 },
  'tel aviv': { lat: 32.0853, lon: 34.7818 },
  'חיפה': { lat: 32.7940, lon: 34.9896 },
  'haifa': { lat: 32.7940, lon: 34.9896 },
  'באר שבע': { lat: 31.2518, lon: 34.7913 },
  'beer sheva': { lat: 31.2518, lon: 34.7913 },
  'ראשון לציון': { lat: 31.9730, lon: 34.7925 },
  'rishon lezion': { lat: 31.9730, lon: 34.7925 },
  'פתח תקווה': { lat: 32.0878, lon: 34.8878 },
  'petah tikva': { lat: 32.0878, lon: 34.8878 },
  'נתניה': { lat: 32.3215, lon: 34.8532 },
  'netanya': { lat: 32.3215, lon: 34.8532 },
  'אשדוד': { lat: 31.8044, lon: 34.6553 },
  'ashdod': { lat: 31.8044, lon: 34.6553 },
  'חולון': { lat: 32.0117, lon: 34.7736 },
  'holon': { lat: 32.0117, lon: 34.7736 },
  'בני ברק': { lat: 32.0809, lon: 34.8338 },
  'bnei brak': { lat: 32.0809, lon: 34.8338 },
  'רמת גן': { lat: 32.0719, lon: 34.8237 },
  'ramat gan': { lat: 32.0719, lon: 34.8237 },
  'אשקלון': { lat: 31.6688, lon: 34.5742 },
  'ashkelon': { lat: 31.6688, lon: 34.5742 },
  'רחובות': { lat: 31.8947, lon: 34.8081 },
  'rehovot': { lat: 31.8947, lon: 34.8081 },
  'בת ים': { lat: 32.0167, lon: 34.7500 },
  'bat yam': { lat: 32.0167, lon: 34.7500 },
  'כפר סבא': { lat: 32.1767, lon: 34.9072 },
  'kfar saba': { lat: 32.1767, lon: 34.9072 },
  'הרצליה': { lat: 32.1656, lon: 34.8444 },
  'herzliya': { lat: 32.1656, lon: 34.8444 },
  'רעננה': { lat: 32.1848, lon: 34.8706 },
  'raanana': { lat: 32.1848, lon: 34.8706 },
  'רמלה': { lat: 31.9299, lon: 34.8669 },
  'ramla': { lat: 31.9299, lon: 34.8669 },
  'לוד': { lat: 31.9496, lon: 34.8956 },
  'lod': { lat: 31.9496, lon: 34.8956 },
  'נצרת': { lat: 32.6992, lon: 35.3035 },
  'nazareth': { lat: 32.6992, lon: 35.3035 },
  'עכו': { lat: 32.9275, lon: 35.0831 },
  'acre': { lat: 32.9275, lon: 35.0831 },
  'צפת': { lat: 32.9658, lon: 35.4983 },
  'safed': { lat: 32.9658, lon: 35.4983 },
  'טבריה': { lat: 32.7913, lon: 35.5354 },
  'tiberias': { lat: 32.7913, lon: 35.5354 },
  'מודיעין': { lat: 31.8928, lon: 35.0106 },
  'modiin': { lat: 31.8928, lon: 35.0106 },
  'כרמיאל': { lat: 32.9189, lon: 35.2961 },
  'carmiel': { lat: 32.9189, lon: 35.2961 },
  'נהריה': { lat: 33.0072, lon: 35.0933 },
  'nahariya': { lat: 33.0072, lon: 35.0933 },
  'גבעתיים': { lat: 32.0696, lon: 34.8119 },
  'givatayim': { lat: 32.0696, lon: 34.8119 },
  'נשר': { lat: 32.7672, lon: 35.0364 },
  'nesher': { lat: 32.7672, lon: 35.0364 },
  'קרית אתא': { lat: 32.8061, lon: 35.1047 },
  'קריית אתא': { lat: 32.8061, lon: 35.1047 },
  'קרית ביאליק': { lat: 32.8397, lon: 35.0808 },
  'קריית ביאליק': { lat: 32.8397, lon: 35.0808 },
  'קרית מוצקין': { lat: 32.8378, lon: 35.0775 },
  'קריית מוצקין': { lat: 32.8378, lon: 35.0775 },
  'אריאל': { lat: 32.1038, lon: 35.1819 },
  'ariel': { lat: 32.1038, lon: 35.1819 },
  'גבעת שמואל': { lat: 32.0718, lon: 34.8516 },
};

function normalizeCity(city: string): string {
  return city.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/־/g, ' ') // Replace Hebrew hyphen
    .replace(/-/g, ' '); // Replace regular hyphen
}

function getCityCoordinates(city: string): { lat: number; lon: number } | null {
  const normalized = normalizeCity(city);
  
  // Try exact match
  if (CITY_COORDINATES[normalized]) {
    return CITY_COORDINATES[normalized];
  }
  
  // Try without spaces
  const noSpaces = normalized.replace(/\s+/g, '');
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (key.replace(/\s+/g, '') === noSpaces) {
      return coords;
    }
  }
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    console.log('Starting geocoding process...');

    // Update students
    const { data: students, error: studentsError } = await supabaseClient
      .from('students')
      .select('id, city, latitude, longitude')
      .is('latitude', null);

    if (studentsError) {
      console.error('Error loading students:', studentsError);
      throw studentsError;
    }

    let studentsUpdated = 0;
    for (const student of students || []) {
      const coords = getCityCoordinates(student.city);
      if (coords) {
        const { error: updateError } = await supabaseClient
          .from('students')
          .update({ latitude: coords.lat, longitude: coords.lon })
          .eq('id', student.id);

        if (!updateError) {
          studentsUpdated++;
        } else {
          console.error(`Error updating student ${student.id}:`, updateError);
        }
      } else {
        console.log(`No coordinates found for city: ${student.city}`);
      }
    }

    // Update users
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id, city, latitude, longitude')
      .is('latitude', null);

    if (usersError) {
      console.error('Error loading users:', usersError);
      throw usersError;
    }

    let usersUpdated = 0;
    for (const user of users || []) {
      const coords = getCityCoordinates(user.city);
      if (coords) {
        const { error: updateError } = await supabaseClient
          .from('users')
          .update({ latitude: coords.lat, longitude: coords.lon })
          .eq('id', user.id);

        if (!updateError) {
          usersUpdated++;
        } else {
          console.error(`Error updating user ${user.id}:`, updateError);
        }
      } else {
        console.log(`No coordinates found for city: ${user.city}`);
      }
    }

    console.log(`Geocoding complete. Updated ${studentsUpdated} students and ${usersUpdated} users.`);

    return new Response(
      JSON.stringify({
        success: true,
        studentsUpdated,
        usersUpdated,
        message: `עודכנו ${studentsUpdated} תלמידים ו-${usersUpdated} מתנדבים עם קואורדינטות`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Geocoding error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

