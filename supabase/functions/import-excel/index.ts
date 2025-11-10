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
    const duplicates: { name: string; phone: string }[] = [];

    for (const tableData of requestData) {
      const { table, rows, sheetName } = tableData;
      const sheetDisplayName = sheetName || table;

      console.log(`Processing ${rows.length} rows for table: ${table} (sheet: ${sheetDisplayName})`);
      
      // Log first row column names and values for debugging
      if (rows.length > 0) {
        console.log('Column names in Excel:', Object.keys(rows[0]));
        console.log('First row sample data:', JSON.stringify(rows[0], null, 2));
      }

      // Filter out completely empty rows first
      const nonEmptyRows = rows.filter((row: any) => {
        // Check if row has any non-empty values
        const values = Object.values(row);
        return values.some((val: any) => val !== null && val !== undefined && String(val).trim() !== '');
      });
      
      console.log(`Filtered ${rows.length - nonEmptyRows.length} empty rows. Processing ${nonEmptyRows.length} rows with data.`);

      // Map Excel columns to database columns
      const mappedRows = nonEmptyRows.map((row: any, rowIndex: number) => {
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

        // Name handling - prioritize combining "שם פרטי" + "שם משפחה" (from your Excel)
        // Then try "שם מלא" if exists
        const firstName = findColumn(['שם פרטי']);
        const lastName = findColumn(['שם משפחה']);
        
        if (firstName || lastName) {
          // Combine first name + last name
          mapped.full_name = `${firstName || ''} ${lastName || ''}`.trim();
        } else {
          // Fallback to "שם מלא" if exists
          let fullName = findColumn(['שם מלא']);
          if (!fullName) {
            fullName = findColumn(['full_name', 'name', 'שם']);
          }
          if (fullName) {
            mapped.full_name = fullName;
          }
        }
        
        // Log if name is missing for debugging
        if (!mapped.full_name && rowIndex === 0) {
          console.log('⚠️ WARNING: No name found in first row. Available columns:', Object.keys(row));
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
              // Generate UNIQUE email from contact ID + row index to avoid duplicates
              const timestamp = Date.now();
              const random = Math.floor(Math.random() * 100000);
              mapped.email = `contact_${contactId.replace(/\D/g, '')}_row${rowIndex}_${timestamp}_${random}@imported.local`;
            }
          }
        }

        // Phone handling - prioritize "טלפון נייד" (exact match from your Excel)
        let phone = findColumn(['טלפון נייד']);
        if (!phone) {
          // Try other variations
          phone = findColumn([
            'טלפון', 
            'phone', 
            'phone_number', 
            'tel', 
            'mobile'
          ]);
        }
        if (phone) {
          // Clean phone number - remove spaces, dashes, etc. and normalize
          const cleanedPhone = String(phone).replace(/\s+/g, '').replace(/-/g, '').trim();
          // Only set if not empty after cleaning
          if (cleanedPhone && cleanedPhone !== 'X' && cleanedPhone.toUpperCase() !== 'X') {
            mapped.phone = cleanedPhone;
          }
        }
        
        // Log if phone is missing for debugging
        if (!mapped.phone && rowIndex === 0) {
          console.log('⚠️ WARNING: No phone found in first row. Available columns:', Object.keys(row));
        }

        // City - prioritize "עיר מגורים" then "עיר" (both exist in your Excel)
        let city = findColumn(['עיר מגורים']);
        if (!city) {
          city = findColumn(['עיר', 'city']);
        }
        if (city) {
          mapped.city = city;
        }

        // Native language - prioritize "שפת אם" (exact match from your Excel)
        let nativeLang = findColumn(['שפת אם']);
        if (!nativeLang) {
          // Try other variations
          nativeLang = findColumn(['שפות', 'native_language', 'language', 'העדפת שפה', 'שפה']);
        }
        if (nativeLang) {
          mapped.native_language = nativeLang;
        }

        // Gender
        const gender = findColumn(['מין', 'gender', 'sex']);
        if (gender) {
          mapped.gender = gender;
        }

        // Common fields for both tables
        // Contact ID
        const contactId = findColumn(['מזהה איש קשר', 'contact_id', 'contactId', 'מזהה']);
        if (contactId) {
          mapped.contact_id = String(contactId).trim();
        }

        // First name and last name (already used for full_name, but save separately too)
        const firstName = findColumn(['שם פרטי', 'first_name', 'firstName']);
        if (firstName) {
          mapped.first_name = String(firstName).trim();
        }
        const lastName = findColumn(['שם משפחה', 'last_name', 'lastName']);
        if (lastName) {
          mapped.last_name = String(lastName).trim();
        }

        // Dates - try to parse various date formats
        const parseDate = (dateStr: string | null): string | null => {
          if (!dateStr) return null;
          try {
            // Try Excel date serial number
            if (!isNaN(Number(dateStr))) {
              const excelDate = new Date((Number(dateStr) - 25569) * 86400 * 1000);
              if (!isNaN(excelDate.getTime())) {
                return excelDate.toISOString();
              }
            }
            // Try standard date formats
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              return date.toISOString();
            }
          } catch (e) {
            // Ignore parsing errors
          }
          return null;
        };

        const lastReportDate = findColumn(['תאריך דיווח אחרון', 'last_report_date', 'תאריך דיווח']);
        if (lastReportDate) {
          mapped.last_report_date = parseDate(lastReportDate);
        }

        const lastCallDate = findColumn(['שיחה אחרונה', 'last_call_date', 'last_call']);
        if (lastCallDate) {
          mapped.last_call_date = parseDate(lastCallDate);
        }

        // Coordinator
        const coordinator = findColumn(['רכז', 'coordinator', 'רכז מחוז (של חייל)']);
        if (coordinator) {
          mapped.coordinator = String(coordinator).trim();
        }

        // District coordinator (for students)
        const districtCoordinator = findColumn(['רכז מחוז (של חייל)', 'district_coordinator']);
        if (districtCoordinator) {
          mapped.district_coordinator = String(districtCoordinator).trim();
        }

        // Country of origin
        const countryOfOrigin = findColumn(['ארץ מוצא', 'country_of_origin', 'country']);
        if (countryOfOrigin) {
          mapped.country_of_origin = String(countryOfOrigin).trim();
        }

        // How arrived to organization
        const howArrived = findColumn(['כיצד הגיע לעמותה', 'how_arrived_to_organization', 'how_arrived']);
        if (howArrived) {
          mapped.how_arrived_to_organization = String(howArrived).trim();
        }

        // Arrival other notes
        const arrivalOtherNotes = findColumn(['הערות לבחירת "אחר" בהגעה לעמותה', 'arrival_other_notes']);
        if (arrivalOtherNotes) {
          mapped.arrival_other_notes = String(arrivalOtherNotes).trim();
        }

        // Project affiliation
        const projectAffiliation = findColumn(['שיכות לפרויקט', 'project_affiliation', 'project']);
        if (projectAffiliation) {
          mapped.project_affiliation = String(projectAffiliation).trim();
        }

        // Language preference
        const languagePreference = findColumn(['העדפת שפה', 'language_preference', 'preferred_language']);
        if (languagePreference) {
          mapped.language_preference = String(languagePreference).trim();
        }

        // Contact type
        const contactType = findColumn(['סוג איש קשר', 'contact_type', 'type']);
        if (contactType) {
          mapped.contact_type = String(contactType).trim();
        }

        // Origin other notes
        const originOtherNotes = findColumn(['הערות לבחירת הערך "אחר" בארץ מקור', 'origin_other_notes']);
        if (originOtherNotes) {
          mapped.origin_other_notes = String(originOtherNotes).trim();
        }

        // Responsible volunteer
        const responsibleVolunteer = findColumn(['מתנדב/ת אחראי/ת', 'responsible_volunteer', 'responsible']);
        if (responsibleVolunteer) {
          mapped.responsible_volunteer = String(responsibleVolunteer).trim();
        }

        // Table-specific fields
        if (table === 'students') {
          // Special requests / Notes - prioritize "בקשות מיוחדות בזמן בקשה לשיבוץ" from your Excel
          let specialRequests = findColumn(['בקשות מיוחדות בזמן בקשה לשיבוץ']);
          if (!specialRequests) {
            // Then try "הערות לסטטוס"
            specialRequests = findColumn(['הערות לסטטוס']);
          }
          if (!specialRequests) {
            // Fallback to other variations
            specialRequests = findColumn([
              'בקשות מיוחדות', 
              'special_requests', 
              'הערות / בקשות מיוחדות', 
              'הערות',
              'notes',
              'remarks'
            ]);
          }
          if (specialRequests) {
            mapped.special_requests = specialRequests;
          }

          // Status notes (also used for special requests)
          const statusNotes = findColumn(['הערות לסטטוס', 'status_notes', 'notes']);
          if (statusNotes && !mapped.special_requests) {
            mapped.special_requests = String(statusNotes).trim();
          }

          // Military unit
          const militaryUnit = findColumn(['חיל', 'military_unit', 'unit']);
          if (militaryUnit) {
            mapped.military_unit = String(militaryUnit).trim();
          }

          // Service location
          const serviceLocation = findColumn(['מקום שירות', 'service_location', 'location']);
          if (serviceLocation) {
            mapped.service_location = String(serviceLocation).trim();
          }

          // Enlistment date
          const enlistmentDate = findColumn(['תאריך גיוס', 'enlistment_date', 'enlistment']);
          if (enlistmentDate) {
            mapped.enlistment_date = parseDate(enlistmentDate);
          }

          // Release date
          const releaseDate = findColumn(['תאריך שחרור', 'release_date', 'release']);
          if (releaseDate) {
            mapped.release_date = parseDate(releaseDate);
          }

          // Role in unit
          const roleInUnit = findColumn(['תפקיד ביחידה', 'role_in_unit', 'role']);
          if (roleInUnit) {
            mapped.role_in_unit = String(roleInUnit).trim();
          }

          // Volunteer or volunteer (gender indicator)
          const volunteerOrVolunteer = findColumn(['מתנדב או מתנדבת', 'volunteer_or_volunteer']);
          if (volunteerOrVolunteer) {
            mapped.volunteer_or_volunteer = String(volunteerOrVolunteer).trim();
          }

          // Belongs to patrol
          const belongsToPatrol = findColumn(['שייך לסיירת', 'belongs_to_patrol', 'patrol']);
          if (belongsToPatrol) {
            const patrolValue = String(belongsToPatrol).toLowerCase();
            mapped.belongs_to_patrol = patrolValue === 'true' || patrolValue === 'כן' || patrolValue === '1' || patrolValue === 'yes' || patrolValue === '✓';
          }

          // Is soldiers club
          const isSoldiersClub = findColumn(['האם מועדון חיילים', 'is_soldiers_club', 'club']);
          if (isSoldiersClub) {
            const clubValue = String(isSoldiersClub).toLowerCase();
            mapped.is_soldiers_club = clubValue === 'true' || clubValue === 'כן' || clubValue === '1' || clubValue === 'yes' || clubValue === '✓';
          }

          // Participation level
          const participationLevel = findColumn(['עד כמה אני רוצה להשתתף באח גדול ?', 'participation_level', 'participation']);
          if (participationLevel) {
            mapped.participation_level = String(participationLevel).trim();
          }

          // Student status
          const studentStatus = findColumn(['סטטוס חייל', 'student_status', 'status']);
          if (studentStatus) {
            mapped.student_status = String(studentStatus).trim();
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

          // Volunteer start date
          const volunteerStartDate = findColumn(['תאריך התחלת התנדבות', 'volunteer_start_date', 'start_date']);
          if (volunteerStartDate) {
            mapped.volunteer_start_date = parseDate(volunteerStartDate);
          }

          // Languages (separate from native_language)
          const languages = findColumn(['שפות', 'languages']);
          if (languages) {
            mapped.languages = String(languages).trim();
          }

          // Status notes
          const statusNotes = findColumn(['הערות לסטטוס', 'status_notes', 'notes']);
          if (statusNotes) {
            mapped.status_notes = String(statusNotes).trim();
          }

          // User status
          const userStatus = findColumn(['סטטוס מתנדב/ת', 'user_status', 'status']);
          if (userStatus) {
            mapped.user_status = String(userStatus).trim();
          }
        }

        // Log mapping result for first row to debug
        if (rowIndex === 0) {
          console.log('Mapped row 0:', JSON.stringify(mapped, null, 2));
        }
        
        return mapped;
      });

      // Process rows - skip rows that are completely empty (marked with X or empty)
      // Email is required by DB but not by user - we'll auto-generate it for every row
      const validRows = mappedRows
        .map((row: any, index: number) => {
          // Skip rows marked with 'X' or completely empty
          const hasName = row.full_name && String(row.full_name).trim() !== '' && String(row.full_name).trim().toUpperCase() !== 'X';
          const hasPhone = row.phone && String(row.phone).trim() !== '' && String(row.phone).trim().toUpperCase() !== 'X';
          const hasCity = row.city && String(row.city).trim() !== '' && String(row.city).trim().toUpperCase() !== 'X';
          
          // If row is completely empty or marked with X, skip it
          if (!hasName && !hasPhone && !hasCity) {
            return null; // Mark for filtering
          }
          
          // Ensure all values are strings where needed
          if (row.full_name) row.full_name = String(row.full_name).trim();
          if (row.city) row.city = String(row.city).trim();
          if (row.native_language) row.native_language = String(row.native_language).trim();
          
          // Generate missing required fields with defaults instead of filtering
          if (!row.full_name || row.full_name.trim() === '' || row.full_name.trim().toUpperCase() === 'X') {
            row.full_name = `לא צוין_${index}`;
          }
          
          if (!row.city || row.city.trim() === '' || row.city.trim().toUpperCase() === 'X') {
            row.city = 'לא צוין';
          }
          
          if (!row.native_language || row.native_language.trim() === '' || row.native_language.trim().toUpperCase() === 'X') {
            row.native_language = 'לא צוין';
          }
          
          // ALWAYS generate unique email - required by DB but not displayed to user
          // Use row index + timestamp + random to ensure uniqueness across all rows
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 1000000);
          
          if (!row.email || row.email.trim() === '') {
            // Strategy 1: Try phone if available
            if (row.phone) {
              const phoneClean = String(row.phone).replace(/\D/g, '');
              if (phoneClean.length > 0) {
                row.email = `imported_${phoneClean}_${index}_${timestamp}_${random}@shiduch.local`;
              }
            }
            
            // Strategy 2: Generate from name + index + timestamp if no phone
            if (!row.email || row.email.trim() === '') {
              const nameForEmail = row.full_name 
                ? row.full_name.replace(/\s+/g, '.').replace(/[^a-zA-Z0-9.]/g, '').toLowerCase().substring(0, 20)
                : 'user';
              row.email = `${nameForEmail}_${index}_${timestamp}_${random}@shiduch.local`;
            }
            
            // Strategy 3: If still no email (shouldn't happen), use UUID-based
            if (!row.email || row.email.trim() === '') {
              const uuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
              row.email = `imported_${uuid.replace(/-/g, '')}_${index}@shiduch.local`;
            }
          } else {
            row.email = String(row.email).trim();
          }
          
          return row;
        })
        .filter((row: any) => row !== null); // Remove null rows (skipped empty rows)
      
      // Filtered out empty rows marked with X
      const skippedRows = mappedRows.length - validRows.length;
      if (skippedRows > 0) {
        console.log(`⚠️ Skipped ${skippedRows} empty rows (marked with X or completely empty)`);
      }
      console.log(`Processing ${validRows.length} valid rows from ${mappedRows.length} mapped rows`);

      // Check if there are any rows at all
      if (validRows.length === 0) {
        errors.push(`[${sheetDisplayName}] גיליון ריק או לא מכיל נתונים תקינים`);
        continue;
      }
      
      console.log(`✅ Processing ALL ${validRows.length} rows - no filtering, all will be imported`);

      if (validRows.length > 0) {
        // Step 1: Deduplicate rows within the file itself
        const uniqueRowsMap = new Map<string, any>();
        const fileDuplicates: { name: string; phone: string }[] = [];

        for (const row of validRows) {
          const phone = row.phone;
          // Use phone as key, or contact_id if phone is missing, or name+city as fallback
          const key = phone || row.contact_id || `${row.full_name}_${row.city}`;
          
          if (key && uniqueRowsMap.has(key)) {
            fileDuplicates.push({ name: row.full_name, phone: phone || 'ללא טלפון' });
          } else {
            uniqueRowsMap.set(key, row);
          }
        }
        
        const uniqueRowsInFile = Array.from(uniqueRowsMap.values());
        console.log(`After file deduplication: ${uniqueRowsInFile.length} unique rows out of ${validRows.length} total rows`);

        // Step 2: Check against existing records in database
        // Get all phones and contact_ids from unique rows (normalize phone numbers)
        const phonesToCheck = uniqueRowsInFile
          .map(r => r.phone ? String(r.phone).replace(/\s+/g, '').replace(/-/g, '').trim() : null)
          .filter(Boolean);
        const contactIdsToCheck = uniqueRowsInFile
          .map(r => r.contact_id ? String(r.contact_id).trim() : null)
          .filter(Boolean);
        
        // Also check by name+city for rows without phone/contact_id
        const nameCityPairs = uniqueRowsInFile
          .filter(r => !r.phone && !r.contact_id)
          .map(r => ({ name: r.full_name, city: r.city }));
        
        // Load ALL existing records from database to check against (single query is more reliable)
        let existingRecords = new Set<string>();
        let existingNameCity = new Set<string>();
        
        const { data: allExisting, error: allExistingError } = await supabaseClient
          .from(table)
          .select('phone, contact_id, full_name, city');
        
        if (!allExistingError && allExisting) {
          console.log(`Loading ${allExisting.length} existing records from database for duplicate check`);
          allExisting.forEach((r: any) => {
            // Normalize phone for comparison - remove spaces, dashes, and normalize
            const normalizedPhone = r.phone ? String(r.phone).replace(/\s+/g, '').replace(/-/g, '').trim() : null;
            if (normalizedPhone && normalizedPhone !== '' && normalizedPhone !== 'X' && normalizedPhone.toUpperCase() !== 'X') {
              existingRecords.add(`phone:${normalizedPhone}`);
            }
            // Normalize contact_id
            if (r.contact_id) {
              const normalizedContactId = String(r.contact_id).trim();
              if (normalizedContactId !== '' && normalizedContactId !== 'X' && normalizedContactId.toUpperCase() !== 'X') {
                existingRecords.add(`contact_id:${normalizedContactId}`);
              }
            }
            // Add name+city combination for rows without phone/contact_id
            if (r.full_name && r.city) {
              const normalizedName = String(r.full_name).trim().toLowerCase();
              const normalizedCity = String(r.city).trim().toLowerCase();
              if (normalizedName && normalizedCity) {
                existingNameCity.add(`${normalizedName}_${normalizedCity}`);
              }
            }
          });
        } else if (allExistingError) {
          console.error(`Error loading existing records:`, allExistingError);
        }
        
        console.log(`Found ${existingRecords.size} existing records by phone/contact_id, ${existingNameCity.size} by name+city`);

        // Step 3: Filter out rows that already exist in database
        const newRows: any[] = [];
        const dbDuplicates: { name: string; phone: string }[] = [];

        for (const row of uniqueRowsInFile) {
          // Normalize phone number for comparison
          const phone = row.phone ? String(row.phone).replace(/\s+/g, '').replace(/-/g, '').trim() : null;
          const contactId = row.contact_id ? String(row.contact_id).trim() : null;
          
          // Check if record already exists
          const existsByPhone = phone && phone !== '' && existingRecords.has(`phone:${phone}`);
          const existsByContactId = contactId && contactId !== '' && existingRecords.has(`contact_id:${contactId}`);
          
          // Also check by name+city if no phone/contact_id
          let existsByNameCity = false;
          if ((!phone || phone === '') && (!contactId || contactId === '') && row.full_name && row.city) {
            const nameCityKey = `${String(row.full_name).trim().toLowerCase()}_${String(row.city).trim().toLowerCase()}`;
            existsByNameCity = existingNameCity.has(nameCityKey);
          }
          
          if (existsByPhone || existsByContactId || existsByNameCity) {
            dbDuplicates.push({ 
              name: row.full_name, 
              phone: phone || contactId || (existsByNameCity ? `${row.full_name} - ${row.city}` : 'ללא מזהה')
            });
            console.log(`Skipping duplicate: ${row.full_name} (phone: ${phone}, contact_id: ${contactId}, name+city: ${existsByNameCity})`);
          } else {
            // Update phone in row to normalized version
            if (phone) {
              row.phone = phone;
            }
            newRows.push(row);
          }
        }
        
        // Combine file duplicates and database duplicates
        duplicates.push(...fileDuplicates, ...dbDuplicates);
        
        console.log(`After database check: ${newRows.length} new rows to insert, ${dbDuplicates.length} duplicates skipped`);

        // Step 4: Insert only new rows
        if (newRows.length > 0) {
          const batchSize = 100;
          let totalUpsertedForTable = 0;
          
          for (let i = 0; i < newRows.length; i += batchSize) {
            const batch = newRows.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(newRows.length / batchSize)} (${batch.length} rows)`);
            
            const { data: upsertedData, error: upsertError } = await supabaseClient
              .from(table)
              .insert(batch) // Use insert instead of upsert since we already checked for duplicates
              .select();

            if (upsertError) {
              console.error(`Error inserting batch into ${table}:`, upsertError);
              errors.push(`[${sheetDisplayName}] שגיאה בהכנסת ${table} (batch ${Math.floor(i / batchSize) + 1}): ${upsertError.message}`);
              continue;
            }

            totalUpsertedForTable += upsertedData?.length || 0;
            console.log(`Successfully inserted ${upsertedData?.length || 0} rows in batch ${Math.floor(i / batchSize) + 1}`);
          }
          
          totalUpserted += totalUpsertedForTable;
          console.log(`Successfully inserted total ${totalUpsertedForTable} new rows into ${table}`);
        } else {
          console.log(`No new rows to insert for ${table} - all rows already exist in database`);
        }
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
        duplicates: duplicates.length > 0 ? duplicates : undefined, // Return duplicates
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: errors.length > 0 || duplicates.length > 0 ? 207 : 200, // 207 Multi-Status
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
