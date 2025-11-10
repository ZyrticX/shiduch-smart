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
      
      // Initialize mappings for each sheet
      const initialMappings = wb.SheetNames.map(sheetName => ({
        sheetName,
        targetTable: "students" as const,
        columnMapping: {},
        enabled: true,
      }));
      setMappings(initialMappings);
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
        const errorMessage = data.errors.join('\n');
        console.error("Detailed import errors:", errorMessage);
        
        // Show each error separately for better visibility
        data.errors.forEach((err: string, index: number) => {
          console.error(`Error ${index + 1}:`, err);
        });
        
        toast.error(`הועלו ${data.inserted || 0} רשומות, אבל היו ${data.errors.length} שגיאות. ראה קונסול לפרטים.`, {
          description: data.errors.slice(0, 2).join('; '), // Show first 2 errors in toast
          duration: 10000, // Show for 10 seconds
        });
      } else {
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
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-2">הוראות:</p>
              <ul className="list-disc list-inside space-y-1 mr-4">
                <li>בחר את הגיליונות שברצונך להעלות (סמן את התיבות)</li>
                <li>בחר לכל גיליון אם הוא מיועד ל<strong>תלמידים</strong> או <strong>משתמשים</strong> (מתנדבים)</li>
                <li>ודא שהגיליון מכיל את העמודות הבאות:
                  <ul className="list-disc list-inside mr-4 mt-1">
                    <li>שם פרטי / שם משפחה (או שם מלא)</li>
                    <li>מזהה איש קשר / אימייל</li>
                    <li>עיר</li>
                    <li>שפת אם</li>
                  </ul>
                </li>
              </ul>
            </div>
            {mappings.map((mapping, index) => (
              <div key={mapping.sheetName} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 border rounded-lg">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="checkbox"
                    checked={mapping.enabled}
                    onChange={() => toggleSheetEnabled(index)}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{mapping.sheetName}</div>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="students">תלמידים</SelectItem>
                      <SelectItem value="users">משתמשים</SelectItem>
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
