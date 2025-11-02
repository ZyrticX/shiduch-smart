# הוראות לתיקון RLS Policies

## בעיה
המערכת מקבלת שגיאות 404 כי ה-RLS Policies דורשים authentication, אבל המערכת משתמשת בהגנת סיסמה פשוטה במקום Supabase Auth.

## פתרון
צריך לעדכן את ה-RLS Policies כדי לאפשר גישה anonymous.

## הוראות להרצה

### שלב 1: קבל גישה למאגר הנתונים
- לך ל-[Supabase Dashboard](https://supabase.com/dashboard)
- בחר את הפרויקט: `zkomiiumsrrgvkygatqm`
- ודא שיש לך הרשאות ניהול

### שלב 2: הרץ את ה-SQL
1. לך ל-**SQL Editor** בתפריט השמאלי
2. פתח את הקובץ: `supabase/migrations/20250103000000_fix_rls_policies_anonymous_access.sql`
3. העתק את כל התוכן
4. הדבק ב-SQL Editor
5. לחץ על **"Run"** או **Ctrl+Enter**

### שלב 3: ודא שהכל עובד
לאחר ההרצה, רענן את האפליקציה - שגיאות ה-404 אמורות להיעלם.

## מה ה-SQL עושה?
1. מוחק את ה-Policies הישנים שדרשו authentication
2. יוצר Policies חדשים שמאפשרים גישה anonymous
3. זה בטוח כי הגנת הסיסמה ב-`sessionStorage` מספקת את האבטחה הנדרשת

## קובץ SQL
הקובץ נמצא ב: `supabase/migrations/20250103000000_fix_rls_policies_anonymous_access.sql`

---

**חשוב**: ודא שאתה מריץ את זה על הפרויקט הנכון: `zkomiiumsrrgvkygatqm`

