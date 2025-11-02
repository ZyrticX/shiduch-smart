import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ImportRequest {
  data: {
    table: 'students' | 'users';
    sheetName?: string;
    rows: any[];
  }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
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
    const errors: string[] = [];

    for (const tableData of requestData) {
      const { table, rows, sheetName } = tableData;
      const sheetDisplayName = sheetName || table;

      console.log(`Processing ${rows.length} rows for table: ${table} (sheet: ${sheetDisplayName})`);
      
      // Log first row column names for debugging
      if (rows.length > 0) {
        console.log('Column names in Excel:', Object.keys(rows[0]));
      }

      // Map Excel columns to database columns
      const mappedRows = rows.map((row: any) => {
        const mapped: any = {};

        // Helper function to find column value by multiple possible names (case-insensitive)
        const findColumn = (possibleNames: string[]): string | null => {
          for (const name of possibleNames) {
            // Try exact match first
            const value = row[name];
            if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
              return String(value).trim();
            }
            // Try case-insensitive match
            const rowKeys = Object.keys(row);
            const foundKey = rowKeys.find(key => key.toLowerCase() === name.toLowerCase());
            if (foundKey) {
              const foundValue = row[foundKey];
              if (foundValue !== undefined && foundValue !== null && foundValue !== '' && String(foundValue).trim() !== '') {
                return String(foundValue).trim();
              }
            }
          }
          return null;
        };

        // Name handling - support both "שם מלא" and "שם פרטי" + "שם משפחה"
        const fullName = findColumn(['שם מלא', 'full_name', 'name', 'שם']);
        if (fullName) {
          mapped.full_name = fullName;
        } else {
          const firstName = findColumn(['שם פרטי', 'first_name', 'firstName', 'שם פרטי']);
          const lastName = findColumn(['שם משפחה', 'last_name', 'lastName', 'שם משפחה']);
          if (firstName || lastName) {
            mapped.full_name = `${firstName || ''} ${lastName || ''}`.trim();
          }
        }

        // Email/Contact ID handling - prioritize email, then contact ID
        const email = findColumn(['אימייל', 'email', 'e-mail']);
        if (email) {
          mapped.email = email;
        } else {
          const contactId = findColumn(['מזהה איש קשר', 'contact_id', 'contactId', 'מזהה', 'id']);
          if (contactId) {
            // Try to use contact ID as email if it looks like email, otherwise as phone
            if (contactId.includes('@')) {
              mapped.email = contactId;
            } else {
              mapped.phone = contactId;
              // Generate email from contact ID if it's a phone number
              mapped.email = `contact_${contactId.replace(/\D/g, '')}@imported.local`;
            }
          }
        }

        // Phone handling - support "טלפון נייד" as well
        const phone = findColumn(['טלפון', 'טלפון נייד', 'phone', 'phone_number', 'tel', 'mobile']);
        if (phone) {
          mapped.phone = phone;
        }

        // City
        const city = findColumn(['עיר', 'city', 'עיר מגורים']);
        if (city) {
          mapped.city = city;
        }

        // Native language - support "שפות" and "העדפת שפה" as well
        const nativeLang = findColumn(['שפת אם', 'שפות', 'native_language', 'language', 'העדפת שפה', 'שפה']);
        if (nativeLang) {
          mapped.native_language = nativeLang;
        }

        // Gender
        const gender = findColumn(['מין', 'gender', 'sex']);
        if (gender) {
          mapped.gender = gender;
        }

        // Table-specific fields
        if (table === 'students') {
          // Special requests / Notes
          const specialRequests = findColumn([
            'בקשות מיוחדות', 
            'special_requests', 
            'הערות / בקשות מיוחדות', 
            'בקשות מיוחדות בזמן בקשה לשיבוץ', 
            'הערות',
            'notes',
            'remarks'
          ]);
          if (specialRequests) {
            mapped.special_requests = specialRequests;
          }
        } else if (table === 'users') {
          // Capacity - support multiple column names including "כמות חיילים"
          const capacity = findColumn([
            'כמות חיילים',
            'קיבולת מקסימלית', 
            'capacity_max', 
            'capacity', 
            'כמות users', 
            'כמות חיילים/סטודנטים משויכים',
            'max_capacity'
          ]);
          if (capacity) {
            mapped.capacity_max = parseInt(String(capacity)) || 1;
          } else {
            mapped.capacity_max = 1; // Default
          }

          // Scholarship active
          const scholarship = findColumn([
            'האם פעיל במלגה', 
            'מלגה פעילה', 
            'scholarship_active', 
            'פעיל במלגה',
            'active'
          ]);
          if (scholarship) {
            const scholarshipValue = String(scholarship).toLowerCase();
            mapped.scholarship_active = scholarshipValue === 'true' || 
                                         scholarshipValue === 'כן' || 
                                         scholarshipValue === '1' ||
                                         scholarshipValue === 'פעיל' ||
                                         scholarshipValue === 'yes' ||
                                         scholarshipValue === '✓';
          } else {
            mapped.scholarship_active = true; // Default to active
          }
        }

        return mapped;
      });

      // Filter out rows with missing required fields
      // Generate email automatically if missing - it's required by DB but not by user
      const validRows = mappedRows.map((row: any) => {
        // Ensure all values are strings where needed
        if (row.full_name) row.full_name = String(row.full_name).trim();
        if (row.city) row.city = String(row.city).trim();
        if (row.native_language) row.native_language = String(row.native_language).trim();
        
        // ALWAYS generate unique email if missing - use contact ID, phone, or name-based
        if (!row.email || row.email.trim() === '') {
          // Strategy 1: Try phone if available
          if (row.phone) {
            const phoneClean = String(row.phone).replace(/\D/g, '');
            if (phoneClean.length > 0) {
              row.email = `imported_${phoneClean}@shiduch.local`;
            }
          }
          
          // Strategy 2: Generate from name + timestamp if no phone
          if (!row.email || row.email.trim() === '') {
            const nameForEmail = row.full_name 
              ? row.full_name.replace(/\s+/g, '.').replace(/[^a-zA-Z0-9.]/g, '').toLowerCase().substring(0, 20)
              : 'user';
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 10000);
            row.email = `${nameForEmail}_${timestamp}_${random}@shiduch.local`;
          }
          
          // Strategy 3: If still no email (shouldn't happen), use UUID-based
          if (!row.email || row.email.trim() === '') {
            const uuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
            row.email = `imported_${uuid.replace(/-/g, '')}@shiduch.local`;
          }
        } else {
          row.email = String(row.email).trim();
        }
        
        return row;
      }).filter((row) => {
        // Only require: full_name, city, native_language (email is ALWAYS auto-generated)
        const isValid = row.full_name && row.city && row.native_language && row.email;
        if (!isValid) {
          console.log('Row filtered out - missing required fields:', {
            hasName: !!row.full_name,
            hasCity: !!row.city,
            hasLanguage: !!row.native_language,
            hasEmail: !!row.email,
            row: JSON.stringify(row, null, 2)
          });
        }
        return isValid;
      });

      console.log(`Valid rows: ${validRows.length} out of ${mappedRows.length}`);
      
      // Log detailed statistics about why rows were filtered
      if (validRows.length < mappedRows.length) {
        const filteredCount = mappedRows.length - validRows.length;
        console.log(`⚠️  ${filteredCount} rows were filtered out. Reasons:`);
        
        const missingFields = {
          name: 0,
          city: 0,
          language: 0,
          email: 0
        };
        
        mappedRows.forEach((row: any) => {
          if (!row.full_name) missingFields.name++;
          if (!row.city) missingFields.city++;
          if (!row.native_language) missingFields.language++;
          if (!row.email && !row.phone) missingFields.email++;
        });
        
        console.log(`Missing fields breakdown:`, missingFields);
        
        // Show first few invalid rows for debugging
        const invalidRows = mappedRows.filter((row: any) => {
          return !row.full_name || !row.city || !row.native_language;
        }).slice(0, 3);
        
        if (invalidRows.length > 0) {
          console.log(`Sample invalid rows (first 3):`, invalidRows.map((r: any) => ({
            name: r.full_name || 'MISSING',
            city: r.city || 'MISSING',
            language: r.native_language || 'MISSING',
            phone: r.phone || 'none'
          })));
        }
      }
      
      if (validRows.length === 0 && mappedRows.length > 0) {
        console.log('Sample invalid row:', JSON.stringify(mappedRows[0], null, 2));
        console.log('Sample original row:', JSON.stringify(rows[0], null, 2));
        console.log('Available columns:', Object.keys(rows[0]));
        
        // Build detailed error message with available columns
        const availableColumns = Object.keys(rows[0]).join(', ');
        errors.push(`[${sheetDisplayName}] לא נמצאו רשומות תקינות ב-${table}. בדוק שהעמודות הבאות קיימות: שם (או שם פרטי+שם משפחה), מזהה איש קשר (או אימייל), עיר, שפת אם. עמודות זמינות: ${availableColumns}`);
        continue;
      }

      if (validRows.length === 0 && mappedRows.length === 0) {
        errors.push(`[${sheetDisplayName}] גיליון ריק או לא מכיל נתונים תקינים`);
        continue;
      }

      console.log(`Upserting ${validRows.length} valid rows into ${table}`);

      if (validRows.length > 0) {
        // Remove duplicates by email before upserting to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const uniqueRowsMap = new Map<string, any>();
        for (const row of validRows) {
          const email = row.email;
          // Keep the last occurrence of each email (or first - doesn't matter, just need unique)
          if (!uniqueRowsMap.has(email)) {
            uniqueRowsMap.set(email, row);
          } else {
            console.log(`Duplicate email found: ${email}, keeping first occurrence`);
          }
        }
        const uniqueRows = Array.from(uniqueRowsMap.values());
        
        console.log(`After deduplication: ${uniqueRows.length} unique rows out of ${validRows.length} total rows`);

        // Use upsert based on email (unique constraint)
        // Process in smaller batches to avoid timeout issues
        const batchSize = 100;
        let totalUpsertedForTable = 0;
        
        for (let i = 0; i < uniqueRows.length; i += batchSize) {
          const batch = uniqueRows.slice(i, i + batchSize);
          console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(uniqueRows.length / batchSize)} (${batch.length} rows)`);
          
          const { data: upsertedData, error: upsertError } = await supabaseClient
            .from(table)
            .upsert(batch, {
              onConflict: 'email',
              ignoreDuplicates: false
            })
            .select();

          if (upsertError) {
            console.error(`Error upserting batch into ${table}:`, upsertError);
            errors.push(`[${sheetDisplayName}] שגיאה בעדכון ${table} (batch ${Math.floor(i / batchSize) + 1}): ${upsertError.message}`);
            continue;
          }

          totalUpsertedForTable += upsertedData?.length || 0;
          console.log(`Successfully upserted ${upsertedData?.length || 0} rows in batch ${Math.floor(i / batchSize) + 1}`);
        }
        
        totalUpserted += totalUpsertedForTable;
        console.log(`Successfully upserted total ${totalUpsertedForTable} rows into ${table}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        inserted: totalUpserted,
        message: errors.length > 0 
          ? `הועלו ${totalUpserted} רשומות. ${errors.length} שגיאות: ${errors.join('; ')}`
          : `Successfully imported ${totalUpserted} records`,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: errors.length > 0 ? 207 : 200, // 207 Multi-Status
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
