const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  data: {
    table: 'students' | 'volunteers';
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

    const { data: requestData } = await req.json() as { data: ImportRequest['data'] };

    if (!requestData || !Array.isArray(requestData)) {
      throw new Error('Invalid request format');
    }

    let totalInserted = 0;

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
        } else if (table === 'volunteers') {
          if (row['קיבולת'] || row['capacity']) {
            mapped.capacity = parseInt(row['קיבולת'] || row['capacity']) || 1;
          }
        }

        return mapped;
      });

      // Filter out rows with missing required fields
      const validRows = mappedRows.filter(
        (row) => row.full_name && row.email && row.city && row.native_language
      );

      console.log(`Valid rows: ${validRows.length} out of ${mappedRows.length}`);
      
      // Log invalid rows for debugging
      if (validRows.length === 0 && mappedRows.length > 0) {
        console.log('Sample invalid row:', JSON.stringify(mappedRows[0]));
      }

      console.log(`Inserting ${validRows.length} valid rows into ${table}`);

      if (validRows.length > 0) {
        // Use direct fetch to insert data
        const insertResponse = await fetch(
          `${supabaseUrl}/rest/v1/${table}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(validRows)
          }
        );

        if (!insertResponse.ok) {
          const errorText = await insertResponse.text();
          console.error(`Error inserting into ${table}:`, errorText);
          throw new Error(`Failed to insert into ${table}: ${errorText}`);
        }

        const insertedData = await insertResponse.json();
        totalInserted += insertedData.length || 0;
        console.log(`Successfully inserted ${insertedData.length} rows into ${table}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: totalInserted,
        message: `Successfully imported ${totalInserted} records`,
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
