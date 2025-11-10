# Vercel Environment Variables Checklist

## ✅ מה לבדוק ב-Vercel:

### 1. וודא שהמשתנים מוגדרים:
לך ל: **Settings** → **Environment Variables**

ודא שיש לך:
```
VITE_SUPABASE_URL = https://lijxsieewetgiiisknnj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = sb_publishable_5pp0ahxJ1v0RTEJ6utu8aA_o7KnHQRT
```

### 2. וודא שהם מוגדרים לכל ה-Environments:
- ✅ **Production**
- ✅ **Preview** 
- ✅ **Development**

### 3. בדוק את ה-Build Logs:
1. לך ל-**Deployments**
2. לחץ על ה-deployment האחרון
3. לחץ על **"Build Logs"**
4. חפש את הודעה: `Environment Variables Check`
5. ודא שה-`VITE_SUPABASE_URL` מופיע שם

### 4. בדוק את ה-Runtime Logs:
אם יש שגיאה, לך ל-**Functions** → **Logs** ותראה מה השגיאה

### 5. בדוק את ה-Console בדפדפן:
פתח את ה-Developer Tools (F12) → Console
חפש את ההודעה: `Environment check:`

## 🔍 פתרון בעיות נפוצות:

### בעיה: המשתנים לא נטענים
**פתרון:**
1. ודא שהשמות נכונים (VITE_ prefix)
2. ודא שאין רווחים לפני/אחרי הערך
3. ודא שה-Environment נבחר נכון (Production/Preview/Development)
4. תעשה **Redeploy** אחרי עדכון

### בעיה: המשתנים בטוחים אבל לא עובדים
**פתרון:**
1. ודא שהערכים נכונים (ללא quotes נוספות)
2. בדוק שה-URL מתחיל ב-`https://`
3. בדוק שה-Key לא פג תוקף

### בעיה: Build עובד אבל Runtime לא
**פתרון:**
1. ודא שהמשתנים מוגדרים גם ל-**Runtime**
2. בדוק שה-`vercel.json` לא חוסם אותם
3. בדוק את ה-Runtime Logs

## 📝 בדיקה מקומית:

```bash
# בדוק שהקובץ .env קיים
type .env

# הרץ את הסקריפט לבדיקה
node scripts/check-env.js

# הרץ build מקומי
npm run build
```

## 🔗 קישורים שימושיים:

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)






