import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Local cache for common Israeli cities - used as fast fallback (no API call needed)
const CITY_COORDINATES: Record<string, { lat: number; lon: number; normalized: string }> = {
  'ירושלים': { lat: 31.7683, lon: 35.2137, normalized: 'ירושלים' },
  'jerusalem': { lat: 31.7683, lon: 35.2137, normalized: 'ירושלים' },
  'תל אביב': { lat: 32.0853, lon: 34.7818, normalized: 'תל אביב-יפו' },
  'תל אביב יפו': { lat: 32.0853, lon: 34.7818, normalized: 'תל אביב-יפו' },
  'tel aviv': { lat: 32.0853, lon: 34.7818, normalized: 'תל אביב-יפו' },
  'חיפה': { lat: 32.7940, lon: 34.9896, normalized: 'חיפה' },
  'haifa': { lat: 32.7940, lon: 34.9896, normalized: 'חיפה' },
  'באר שבע': { lat: 31.2518, lon: 34.7913, normalized: 'באר שבע' },
  'beer sheva': { lat: 31.2518, lon: 34.7913, normalized: 'באר שבע' },
  'ראשון לציון': { lat: 31.9730, lon: 34.7925, normalized: 'ראשון לציון' },
  'rishon lezion': { lat: 31.9730, lon: 34.7925, normalized: 'ראשון לציון' },
  'פתח תקווה': { lat: 32.0878, lon: 34.8878, normalized: 'פתח תקווה' },
  'petah tikva': { lat: 32.0878, lon: 34.8878, normalized: 'פתח תקווה' },
  'נתניה': { lat: 32.3215, lon: 34.8532, normalized: 'נתניה' },
  'netanya': { lat: 32.3215, lon: 34.8532, normalized: 'נתניה' },
  'אשדוד': { lat: 31.8044, lon: 34.6553, normalized: 'אשדוד' },
  'ashdod': { lat: 31.8044, lon: 34.6553, normalized: 'אשדוד' },
  'חולון': { lat: 32.0117, lon: 34.7736, normalized: 'חולון' },
  'holon': { lat: 32.0117, lon: 34.7736, normalized: 'חולון' },
  'בני ברק': { lat: 32.0809, lon: 34.8338, normalized: 'בני ברק' },
  'bnei brak': { lat: 32.0809, lon: 34.8338, normalized: 'בני ברק' },
  'רמת גן': { lat: 32.0719, lon: 34.8237, normalized: 'רמת גן' },
  'ramat gan': { lat: 32.0719, lon: 34.8237, normalized: 'רמת גן' },
  'אשקלון': { lat: 31.6688, lon: 34.5742, normalized: 'אשקלון' },
  'ashkelon': { lat: 31.6688, lon: 34.5742, normalized: 'אשקלון' },
  'רחובות': { lat: 31.8947, lon: 34.8081, normalized: 'רחובות' },
  'rehovot': { lat: 31.8947, lon: 34.8081, normalized: 'רחובות' },
  'בת ים': { lat: 32.0167, lon: 34.7500, normalized: 'בת ים' },
  'bat yam': { lat: 32.0167, lon: 34.7500, normalized: 'בת ים' },
  'כפר סבא': { lat: 32.1767, lon: 34.9072, normalized: 'כפר סבא' },
  'kfar saba': { lat: 32.1767, lon: 34.9072, normalized: 'כפר סבא' },
  'הרצליה': { lat: 32.1656, lon: 34.8444, normalized: 'הרצליה' },
  'herzliya': { lat: 32.1656, lon: 34.8444, normalized: 'הרצליה' },
  'רעננה': { lat: 32.1848, lon: 34.8706, normalized: 'רעננה' },
  'raanana': { lat: 32.1848, lon: 34.8706, normalized: 'רעננה' },
  'רמלה': { lat: 31.9299, lon: 34.8669, normalized: 'רמלה' },
  'ramla': { lat: 31.9299, lon: 34.8669, normalized: 'רמלה' },
  'לוד': { lat: 31.9496, lon: 34.8956, normalized: 'לוד' },
  'lod': { lat: 31.9496, lon: 34.8956, normalized: 'לוד' },
  'נצרת': { lat: 32.6992, lon: 35.3035, normalized: 'נצרת' },
  'nazareth': { lat: 32.6992, lon: 35.3035, normalized: 'נצרת' },
  'עכו': { lat: 32.9275, lon: 35.0831, normalized: 'עכו' },
  'acre': { lat: 32.9275, lon: 35.0831, normalized: 'עכו' },
  'צפת': { lat: 32.9658, lon: 35.4983, normalized: 'צפת' },
  'safed': { lat: 32.9658, lon: 35.4983, normalized: 'צפת' },
  'טבריה': { lat: 32.7913, lon: 35.5354, normalized: 'טבריה' },
  'tiberias': { lat: 32.7913, lon: 35.5354, normalized: 'טבריה' },
  'מודיעין': { lat: 31.8928, lon: 35.0106, normalized: 'מודיעין-מכבים-רעות' },
  'modiin': { lat: 31.8928, lon: 35.0106, normalized: 'מודיעין-מכבים-רעות' },
  'כרמיאל': { lat: 32.9189, lon: 35.2961, normalized: 'כרמיאל' },
  'carmiel': { lat: 32.9189, lon: 35.2961, normalized: 'כרמיאל' },
  'נהריה': { lat: 33.0072, lon: 35.0933, normalized: 'נהריה' },
  'nahariya': { lat: 33.0072, lon: 35.0933, normalized: 'נהריה' },
  'גבעתיים': { lat: 32.0696, lon: 34.8119, normalized: 'גבעתיים' },
  'givatayim': { lat: 32.0696, lon: 34.8119, normalized: 'גבעתיים' },
  'נשר': { lat: 32.7672, lon: 35.0364, normalized: 'נשר' },
  'nesher': { lat: 32.7672, lon: 35.0364, normalized: 'נשר' },
  'קרית אתא': { lat: 32.8061, lon: 35.1047, normalized: 'קריית אתא' },
  'קריית אתא': { lat: 32.8061, lon: 35.1047, normalized: 'קריית אתא' },
  'קרית ביאליק': { lat: 32.8397, lon: 35.0808, normalized: 'קריית ביאליק' },
  'קריית ביאליק': { lat: 32.8397, lon: 35.0808, normalized: 'קריית ביאליק' },
  'קרית מוצקין': { lat: 32.8378, lon: 35.0775, normalized: 'קריית מוצקין' },
  'קריית מוצקין': { lat: 32.8378, lon: 35.0775, normalized: 'קריית מוצקין' },
  'אריאל': { lat: 32.1038, lon: 35.1819, normalized: 'אריאל' },
  'ariel': { lat: 32.1038, lon: 35.1819, normalized: 'אריאל' },
  'גבעת שמואל': { lat: 32.0718, lon: 34.8516, normalized: 'גבעת שמואל' },
};

interface GeoResult {
  lat: number;
  lon: number;
  normalizedCity: string;
  source: 'local' | 'google';
}

// In-memory cache for Google API results within a single invocation
const googleCache = new Map<string, GeoResult | null>();

function normalizeCity(city: string): string {
  return city.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/־/g, ' ')
    .replace(/-/g, ' ');
}

function getLocalCoordinates(city: string): GeoResult | null {
  const normalized = normalizeCity(city);

  // Exact match
  if (CITY_COORDINATES[normalized]) {
    const c = CITY_COORDINATES[normalized];
    return { lat: c.lat, lon: c.lon, normalizedCity: c.normalized, source: 'local' };
  }

  // Without spaces match
  const noSpaces = normalized.replace(/\s+/g, '');
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (key.replace(/\s+/g, '') === noSpaces) {
      return { lat: coords.lat, lon: coords.lon, normalizedCity: coords.normalized, source: 'local' };
    }
  }

  return null;
}

async function geocodeWithGoogle(city: string, apiKey: string): Promise<GeoResult | null> {
  // Check in-memory cache first
  const cacheKey = normalizeCity(city);
  if (googleCache.has(cacheKey)) {
    return googleCache.get(cacheKey) || null;
  }

  try {
    const address = encodeURIComponent(`${city}, ישראל`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&region=il&language=he&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry.location;

      // Extract the locality (city name) from address_components
      let normalizedCity = city; // fallback to original
      const components = result.address_components || [];
      for (const comp of components) {
        if (comp.types && comp.types.includes('locality')) {
          normalizedCity = comp.long_name;
          break;
        }
      }

      const geoResult: GeoResult = {
        lat: location.lat,
        lon: location.lng,
        normalizedCity,
        source: 'google',
      };

      googleCache.set(cacheKey, geoResult);
      console.log(`🌍 Google API: "${city}" → "${normalizedCity}" (${location.lat}, ${location.lng})`);
      return geoResult;
    }

    if (data.status === 'ZERO_RESULTS') {
      console.log(`⚠️ Google API: no results for "${city}"`);
      googleCache.set(cacheKey, null);
      return null;
    }

    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      console.error(`❌ Google API error: ${data.status} - ${data.error_message || ''}`);
      // Don't cache API errors - might be temporary
      return null;
    }

    console.log(`⚠️ Google API status: ${data.status} for "${city}"`);
    googleCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.error(`❌ Google API fetch error for "${city}":`, error);
    return null;
  }
}

async function geocodeCity(city: string, apiKey: string | null): Promise<GeoResult | null> {
  // Skip placeholder values
  if (!city || city.trim() === '' || city === 'לא צוין') {
    return null;
  }

  // Step 1: Try local dictionary (fast, free)
  const local = getLocalCoordinates(city);
  if (local) return local;

  // Step 2: Try Google Maps API (handles typos, mixed languages, unknown cities)
  if (apiKey) {
    return await geocodeWithGoogle(city, apiKey);
  }

  return null;
}

async function processTable(
  supabaseClient: any,
  tableName: string,
  apiKey: string | null
): Promise<{ updated: number; apiCalls: number; unresolved: string[] }> {
  const { data: records, error } = await supabaseClient
    .from(tableName)
    .select('id, city, latitude, longitude')
    .is('latitude', null);

  if (error) {
    console.error(`Error loading ${tableName}:`, error);
    throw error;
  }

  let updated = 0;
  let apiCalls = 0;
  const unresolved: string[] = [];

  for (const record of records || []) {
    const result = await geocodeCity(record.city, apiKey);

    if (result) {
      if (result.source === 'google') apiCalls++;

      const updateData: any = {
        latitude: result.lat,
        longitude: result.lon,
      };

      // Also normalize the city name if it changed
      if (result.normalizedCity && result.normalizedCity !== record.city) {
        updateData.city = result.normalizedCity;
        console.log(`📝 ${tableName}: city name corrected "${record.city}" → "${result.normalizedCity}"`);
      }

      const { error: updateError } = await supabaseClient
        .from(tableName)
        .update(updateData)
        .eq('id', record.id);

      if (!updateError) {
        updated++;
      } else {
        console.error(`Error updating ${tableName} ${record.id}:`, updateError);
      }
    } else {
      if (record.city && record.city !== 'לא צוין') {
        unresolved.push(record.city);
        console.log(`❓ No coordinates found for: "${record.city}" in ${tableName}`);
      }
    }
  }

  return { updated, apiCalls, unresolved };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Read Google Maps API key from Supabase secrets
    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || null;

    if (!googleApiKey) {
      console.warn('⚠️ GOOGLE_MAPS_API_KEY not set - using local dictionary only');
    } else {
      console.log('🔑 Google Maps API key found');
    }

    console.log('🚀 Starting geocoding process...');

    // Process both tables
    const studentsResult = await processTable(supabaseClient, 'students', googleApiKey);
    const usersResult = await processTable(supabaseClient, 'users', googleApiKey);

    const totalUpdated = studentsResult.updated + usersResult.updated;
    const totalApiCalls = studentsResult.apiCalls + usersResult.apiCalls;
    const allUnresolved = [...new Set([...studentsResult.unresolved, ...usersResult.unresolved])];

    console.log(`✅ Geocoding complete:`);
    console.log(`   Students: ${studentsResult.updated} updated`);
    console.log(`   Users: ${usersResult.updated} updated`);
    console.log(`   Google API calls: ${totalApiCalls}`);
    console.log(`   Unresolved cities: ${allUnresolved.length}`);
    if (allUnresolved.length > 0) {
      console.log(`   Unresolved list: ${allUnresolved.join(', ')}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        studentsUpdated: studentsResult.updated,
        usersUpdated: usersResult.updated,
        totalUpdated,
        googleApiCalls: totalApiCalls,
        unresolvedCities: allUnresolved,
        message: `עודכנו ${studentsResult.updated} תלמידים ו-${usersResult.updated} מתנדבים. ${totalApiCalls} קריאות Google API. ${allUnresolved.length} ערים לא זוהו.`,
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
