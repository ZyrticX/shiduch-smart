# מערכת שיבוץ חכמה - תיעוד טכני

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/ZyrticX/shiduch-smart)
[![License](https://img.shields.io/badge/License-MIT-green)](https://github.com/ZyrticX/shiduch-smart)

## סקירה כללית

מערכת שיבוץ חכמה היא אפליקציית Web מודרנית לניהול שיבוצים אוטומטי בין סטודנטים למתנדבים. המערכת בנויה על ארכיטקטורה מודרנית עם Frontend ו-Backend מופרדים.

**Repository**: [https://github.com/ZyrticX/shiduch-smart](https://github.com/ZyrticX/shiduch-smart)

## ארכיטקטורה

### Frontend
- **Framework**: React 18.3+ עם TypeScript
- **Build Tool**: Vite 5.4+
- **Routing**: React Router DOM 6.30+
- **State Management**: TanStack Query (React Query) 5.83+
- **UI Library**: shadcn/ui (Radix UI components)
- **Styling**: Tailwind CSS 3.4+ עם CSS-in-JS
- **Icons**: Lucide React
- **Charts**: Recharts 2.15+
- **Form Handling**: React Hook Form 7.61+ עם Zod validation
- **RTL Support**: תמיכה מלאה בעברית (dir="rtl")
- **Responsive Design**: מותאם לנייד, טאבלט ומחשב
- **Authentication**: הגנת סיסמה בסיסית (sessionStorage)

### Backend
- **Database**: PostgreSQL (דרך Supabase)
- **Backend Services**: Supabase Edge Functions (Deno runtime)
- **Real-time**: Supabase Realtime subscriptions
- **Authentication**: Supabase Auth (מוכן לפריסה)
- **Storage**: Supabase Storage (מוכן לפריסה)

## מבנה הפרויקט

```
shiduch-smart/
├── src/
│   ├── components/          # רכיבי React
│   │   ├── ui/             # רכיבי UI בסיסיים (shadcn/ui)
│   │   ├── ExcelUpload.tsx # העלאת קבצי Excel
│   │   ├── MatchesTable.tsx # טבלת התאמות
│   │   ├── StatsCard.tsx   # כרטיס סטטיסטיקה
│   │   └── Login.tsx       # מסך התחברות
│   ├── pages/              # דפי האפליקציה
│   │   ├── Index.tsx       # דף ראשי
│   │   ├── Students.tsx    # ניהול סטודנטים
│   │   ├── Volunteers.tsx # ניהול מתנדבים
│   │   ├── ApprovedMatches.tsx # התאמות מאושרות
│   │   ├── Analytics.tsx   # דוחות וניתוח
│   │   └── AuditLogs.tsx  # לוג התראות
│   ├── integrations/
│   │   └── supabase/       # הגדרות Supabase
│   │       ├── client.ts   # Supabase client
│   │       └── types.ts    # TypeScript types
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # פונקציות עזר
│   └── App.tsx             # רכיב ראשי
├── supabase/
│   ├── migrations/         # מיגרציות מסד נתונים
│   ├── functions/          # Edge Functions
│   │   ├── generate-matches/    # אלגוריתם התאמה
│   │   ├── update-match-status/  # עדכון סטטוס התאמה
│   │   ├── import-excel/        # ייבוא מ-Excel
│   │   └── notify-match/        # שליחת התראות
│   └── config.toml          # הגדרות Supabase
└── public/                  # קבצים סטטיים
```

## מסד הנתונים

### Schema Overview

#### טבלה: `students`
```sql
- id: UUID (Primary Key)
- full_name: TEXT (NOT NULL)
- email: TEXT (NOT NULL, UNIQUE)
- phone: TEXT
- city: TEXT (NOT NULL)
- native_language: TEXT (NOT NULL)
- gender: TEXT
- special_requests: TEXT
- latitude: DECIMAL(10, 8)
- longitude: DECIMAL(11, 8)
- is_matched: BOOLEAN (DEFAULT false)
- created_at: TIMESTAMPTZ (DEFAULT now())
```

**Indexes:**
- `idx_students_city` על `city`
- `idx_students_matched` על `is_matched`

#### טבלה: `volunteers`
```sql
- id: UUID (Primary Key)
- full_name: TEXT (NOT NULL)
- email: TEXT (NOT NULL, UNIQUE)
- phone: TEXT
- city: TEXT (NOT NULL)
- native_language: TEXT (NOT NULL)
- gender: TEXT
- capacity: INTEGER (DEFAULT 1)
- current_matches: INTEGER (DEFAULT 0)
- latitude: DECIMAL(10, 8)
- longitude: DECIMAL(11, 8)
- is_active: BOOLEAN (DEFAULT true)
- created_at: TIMESTAMPTZ (DEFAULT now())
```

**Indexes:**
- `idx_volunteers_city` על `city`
- `idx_volunteers_active` על `is_active`

#### טבלה: `matches`
```sql
- id: UUID (Primary Key)
- student_id: UUID (FK → students.id, ON DELETE CASCADE)
- volunteer_id: UUID (FK → volunteers.id, ON DELETE CASCADE)
- confidence_score: INTEGER (CHECK 0-100)
- match_reason: TEXT
- status: TEXT (DEFAULT 'pending', CHECK IN ('pending', 'approved', 'rejected'))
- created_at: TIMESTAMPTZ (DEFAULT now())
- approved_at: TIMESTAMPTZ
- UNIQUE(student_id, volunteer_id)
```

**Indexes:**
- `idx_matches_status` על `status`

#### טבלה: `audit_log`
```sql
- id: UUID (Primary Key)
- match_id: UUID (FK → matches.id, ON DELETE CASCADE)
- action: TEXT (NOT NULL)
- actor_type: TEXT (DEFAULT 'system')
- recipient_email: TEXT
- recipient_phone: TEXT
- notification_channel: TEXT
- status: TEXT (DEFAULT 'pending', CHECK IN ('pending', 'sent', 'failed'))
- error_message: TEXT
- metadata: JSONB
- created_at: TIMESTAMPTZ (DEFAULT now())
```

**Indexes:**
- `idx_audit_log_match_id` על `match_id`
- `idx_audit_log_created_at` על `created_at DESC`
- `idx_audit_log_status` על `status`

### Database Functions & Triggers

#### Function: `update_volunteer_capacity()`
טריגר אוטומטי שמתעדכן כאשר סטטוס התאמה משתנה:

```sql
- כאשר התאמה מאושרת:
  * מעדכן volunteers.current_matches += 1
  * מעדכן students.is_matched = true

- כאשר התאמה נדחית/מבוטלת:
  * מעדכן volunteers.current_matches -= 1
  * מעדכן students.is_matched = false
```

**Trigger:** `on_match_status_change` על `matches` table

### Row Level Security (RLS)
כל הטבלאות מוגנות ב-RLS עם פוליסה שמאפשרת גישה למשתמשים מאומתים (כרגע - כולם, להגדרה בהמשך).

## Edge Functions

### `generate-matches`
**מטרה**: יצירת התאמות חכמות בין סטודנטים למתנדבים

**Input:**
```typescript
{
  minScore?: number;  // ציון מינימלי (default: 60)
  limit?: number;     // מקסימום התאמות (default: 100)
}
```

**אלגוריתם ההתאמה:**
1. טוען סטודנטים שלא משובצים (`is_matched = false`)
2. טוען מתנדבים פעילים עם קיבולת פנויה (`is_active = true` ו-`current_matches < capacity`)
3. מחשב התאמות לכל זוג (student, volunteer):
   - **שפת אם זהה**: 60 נקודות
   - **אותה עיר**: 40 נקודות
   - **עיר סמוכה (<150 ק"מ)**: 20 נקודות
   - **התאמת מין**: 15 נקודות
   - **בקשות מיוחדות**: 5 נקודות
4. מסנן התאמות מתחת לציון מינימלי או מעל 150 ק"מ
5. ממיין לפי ציון (גבוה לנמוך)
6. מבצע הקצאה חמדנית (Greedy):
   - כל סטודנט מקבל רק התאמה אחת
   - כל מתנדב לא יעבור את הקיבולת שלו
   - בודק התאמות קיימות כדי למנוע כפילויות

**חישוב מרחק:**
משתמש בנוסחת Haversine לחישוב מרחק בין שתי נקודות גאוגרפיות:
```typescript
R = 6371 km (רדיוס כדור הארץ)
distance = R * 2 * atan2(√a, √(1-a))
```

**Output:**
```typescript
{
  suggestedCount: number;
  message: string;
}
```

### `update-match-status`
**מטרה**: עדכון סטטוס התאמה (אישור/דחייה)

**Input:**
```typescript
{
  matchId: string;
  action: 'approve' | 'reject';
}
```

**תהליך אישור:**
1. בודק שההתאמה קיימת וסטטוסה `pending`
2. בודק שהמתנדב לא הגיע למכסה (`current_matches < capacity`)
3. בודק שהסטודנט לא משובץ (`is_matched = false`)
4. מעדכן `matches.status = 'approved'` ו-`approved_at = now()`
5. הטריגר `update_volunteer_capacity` מעדכן אוטומטית:
   - `volunteers.current_matches += 1`
   - `students.is_matched = true`
6. מפעיל אסינכרונית את `notify-match` להתראות

**תהליך דחייה:**
1. מעדכן `matches.status = 'rejected'`
2. הטריגר לא מתעדכן (הסטודנט נשאר לא משובץ)

### `import-excel`
**מטרה**: ייבוא נתונים מקובץ Excel

**Input:**
```typescript
{
  data: Array<{
    table: 'students' | 'volunteers';
    rows: Array<Record<string, any>>;
  }>;
}
```

**תהליך:**
1. ממיר את הנתונים לפורמט המתאים
2. מנסה להתאים עמודות לשדות בטבלה
3. מוסיף רשומות חדשות (UPSERT על בסיס email)
4. מחזיר מספר רשומות שנוספו

### `notify-match`
**מטרה**: שליחת התראות לסטודנט ולמתנדב על התאמה שאושרה

**Input:**
```typescript
{
  matchId: string;
}
```

**תהליך:**
1. טוען את פרטי ההתאמה, הסטודנט והמתנדב
2. שולח התראה במייל (או SMS, אם מוגדר)
3. רושם ב-`audit_log` את תוצאות השליחה

## Real-time Updates

המערכת משתמשת ב-Supabase Realtime כדי לעדכן את הממשק בזמן אמת:

```typescript
// דוגמה - עדכון סטטיסטיקות בזמן אמת
const channel = supabase
  .channel('stats-updates')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'students' }, 
    loadStats
  )
  .subscribe();
```

**Channels מוגדרים:**
- `stats-updates` - עדכון סטטיסטיקות
- `matches-updates` - עדכון התאמות
- `approved-matches-updates` - עדכון התאמות מאושרות
- `audit-logs-updates` - עדכון לוגים

## Frontend Architecture

### State Management

**React Query** משמש לניהול state של server data:
- Caching אוטומטי
- Background refetching
- Optimistic updates
- Error handling

**Local State** (useState) משמש ל:
- UI state (modals, drawers, forms)
- Filters ו-search
- Client-side calculations

### Component Structure

**Pages** - דפים ראשיים עם routing:
- `Index` - דף ראשי עם סטטיסטיקות והתאמות (responsive + RTL)
- `Students` - CRUD לסטודנטים (responsive + RTL)
- `Volunteers` - CRUD למתנדבים (responsive + RTL)
- `ApprovedMatches` - צפייה בייצוא התאמות מאושרות (responsive + RTL)
- `Analytics` - דוחות וניתוח (responsive + RTL)
- `AuditLogs` - לוג התראות (responsive + RTL)
- `NotFound` - דף 404 (responsive + RTL)

**Components** - רכיבים לשימוש חוזר:
- `MatchesTable` - טבלת התאמות עם פעולות (responsive)
- `StatsCard` - כרטיס סטטיסטיקה (responsive)
- `ExcelUpload` - העלאת קבצי Excel (responsive)
- `Login` - מסך התחברות עם הגנת סיסמה (RTL + responsive)

**UI Components** - רכיבי shadcn/ui:
- כל הרכיבים הבסיסיים (Button, Card, Table, Dialog, וכו')

### Routing

```typescript
/ → Index (מוגן בסיסמה)
/students → Students (מוגן בסיסמה)
/volunteers → Volunteers (מוגן בסיסמה)
/approved-matches → ApprovedMatches (מוגן בסיסמה)
/analytics → Analytics (מוגן בסיסמה)
/audit-logs → AuditLogs (מוגן בסיסמה)
* → NotFound (404)
```

**Authentication Flow:**
1. בודק `sessionStorage.getItem("site_authenticated")`
2. אם לא מאומת → מציג מסך Login
3. אם מאומת → מציג את האפליקציה
4. בדיקה תקופתית של תוקף האימות (כל 5 דקות)
5. אימות פג תוקף אחרי 24 שעות

## Styling

**Tailwind CSS** עם:
- Custom theme colors
- Dark mode support (מוכן)
- **RTL support** - תמיכה מלאה בעברית (`dir="rtl"` ב-HTML ו-body)
- **Responsive design** - mobile-first עם breakpoints:
  - `sm:` - 640px (נייד גדול)
  - `md:` - 768px (טאבלט)
  - `lg:` - 1024px (מחשב)
  - `xl:` - 1280px (מסך גדול)

**Component Styling:**
- shadcn/ui components עם CSS variables
- Consistent spacing ו-typography
- Animations עם `tailwindcss-animate`
- Responsive typography (`text-2xl sm:text-3xl md:text-4xl`)
- Responsive padding (`p-3 sm:p-4 md:p-6`)

**Responsive Features:**
- טבלאות עם `overflow-x-auto` למובייל
- עמודות נסתרות במובייל (`hidden sm:table-cell`)
- כפתורים עם טקסט מקוצר במובייל
- Grids responsive (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)
- גרפים מותאמים למסך קטן (גובה דינמי)

## Build & Deployment

### Development
```bash
npm run dev          # Vite dev server
npm run lint         # ESLint
```

### Production Build
```bash
npm run build        # Vite production build
npm run preview      # Preview production build locally
```

### Environment Variables
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Deployment
המערכת מוכנה לפריסה ב:
- **Vercel** / **Netlify** - Frontend
- **Supabase** - Backend + Database

## Performance Considerations

### Database
- **Indexes** על עמודות נפוצות (city, status, is_matched)
- **Foreign Keys** עם CASCADE למניעת נתונים יתומים
- **RLS Policies** מותאמות לשאילתות

### Frontend
- **Code Splitting** - Vite עושה זאת אוטומטית
- **Lazy Loading** - אפשר להוסיף React.lazy לדפים
- **Memoization** - React.memo על רכיבים כבדים
- **Virtual Scrolling** - אפשר להוסיף לטבלאות גדולות

### Edge Functions
- **Chunking** - מעובדים בקבוצות כדי למנוע timeout
- **Transaction Safety** - עדכונים אטומיים
- **Error Handling** - try-catch עם הודעות ברורות

## Security

### Database Level
- **RLS** מופעל על כל הטבלאות
- **SQL Injection** - מונע על ידי parameterized queries של Supabase
- **Schema Validation** - CHECK constraints על ערכים

### API Level
- **CORS** מוגדר ב-Edge Functions
- **Authentication** - מוכן למוסיף Supabase Auth
- **Rate Limiting** - אפשר להוסיף ב-Supabase

### Frontend Level
- **Input Validation** - Zod schemas
- **XSS Prevention** - React משתמש ב-escape אוטומטי
- **CSRF** - לא רלוונטי ל-SPA עם Supabase
- **Password Protection** - הגנת סיסמה בסיסית עם sessionStorage
  - אימות תקף ל-24 שעות
  - נמחק עם סגירת הדפדפן
  - בדיקה תקופתית של תוקף האימות

## Testing (מוכן לפריסה)

### Unit Tests
```bash
npm run test         # (להגדיר)
```

### E2E Tests
```bash
npm run test:e2e     # (להגדיר)
```

## Monitoring & Logging

### Frontend Logging
- Console logs לפיתוח
- Error boundaries ל-catch errors
- Toast notifications למשתמש

### Backend Logging
- Supabase Edge Functions logs
- `audit_log` table למעקב התראות
- Database triggers ל-tracking שינויים

## Authentication & Security

### Password Protection

המערכת כוללת הגנת סיסמה בסיסית:

**Implementation:**
- קומפוננטת `Login.tsx` עם שדה סיסמה
- בדיקת סיסמה מול קבוע `SITE_PASSWORD` בקוד
- שמירה ב-`sessionStorage` (לא ב-`localStorage`)
- תוקף אימות: 24 שעות

**Security Features:**
- הסיסמה נמחקת עם סגירת הדפדפן
- בדיקה תקופתית של תוקף האימות
- הגנה מפני גישה אקראית (לא מתאימה לאפליקציות רגישות מאוד)

**שינוי סיסמה:**
ערוך את `SITE_PASSWORD` ב-`src/components/Login.tsx`

**הערות:**
- ⚠️ הסיסמה נשמרת בקוד הקליינט (לא מומלץ לייצור)
- ✅ מתאים להגנה מפני גישה אקראית
- 💡 לעתיד: מומלץ להעביר ל-Supabase Auth

## RTL & Internationalization

### RTL Support

המערכת כוללת תמיכה מלאה בעברית:

**Implementation:**
- `dir="rtl"` ב-HTML root (`index.html`)
- `dir="rtl"` ב-CSS גלובלי (`index.css`)
- `dir="rtl"` בכל קומפוננטת דף
- `text-right` על כל הטקסטים
- `flex-row-reverse` על flex containers

**Components:**
- כל הקומפוננטות מותאמות ל-RTL
- טבלאות עם `text-right` על כל העמודות
- כפתורים עם אייקונים מותאמים ל-RTL
- Drawers ו-Dialogs מותאמים ל-RTL

## Responsive Design

### Mobile & Tablet Support

המערכת מותאמת באופן מלא למכשירים שונים:

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Responsive Features:**
- **Typography**: `text-2xl sm:text-3xl md:text-4xl`
- **Spacing**: `p-3 sm:p-4 md:p-6`
- **Grids**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- **Tables**: `overflow-x-auto` עם עמודות נסתרות במובייל
- **Buttons**: טקסט מקוצר במובייל (`hidden sm:inline`)
- **Charts**: גובה דינמי (`h-[250px] sm:h-[300px]`)
- **Forms**: פריסה אנכית במובייל, אופקית בטאבלט

**Mobile Optimizations:**
- טבלאות עם גלילה אופקית
- עמודות פחות חשובות נסתרות (`hidden sm:table-cell`)
- כפתורים עם גודל מותאם (`text-xs sm:text-sm`)
- Drawers במקום Dialogs למובייל

## Future Enhancements

### אפשרויות להרחבה:
1. **Authentication** - Supabase Auth עם משתמשים אמיתיים
2. **Email Notifications** - שילוב עם SendGrid/Mailgun
3. **SMS Notifications** - שילוב עם Twilio
4. **Batch Operations** - פעולות על מספר רשומות
5. **Advanced Filters** - חיפוש מורכב יותר
6. **Export Options** - PDF, Excel formats
7. **Match History** - היסטוריית התאמות לכל סטודנט/מתנדב
8. **Rating System** - דירוג התאמות אחרי אישור
9. **Mobile App** - React Native / Flutter
10. **Admin Dashboard** - פאנל ניהול מתקדם
11. **PWA Support** - Progressive Web App
12. **Offline Mode** - עבודה במצב offline
13. **Multi-language** - תמיכה בשפות נוספות
14. **Dark Mode** - מצב כהה מלא

## Dependencies

### Core
- `react` ^18.3.1
- `react-dom` ^18.3.1
- `typescript` ^5.8.3
- `vite` ^5.4.19

### UI & Styling
- `@radix-ui/*` - UI primitives
- `tailwindcss` ^3.4.17
- `lucide-react` ^0.462.0
- `recharts` ^2.15.4

### State & Data
- `@tanstack/react-query` ^5.83.0
- `@supabase/supabase-js` ^2.78.0
- `react-router-dom` ^6.30.1

### Forms & Validation
- `react-hook-form` ^7.61.1
- `zod` ^3.25.76
- `@hookform/resolvers` ^3.10.0

### Utilities
- `xlsx` ^0.18.5 - Excel parsing
- `date-fns` ^3.6.0 - Date manipulation
- `clsx` + `tailwind-merge` - Conditional classes

## Contributing

### Code Style
- **ESLint** עם TypeScript rules
- **Prettier** (מומלץ להוסיף)
- **Conventional Commits** (מומלץ)

### Git Workflow
1. Fork את ה-repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Make changes
4. Test locally (`npm run dev`)
5. Commit with clear message (`git commit -m 'Add some AmazingFeature'`)
6. Push to branch (`git push origin feature/AmazingFeature`)
7. Open Pull Request ב-GitHub

### Repository Structure
```
https://github.com/ZyrticX/shiduch-smart
├── src/              # קוד מקור Frontend
├── supabase/         # Backend & Database
├── public/           # קבצים סטטיים
├── README.md         # מדריך למשתמש
├── TECHNICAL.md      # תיעוד טכני
└── package.json      # Dependencies
```

### Development Setup
```bash
# Clone repository
git clone https://github.com/ZyrticX/shiduch-smart.git
cd shiduch-smart

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
npm run dev

# Build for production
npm run build
```

---

**Maintained by**: [ZyrticX](https://github.com/ZyrticX)  
**Repository**: [https://github.com/ZyrticX/shiduch-smart](https://github.com/ZyrticX/shiduch-smart)  
**Last Updated**: 2025  
**Version**: 1.0.0

