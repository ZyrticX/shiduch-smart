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
  targetTable: "students" | "volunteers";
  columnMapping: Record<string, string>;
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
      }));
      setMappings(initialMappings);
    };
    
    reader.readAsBinaryString(selectedFile);
  };

  const updateSheetMapping = (sheetIndex: number, targetTable: "students" | "volunteers") => {
    const newMappings = [...mappings];
    newMappings[sheetIndex].targetTable = targetTable;
    setMappings(newMappings);
  };

  const handleUpload = async () => {
    if (!workbook || mappings.length === 0) {
      toast.error("אנא בחר קובץ תקין");
      return;
    }

    setIsProcessing(true);

    try {
      // Process each sheet
      const allData: { table: string; rows: any[] }[] = [];

      mappings.forEach((mapping) => {
        const sheet = workbook.Sheets[mapping.sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        allData.push({
          table: mapping.targetTable,
          rows: jsonData,
        });
      });

      // Send to edge function
      const { data, error } = await supabase.functions.invoke("import-excel", {
        body: { data: allData },
      });

      if (error) throw error;

      toast.success(`הנתונים הועלו בהצלחה: ${data.inserted} רשומות נוספו`);
      
      // Reset
      setFile(null);
      setSheets([]);
      setWorkbook(null);
      setMappings([]);
    } catch (error) {
      console.error("Error uploading:", error);
      toast.error("שגיאה בהעלאת הנתונים");
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
            {mappings.map((mapping, index) => (
              <div key={mapping.sheetName} className="flex items-center gap-4 p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{mapping.sheetName}</div>
                </div>
                <div className="w-48">
                  <Select
                    value={mapping.targetTable}
                    onValueChange={(value) =>
                      updateSheetMapping(index, value as "students" | "volunteers")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="students">תלמידים</SelectItem>
                      <SelectItem value="volunteers">מתנדבים</SelectItem>
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
