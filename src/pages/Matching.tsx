import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Matching() {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [minScore, setMinScore] = useState([60]);
  const [maxMatches, setMaxMatches] = useState(100);
  const [maxDistance, setMaxDistance] = useState([150]);
  const [cityFilter, setCityFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [matchGender, setMatchGender] = useState(true);
  const [results, setResults] = useState<any>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setResults(null);
    
    try {
      toast.info("מתחיל סריקת התאמות...");
      
      const { data, error } = await supabase.functions.invoke("generate-matches", {
        body: {
          minScore: minScore[0],
          limit: maxMatches,
          maxDistance: maxDistance[0],
          cityFilter: cityFilter || undefined,
          languageFilter: languageFilter || undefined,
          matchGender,
        },
      });

      if (error) throw error;

      setResults(data);

      if (data?.suggestedCount > 0) {
        toast.success(`✨ נוצרו ${data.suggestedCount} התאמות חדשות!`);
      } else {
        toast.info("לא נמצאו התאמות חדשות");
      }
    } catch (error: any) {
      console.error("Error scanning matches:", error);
      toast.error("שגיאה בסריקת התאמות");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6 lg:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">סריקת התאמות חכמה</h1>
            <p className="text-muted-foreground">
              סרוק את כל החיילים והמתנדבים במערכת למצוא התאמות אופטימליות
            </p>
          </div>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowRight className="ml-2 h-4 w-4" />
            חזרה לדף הראשי
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Parameters Card */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>פרמטרי סריקה</CardTitle>
                <CardDescription>
                  התאם את הפרמטרים למצוא את ההתאמות הטובות ביותר
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Min Score */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>ציון התאמה מינימלי</Label>
                    <span className="text-sm font-bold text-primary">{minScore[0]}%</span>
                  </div>
                  <Slider
                    value={minScore}
                    onValueChange={setMinScore}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    התאמות עם ציון נמוך מזה יסוננו
                  </p>
                </div>

                {/* Max Distance */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>מרחק מקסימלי (ק"מ)</Label>
                    <span className="text-sm font-bold text-primary">{maxDistance[0]} ק"מ</span>
                  </div>
                  <Slider
                    value={maxDistance}
                    onValueChange={setMaxDistance}
                    min={0}
                    max={300}
                    step={10}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    התעלם מהתאמות עם מרחק גאוגרפי גדול יותר
                  </p>
                </div>

                {/* Max Matches */}
                <div className="space-y-3">
                  <Label>מספר התאמות מקסימלי</Label>
                  <Input
                    type="number"
                    value={maxMatches}
                    onChange={(e) => setMaxMatches(parseInt(e.target.value) || 100)}
                    min={1}
                    max={1000}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    עצור לאחר יצירת מספר זה של התאמות
                  </p>
                </div>

                {/* City Filter */}
                <div className="space-y-3">
                  <Label>סנן לפי עיר (אופציונלי)</Label>
                  <Input
                    type="text"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    placeholder="למשל: ירושלים, תל אביב..."
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    השאר ריק כדי לסרוק את כל הערים
                  </p>
                </div>

                {/* Language Filter */}
                <div className="space-y-3">
                  <Label>סנן לפי שפת אם (אופציונלי)</Label>
                  <Input
                    type="text"
                    value={languageFilter}
                    onChange={(e) => setLanguageFilter(e.target.value)}
                    placeholder="למשל: רוסית, אנגלית..."
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    השאר ריק כדי לסרוק את כל השפות
                  </p>
                </div>

                {/* Gender Match */}
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="matchGender"
                    checked={matchGender}
                    onCheckedChange={(checked) => setMatchGender(checked as boolean)}
                  />
                  <Label htmlFor="matchGender" className="cursor-pointer">
                    תן עדיפות להתאמת מין
                  </Label>
                </div>

                {/* Scan Button */}
                <Button
                  onClick={handleScan}
                  disabled={isScanning}
                  size="lg"
                  className="w-full mt-4"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                      סורק...
                    </>
                  ) : (
                    <>
                      <Sparkles className="ml-2 h-5 w-5" />
                      התחל סריקה
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results Card */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>תוצאות</CardTitle>
                <CardDescription>
                  סטטיסטיקות על הסריקה האחרונה
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!results ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>הסריקה תתחיל לאחר לחיצה על "התחל סריקה"</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <div className="text-3xl font-bold text-center text-blue-700">
                        {results.suggestedCount || 0}
                      </div>
                      <div className="text-sm text-center text-muted-foreground mt-1">
                        התאמות חדשות נוצרו
                      </div>
                    </div>

                    {results.message && (
                      <div className="p-3 bg-accent rounded-lg text-sm">
                        {results.message}
                      </div>
                    )}

                    {results.suggestedCount > 0 && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate("/")}
                      >
                        צפה בהתאמות
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">איך זה עובד?</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div>
                  <strong>1. שפת אם:</strong> התאמה מושלמת של שפת אם מקבלת 60 נקודות
                </div>
                <div>
                  <strong>2. מרחק:</strong> אותה עיר מקבלת 40 נקודות, עיר קרובה 20 נקודות
                </div>
                <div>
                  <strong>3. מגדר:</strong> התאמת מגדר מקבלת 15 נקודות נוספות
                </div>
                <div>
                  <strong>4. בקשות מיוחדות:</strong> התאמה לבקשות מקבלת 5 נקודות
                </div>
                <div className="pt-3 border-t text-xs text-muted-foreground">
                  האלגוריתם בוחר את ההתאמות הטובות ביותר תוך שמירה על קיבולת המתנדבים
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

