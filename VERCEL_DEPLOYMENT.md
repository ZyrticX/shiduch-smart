# הוראות העלאה ל-Vercel

## דרישות מוקדמות

1. חשבון Vercel (חינם) - [הרשמה כאן](https://vercel.com/signup)
2. GitHub repository עם כל הקוד (כבר קיים)

## שלב 1: הכנת משתני הסביבה

1. העתק את הקובץ `.env.example` ל-`.env.local` (במקומי)
2. ודא שהערכים ב-`.env.local` נכונים:
   - `VITE_SUPABASE_URL` - URL של הפרויקט Supabase החדש
   - `VITE_SUPABASE_PUBLISHABLE_KEY` - Anon Key של Supabase

## שלב 2: העלאה ל-Vercel

### דרך 1: דרך ה-Dashboard (המומלץ)

1. לך ל-[Vercel Dashboard](https://vercel.com/dashboard)
2. לחץ על **"Add New Project"** או **"Import Project"**
3. בחר את ה-repository `ZyrticX/shiduch-smart`
4. Vercel יזהה אוטומטית שזה פרויקט Vite:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. לחץ על **"Environment Variables"** והוסף:
   ```
   VITE_SUPABASE_URL = https://lijxsieewetgiiisknnj.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY = sb_publishable_5pp0ahxJ1v0RTEJ6utu8aA_o7KnHQRT
   ```
6. לחץ על **"Deploy"**

### דרך 2: דרך CLI

```bash
# התקן Vercel CLI
npm i -g vercel

# התחבר ל-Vercel
vercel login

# העלה את הפרויקט
vercel

# בעת ההעלאה:
# - ? Set up and deploy? Y
# - ? Which scope? בחר את החשבון שלך
# - ? Link to existing project? N
# - ? What's your project's name? shiduch-smart
# - ? In which directory is your code located? ./
# - ? Want to override the settings? N

# הוסף משתני סביבה
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY

# Deploy production
vercel --prod
```

## שלב 3: וידוא שהכל עובד

לאחר ההעלאה:

1. Vercel ייתן לך URL (למשל: `shiduch-smart.vercel.app`)
2. פתח את ה-URL בדפדפן
3. ודא שהמערכת נטענת ללא שגיאות
4. בדוק שהסיסמה עובדת (`idf_2025`)
5. בדוק שניתן לטעון נתונים מ-Supabase

## הגדרות נוספות

### Custom Domain (אופציונלי)

1. לך ל-**Settings** → **Domains**
2. הוסף domain משלך
3. עקוב אחר ההוראות ל-DNS

### Environment Variables

אם אתה צריך לעדכן משתני סביבה:

1. לך ל-**Settings** → **Environment Variables**
2. עדכן את הערכים
3. **Redeploy** את הפרויקט

## פתרון בעיות

### שגיאת Build

- ודא ש-`npm run build` עובד מקומית
- בדוק את ה-logs ב-Vercel Dashboard

### שגיאת Environment Variables

- ודא שהוספת את כל המשתנים הנדרשים
- ודא שהשמות נכונים (VITE_*)

### שגיאת Routing

- ודא שקובץ `vercel.json` קיים
- ה-rewrite rules אמורים לטפל ב-SPA routing

## קישורים שימושיים

- [Vercel Documentation](https://vercel.com/docs)
- [Vite on Vercel](https://vercel.com/docs/frameworks/vite)
- [Supabase with Vercel](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)

---

**הערה חשובה**: ה-Anon Key של Supabase בטוח לחשיפה ב-client-side כי ה-RLS policies מגנים על הנתונים.

