# יצירת משתמש idf_2025

## אופציה 1: דרך Edge Function (מומלץ)

1. ודא שה-Edge Function מוגדר:
   ```bash
   # הפעל את הפונקציה
   ```

2. צור משתמש דרך API:
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/create-user \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "idf_2025@example.com",
       "password": "YourSecurePassword123!"
     }'
   ```

## אופציה 2: דרך Supabase Dashboard

1. היכנס ל-[Supabase Dashboard](https://supabase.com/dashboard)
2. בחר את הפרויקט שלך
3. לך ל-**Authentication** > **Users**
4. לחץ על **Add User** > **Create new user**
5. מלא:
   - **Email**: `idf_2025@example.com`
   - **Password**: בחר סיסמה חזקה
   - **Auto Confirm User**: ✅ (סמן)

## אופציה 3: סיסמה מומלצת

אם אתה צריך סיסמה מומלצת עבור `idf_2025`, הנה כמה אפשרויות:

**אופציה A (קל לזכור):**
```
Idf2025@Secure!
```

**אופציה B (יותר מאובטח):**
```
IDF_2025_Shiduch_Smart!
```

**אופציה C (אקראי מאובטח):**
```
Kx9#mP2$vL8@nQ4!
```

## לאחר יצירת המשתמש

1. התחבר עם:
   - Email: `idf_2025@example.com`
   - Password: הסיסמה שבחרת

2. ודא שהמשתמש יכול להתחבר ולגשת לממשק הניהול

## הערות חשובות

- שמור את הסיסמה במקום בטוח
- אם תשכח את הסיסמה, תוכל לאפס אותה דרך Supabase Dashboard
- ודא שהמשתמש יש לו הרשאות מתאימות ב-RLS Policies

