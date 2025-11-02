import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  data: {
    table: 'students' | 'users';
    rows: any[];
  }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const { data: requestData } = await req.json() as { data: ImportRequest['data'] };

    if (!requestData || !Array.isArray(requestData)) {
      throw new Error('Invalid request format');
    }

    let totalUpserted = 0;

    for (const tableData of requestData) {
      const { table, rows } = tableData;

      console.log(`Processing ${rows.length} rows for table: ${table}`);
      
      // Log first row column names for debugging
      if (rows.length > 0) {
        console.log('Column names in Excel:', Object.keys(rows[0]));
      }

      // Map Excel columns to database columns
      const mappedRows = rows.map((row: any) => {
        const mapped: any = {};

        // Common fields mapping
        if (row['שם מלא'] || row['full_name'] || row['name']) {
          mapped.full_name = row['שם מלא'] || row['full_name'] || row['name'];
        }
        if (row['אימייל'] || row['email']) {
          mapped.email = row['אימייל'] || row['email'];
        }
        if (row['טלפון'] || row['phone']) {
          mapped.phone = row['טלפון'] || row['phone'];
        }
        if (row['עיר'] || row['city']) {
          mapped.city = row['עיר'] || row['city'];
        }
        if (row['שפת אם'] || row['native_language'] || row['language']) {
          mapped.native_language = row['שפת אם'] || row['native_language'] || row['language'];
        }
        if (row['מין'] || row['gender']) {
          mapped.gender = row['מין'] || row['gender'];
        }

        // Table-specific fields
        if (table === 'students') {
          if (row['בקשות מיוחדות'] || row['special_requests']) {
            mapped.special_requests = row['בקשות מיוחדות'] || row['special_requests'];
          }
        } else if (table === 'users') {
          if (row['קיבולת מקסימלית'] || row['capacity_max'] || row['capacity']) {
            mapped.capacity_max = parseInt(row['קיבולת מקסימלית'] || row['capacity_max'] || row['capacity']) || 1;
          }
          if (row['מלגה פעילה'] || row['scholarship_active']) {
            const scholarshipValue = row['מלגה פעילה'] || row['scholarship_active'];
            mapped.scholarship_active = scholarshipValue === true || scholarshipValue === 'true' || scholarshipValue === 'כן' || scholarshipValue === '1';
          }
        }

        return mapped;
      });

      // Filter out rows with missing required fields
      const validRows = mappedRows.filter(
        (row) => row.full_name && row.email && row.city && row.native_language
      );

      console.log(`Valid rows: ${validRows.length} out of ${mappedRows.length}`);
      
      if (validRows.length === 0 && mappedRows.length > 0) {
        console.log('Sample invalid row:', JSON.stringify(mappedRows[0]));
      }

      console.log(`Upserting ${validRows.length} valid rows into ${table}`);

      if (validRows.length > 0) {
        // Use upsert based on email (unique constraint)
        const { data: upsertedData, error: upsertError } = await supabaseClient
          .from(table)
          .upsert(validRows, {
            onConflict: 'email',
            ignoreDuplicates: false
          })
          .select();

        if (upsertError) {
          console.error(`Error upserting into ${table}:`, upsertError);
          throw new Error(`Failed to upsert into ${table}: ${upsertError.message}`);
        }

        totalUpserted += upsertedData?.length || 0;
        console.log(`Successfully upserted ${upsertedData?.length || 0} rows into ${table}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: totalUpserted,
        message: `Successfully imported ${totalUpserted} records`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
