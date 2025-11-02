import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileDown, Printer, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";

interface ApprovedMatch {
  id: string;
  student_id: string;
  volunteer_id: string;
  confidence_score: number;
  match_reason: string;
  approved_at: string;
  students: { full_name: string; email: string; city: string } | null;
  volunteers: { full_name: string; email: string; city: string } | null;
}

const ApprovedMatches = () => {
  const [matches, setMatches] = useState<ApprovedMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadApprovedMatches();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('approved-matches-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, loadApprovedMatches)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadApprovedMatches = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        students(full_name, email, city),
        volunteers(full_name, email, city)
      `)
      .eq('status', 'approved')
      .order('approved_at', { ascending: false });

    if (error) {
      toast.error("שגיאה בטעינת ההתאמות המאושרות");
      console.error(error);
    } else {
      setMatches(data || []);
    }
    setIsLoading(false);
  };

  const exportToCSV = () => {
    if (matches.length === 0) {
      toast.error("אין התאמות לייצוא");
      return;
    }

    // Create CSV header
    const headers = [
      "student_id",
      "volunteer_id", 
      "student_name",
      "volunteer_name",
      "student_city",
      "volunteer_city",
      "confidence_score",
      "match_reason",
      "approved_at"
    ];

    // Create CSV rows
    const rows = matches.map(match => [
      match.student_id,
      match.volunteer_id,
      match.students?.full_name || "",
      match.volunteers?.full_name || "",
      match.students?.city || "",
      match.volunteers?.city || "",
      match.confidence_score,
      `"${match.match_reason.replace(/"/g, '""')}"`, // Escape quotes
      new Date(match.approved_at).toLocaleString('he-IL')
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Add BOM for Hebrew support
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `approved_matches_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`יוצאו ${matches.length} התאמות בהצלחה`);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center">
        <div className="text-center">טוען התאמות מאושרות...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <div className="text-right">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="gap-2 mb-2"
            >
              <ArrowRight className="h-4 w-4" />
              חזרה לדשבורד
            </Button>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              התאמות מאושרות
            </h1>
            <p className="text-muted-foreground">
              סה״כ {matches.length} התאמות מאושרות
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={exportToCSV}
              variant="outline"
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              ייצא CSV
            </Button>
            <Button 
              onClick={handlePrint}
              variant="outline"
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              הדפס
            </Button>
          </div>
        </div>

        {/* Print Header - Only visible when printing */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">התאמות מאושרות</h1>
          <p className="text-sm text-muted-foreground">
            תאריך הפקה: {new Date().toLocaleDateString('he-IL')}
          </p>
          <p className="text-sm text-muted-foreground">
            סה״כ התאמות: {matches.length}
          </p>
        </div>

        {/* Matches Table */}
        <Card className="print:shadow-none">
          <CardHeader className="print:pb-4">
            <CardTitle>רשימת התאמות</CardTitle>
            <CardDescription>
              כל ההתאמות שאושרו במערכת
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">אין התאמות מאושרות</p>
              </div>
            ) : (
              <div className="rounded-md border print:border-gray-300">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">סטודנט</TableHead>
                      <TableHead className="text-right">מתנדב</TableHead>
                      <TableHead className="text-right">עיר</TableHead>
                      <TableHead className="text-right print:hidden">ציון התאמה</TableHead>
                      <TableHead className="text-right hidden print:table-cell">ציון</TableHead>
                      <TableHead className="text-right">סיבת התאמה</TableHead>
                      <TableHead className="text-right">תאריך אישור</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((match) => (
                      <TableRow key={match.id} className="print:break-inside-avoid">
                        <TableCell className="font-medium">
                          <div>
                            <div>{match.students?.full_name || "N/A"}</div>
                            <div className="text-xs text-muted-foreground print:hidden">
                              {match.students?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{match.volunteers?.full_name || "N/A"}</div>
                            <div className="text-xs text-muted-foreground print:hidden">
                              {match.volunteers?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{match.students?.city}</div>
                            <div className="text-muted-foreground">{match.volunteers?.city}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-primary">
                            {match.confidence_score}%
                          </span>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="text-sm text-muted-foreground line-clamp-2 print:line-clamp-none">
                            {match.match_reason}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(match.approved_at).toLocaleDateString('he-IL')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Print Footer */}
        <div className="hidden print:block text-center text-xs text-muted-foreground mt-6">
          <p>מערכת שיבוץ חכמה - דו״ח התאמות מאושרות</p>
        </div>
      </div>
    </div>
  );
};

export default ApprovedMatches;
