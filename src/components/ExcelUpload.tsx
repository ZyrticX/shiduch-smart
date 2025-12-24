import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SheetMapping {
  sheetName: string;
  targetTable: "students" | "users";
  columnMapping: Record<string, string>;
  enabled: boolean;
}

export function ExcelUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [mappings, setMappings] = useState<SheetMapping[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const data = event.target?.result;
      const wb = XLSX.read(data, { type: "binary" });
      setWorkbook(wb);
      setSheets(wb.SheetNames);
      
      // Auto-detect sheet type based on sheet name
      const autoDetectSheetType = (sheetName: string): "students" | "users" => {
        const nameLower = sheetName.toLowerCase();
        
        // Keywords for users/volunteers
        const userKeywords = [
          'user', 'users', 'משתמש', 'משתמשים',
          'מתנדב', 'מתנדבים', 'מורה', 'מורים',
          'volunteer', 'volunteers', 'mentor', 'mentors',
          'to get', 'get student'
        ];
        
        // Keywords for students
        const studentKeywords = [
          'student', 'students', 'תלמיד', 'תלמידים',
          'חייל', 'חיילים', 'soldier', 'soldiers',
          'to take', 'take user'
        ];
        
        // Check for user keywords first
        if (userKeywords.some(keyword => nameLower.includes(keyword))) {
          return "users";
        }
        
        // Check for student keywords
        if (studentKeywords.some(keyword => nameLower.includes(keyword))) {
          return "students";
        }
        
        // Default to students if no clear match
        return "students";
      };
      
      // Initialize mappings for each sheet with auto-detection
      const initialMappings = wb.SheetNames.map(sheetName => ({
        sheetName,
        targetTable: autoDetectSheetType(sheetName),
        columnMapping: {},
        enabled: true,
      }));
      setMappings(initialMappings);
      
      // Log the auto-detection results
      console.log("Auto-detected sheet mappings:");
      initialMappings.forEach(m => {
        console.log(`  "${m.sheetName}" -> ${m.targetTable}`);
      });
    };
    
    reader.readAsBinaryString(selectedFile);
  };

  const updateSheetMapping = (sheetIndex: number, targetTable: "students" | "users") => {
    const newMappings = [...mappings];
    newMappings[sheetIndex].targetTable = targetTable;
    setMappings(newMappings);
  };

  const toggleSheetEnabled = (sheetIndex: number) => {
    const newMappings = [...mappings];
    newMappings[sheetIndex].enabled = !newMappings[sheetIndex].enabled;
    setMappings(newMappings);
  };

  const handleUpload = async () => {
    if (!workbook || mappings.length === 0) {
      toast.error("אנא בחר קובץ תקין");
      return;
    }

    setIsProcessing(true);

    try {
      // Process only enabled sheets
      const allData: { table: string; sheetName: string; rows: any[] }[] = [];

      mappings
        .filter((mapping) => mapping.enabled)
        .forEach((mapping) => {
          const sheet = workbook.Sheets[mapping.sheetName];
          // Convert sheet to JSON - XLSX will automatically use first row as headers
          const jsonData = XLSX.utils.sheet_to_json(sheet, {
            defval: null,
            raw: false
          });

          if (jsonData.length > 0) {
            console.log(`Sheet "${mapping.sheetName}":`);
            console.log(`- Found ${jsonData.length} rows`);
            console.log(`- Columns:`, Object.keys(jsonData[0]));
            console.log(`- Sample row:`, jsonData[0]);
          } else {
            console.warn(`Sheet "${mapping.sheetName}" is empty`);
          }

          allData.push({
            table: mapping.targetTable,
            sheetName: mapping.sheetName,
            rows: jsonData,
          });
        });

      // Send to edge function
      const { data, error } = await supabase.functions.invoke("import-excel", {
        body: { data: allData },
      });

      if (error) {
        console.error("Upload error:", error);
        throw error;
      }

      if (data?.error) {
        console.error("Server error:", data.error);
        throw new Error(data.error);
      }

      // Show warnings about unrecognized cities
      if (data?.warnings && data.warnings.length > 0) {
        console.warn("City warnings:", data.warnings);
        toast.warning(
          `נטענו ${data.inserted || 0} רשומות בהצלחה\n${data.warningsCount || data.warnings.length} אזהרות`,
          {
            description: data.warnings.slice(0, 3).join('\n'),
            duration: 10000,
          }
        );
      }

      // Show duplicates warning if any
      if (data?.duplicates && data.duplicates.length > 0) {
        console.warn("Duplicates found:", data.duplicates);
        toast.warning(
          `זוהו ${data.duplicates.length} כפילויות (לפי טלפון) - הרשומות לא נוספו`,
          {
            description: data.duplicates.slice(0, 3).map((d: any) => `${d.name} (${d.phone})`).join(', '),
            duration: 8000,
          }
        );
      }
      
      if (data?.errors && data.errors.length > 0) {
        console.error("Import errors:", data.errors);
        data.errors.forEach((err: string, index: number) => {
          console.error(`Error ${index + 1}:`, err);
        });
        
        toast.error(`הועלו ${data.inserted || 0} רשומות, אבל היו ${data.errors.length} שגיאות.`, {
          description: data.errors.slice(0, 2).join('; '),
          duration: 10000,
        });
      } else if (!data?.warnings || data.warnings.length === 0) {
        toast.success(`הנתונים הועלו בהצלחה: ${data.inserted || 0} רשומות נוספו`);
      }
      
      // Reset
      setFile(null);
      setSheets([]);
      setWorkbook(null);
      setMappings([]);
      
      // Reload page to show new data (only if successful)
      if (data?.success !== false) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error: any) {
      console.error("Error uploading:", error);
      const errorMessage = error?.message || error?.error || "שגיאה לא ידועה";
      toast.error(`שגיאה בהעלאת הנתונים: ${errorMessage}`);
      
      // Show detailed error in console for debugging
      if (error?.response) {
        console.error("Error response:", error.response);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          העלאת קובץ אקסל
        </CardTitle>
        <CardDescription>
          העלה קובץ אקסל עם נתונים של תלמידים או מתנדבים
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file-upload">בחר קובץ</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {file ? file.name : "בחר קובץ אקסל"}
            </Button>
            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {sheets.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm font-medium">גיליונות שנמצאו ({sheets.length})</div>
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
              <p className="font-medium mb-2 text-blue-900 dark:text-blue-100">⚠️ חשוב לבדוק!</p>
              <ul className="list-disc list-inside space-y-1 mr-4 text-blue-800 dark:text-blue-200">
                <li>המערכת מזהה אוטומטית את סוג כל גיליון לפי השם שלו</li>
                <li><strong>בדוק שהזיהוי נכון!</strong> אם לא - שנה ידנית בתפריט הנפתח</li>
                <li>סמן רק את הגיליונות שברצונך להעלות</li>
                <li>ודא שכל גיליון מכיל:
                  <ul className="list-disc list-inside mr-4 mt-1">
                    <li>שם מלא (או שם פרטי + משפחה)</li>
                    <li>עיר</li>
                    <li>שפת אם</li>
                    <li>טלפון (מומלץ - משמש לזיהוי כפילויות)</li>
                  </ul>
                </li>
              </ul>
            </div>
            {mappings.map((mapping, index) => (
              <div 
                key={mapping.sheetName} 
                className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 border-2 rounded-lg transition-colors ${
                  mapping.enabled 
                    ? mapping.targetTable === 'students' 
                      ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' 
                      : 'border-green-300 bg-green-50 dark:bg-green-950/20'
                    : 'border-gray-200 bg-gray-50 dark:bg-gray-900/20 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="checkbox"
                    checked={mapping.enabled}
                    onChange={() => toggleSheetEnabled(index)}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{mapping.sheetName}</div>
                    {mapping.enabled && (
                      <div className={`text-xs mt-1 ${
                        mapping.targetTable === 'students' 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {mapping.targetTable === 'students' ? '🎓 חיילים/תלמידים' : '👨‍🏫 מתנדבים/משתמשים'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full sm:w-48">
                  <Select
                    value={mapping.targetTable}
                    onValueChange={(value) =>
                      updateSheetMapping(index, value as "students" | "users")
                    }
                    disabled={!mapping.enabled}
                  >
                    <SelectTrigger className={
                      mapping.targetTable === 'students' 
                        ? 'border-blue-300 focus:ring-blue-500' 
                        : 'border-green-300 focus:ring-green-500'
                    }>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="students">🎓 תלמידים (חיילים)</SelectItem>
                      <SelectItem value="users">👨‍🏫 משתמשים (מתנדבים)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}

            <Button
              onClick={handleUpload}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  מעבד...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  העלה נתונים
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
