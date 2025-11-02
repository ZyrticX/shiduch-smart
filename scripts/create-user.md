# יצירת משתמש במערכת

## דרך 1: שימוש בסקריפט Node.js

1. הוסף את משתני הסביבה הבאים:
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

2. הרץ את הסקריפט:
```bash
node scripts/create-user.js
```

הסקריפט יוצר משתמש עם:
- **Email**: `idf_2025@example.com`
- **Password**: סיסמה אקראית מאובטחת (תוצג במסך)

## דרך 2: שימוש ב-Supabase Dashboard

1. היכנס ל-[Supabase Dashboard](https://supabase.com/dashboard)
2. בחר את הפרויקט שלך
3. לך ל-**Authentication** > **Users**
4. לחץ על **Add User** > **Create new user**
5. מלא:
   - Email: `idf_2025@example.com`
   - Password: [בחר סיסמה]
   - Auto Confirm User: ✅ (סמן)

## דרך 3: שימוש ב-SQL ישירות

```sql
-- Note: This requires direct database access
-- You can't create auth users directly via SQL
-- Use Supabase Admin API or Dashboard instead
```

## דרך 4: יצירת Edge Function

אפשר ליצור Edge Function שיוצר משתמש דרך API.

## חשוב!

- הסיסמה תוצג רק פעם אחת - שמור אותה במקום בטוח
- אם המשתמש כבר קיים, הסיסמה תתעדכן
- ודא שיש לך את ה-Service Role Key מהפרויקט שלך

