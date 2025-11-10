import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Save, Settings, Target, TrendingUp, Sparkles, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Setting {
  id: string;
  key: string;
  value: string;
  description: string;
  category: string;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .order("category", { ascending: true })
        .order("key", { ascending: true });

      if (error) throw error;
      setSettings(data || []);
    } catch (error: any) {
      console.error("Error loading settings:", error);
      toast.error("שגיאה בטעינת ההגדרות");
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) =>
      prev.map((setting) =>
        setting.key === key ? { ...setting, value } : setting
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update all settings using upsert
      const updates = settings.map((s) => ({
        key: s.key,
        value: s.value,
        description: s.description,
        category: s.category,
      }));

      const { error } = await supabase.from("settings").upsert(updates, {
        onConflict: "key",
        ignoreDuplicates: false,
      });

      if (error) throw error;

      toast.success("ההגדרות נשמרו בהצלחה");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("שגיאה בשמירת ההגדרות");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm("האם אתה בטוח שברצונך לאפס את כל ההגדרות לברירות מחדל?")) {
      return;
    }

    setSaving(true);
    try {
      const defaultValues: Record<string, string> = {
        nearby_city_distance_km: "150",
        min_match_score: "60",
        max_matches_limit: "100",
        language_match_points: "60",
        same_city_points: "40",
        nearby_city_points: "20",
        gender_match_points: "15",
        special_requests_points: "5",
      };

      const resetUpdates = Object.entries(defaultValues).map(([key, value]) => {
        const existingSetting = settings.find(s => s.key === key);
        return {
          key,
          value,
          description: existingSetting?.description || "",
          category: existingSetting?.category || "matching",
        };
      });

      const { error } = await supabase.from("settings").upsert(resetUpdates, {
        onConflict: "key",
        ignoreDuplicates: false,
      });

      if (error) throw error;

      await loadSettings();
      toast.success("ההגדרות אופסו לברירות מחדל");
    } catch (error: any) {
      console.error("Error resetting settings:", error);
      toast.error("שגיאה באיפוס ההגדרות");
    } finally {
      setSaving(false);
    }
  };

  const getSettingValue = (key: string): string => {
    return settings.find((s) => s.key === key)?.value || "";
  };

  const handleDeleteAllData = async () => {
    const confirmMessage = "⚠️ אזהרה: פעולה זו תמחק את כל הנתונים במאגר!\n\nזה כולל:\n- כל התלמידים\n- כל המשתמשים\n- כל ההתאמות\n- כל הלוגים\n- כל היסטוריית הסריקות\n\nפעולה זו בלתי הפיכה!\n\nהקלד 'מחק הכל' כדי לאשר:";
    
    const userInput = prompt(confirmMessage);
    
    if (userInput !== "מחק הכל") {
      toast.info("הפעולה בוטלה");
      return;
    }

    // Double confirmation
    if (!confirm("האם אתה בטוח לחלוטין שברצונך למחוק את כל הנתונים? פעולה זו בלתי הפיכה!")) {
      return;
    }

    setDeleting(true);
    try {
      // Delete in order (respecting foreign keys)
      const tables = [
        'audit_log',
        'scan_history',
        'matches',
        'students',
        'users'
      ];

      for (const table of tables) {
        // Delete all rows - using a condition that's always true
        const { error } = await supabase
          .from(table)
          .delete()
          .gte('created_at', '1970-01-01'); // This will match all rows since created_at is always >= 1970

        if (error) {
          console.error(`Error deleting from ${table}:`, error);
          // Continue with other tables even if one fails
        }
      }

      toast.success("כל הנתונים נמחקו בהצלחה");
      
      // Reload page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error("Error deleting data:", error);
      toast.error("שגיאה במחיקת הנתונים");
    } finally {
      setDeleting(false);
    }
  };

  const matchingSettings = settings.filter((s) => s.category === "matching");
  const scoringSettings = settings.filter((s) => s.category === "scoring");

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6 lg:p-8" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">טוען הגדרות...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6 lg:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 md:mb-8 gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />
              הגדרות המערכת
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              הגדר פרמטרים לאלגוריתם ההתאמה החכם
            </p>
          </div>
          <Button onClick={() => navigate("/")} variant="outline" className="w-full sm:w-auto">
            <ArrowRight className="ml-2 h-4 w-4" />
            <span className="hidden sm:inline">חזרה לדף הראשי</span>
            <span className="sm:hidden">חזרה</span>
          </Button>
        </div>

        {/* Matching Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              פרמטרי התאמה
            </CardTitle>
            <CardDescription>
              הגדרות כלליות לאלגוריתם ההתאמה
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {matchingSettings.map((setting) => (
              <div key={setting.id} className="space-y-2">
                <Label htmlFor={setting.key} className="text-sm font-medium">
                  {setting.description}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={setting.key}
                    type="number"
                    value={setting.value}
                    onChange={(e) => updateSetting(setting.key, e.target.value)}
                    className="max-w-xs"
                    min="0"
                  />
                  {setting.key.includes("distance") && (
                    <span className="text-sm text-muted-foreground">ק"מ</span>
                  )}
                  {setting.key.includes("score") && (
                    <span className="text-sm text-muted-foreground">נקודות</span>
                  )}
                  {setting.key.includes("limit") && (
                    <span className="text-sm text-muted-foreground">התאמות</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Scoring Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              מערכת ניקוד
            </CardTitle>
            <CardDescription>
              הגדר כמה נקודות לקבל עבור כל קריטריון התאמה
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scoringSettings.map((setting) => (
              <div key={setting.id} className="space-y-2">
                <Label htmlFor={setting.key} className="text-sm font-medium">
                  {setting.description}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={setting.key}
                    type="number"
                    value={setting.value}
                    onChange={(e) => updateSetting(setting.key, e.target.value)}
                    className="max-w-xs"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-muted-foreground">נקודות</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              איך זה עובד?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>מרחק עיר קרובה:</strong> התאמות עם מרחק גדול מזה לא יווצרו.
            </p>
            <p>
              <strong>ציון מינימלי:</strong> רק התאמות עם ציון גבוה או שווה למספר זה יווצרו.
            </p>
            <p>
              <strong>מערכת ניקוד:</strong> סכום כל הנקודות מתקבל מהקריטריונים המתאימים. מקסימום 100 נקודות.
            </p>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              אזור מסוכן
            </CardTitle>
            <CardDescription className="text-destructive/80">
              פעולות בלתי הפיכות - השתמש בזהירות!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleDeleteAllData} 
              variant="destructive" 
              size="lg" 
              className="w-full"
              disabled={deleting || saving}
            >
              {deleting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מוחק...
                </>
              ) : (
                <>
                  <Trash2 className="ml-2 h-4 w-4" />
                  מחק את כל הנתונים במאגר
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              פעולה זו תמחק את כל התלמידים, המשתמשים, ההתאמות והלוגים. פעולה בלתי הפיכה!
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Button onClick={resetToDefaults} variant="outline" size="lg" className="flex-1 sm:flex-initial" disabled={saving || deleting}>
            איפוס לברירות מחדל
          </Button>
          <Button onClick={handleSave} disabled={saving || deleting} size="lg" className="flex-1 sm:flex-initial">
            {saving ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                שומר...
              </>
            ) : (
              <>
                <Save className="ml-2 h-4 w-4" />
                שמור הגדרות
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

