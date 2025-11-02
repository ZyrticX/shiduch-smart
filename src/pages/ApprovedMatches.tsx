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
  user_id: string;
  confidence_score: number;
  match_reason: string;
  approved_at: string;
  students: { full_name: string; email: string; city: string } | null;
  users: { full_name: string; email: string; city: string } | null;
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
    try {
      // Load matches
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'approved')
        .order('approved_at', { ascending: false });

      if (matchesError) throw matchesError;

      if (!matchesData || matchesData.length === 0) {
        setMatches([]);
        setIsLoading(false);
        return;
      }

      // Get unique student and user IDs
      const studentIds = [...new Set(matchesData.map(m => m.student_id).filter(Boolean))];
      const userIds = [...new Set(matchesData.map(m => m.user_id).filter(Boolean))];

      // Load students and users separately
      const [studentsRes, usersRes] = await Promise.all([
        studentIds.length > 0 
          ? supabase.from('students').select('id, full_name, email, city').in('id', studentIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length > 0
          ? supabase.from('users').select('id, full_name, email, city').in('id', userIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (usersRes.error) throw usersRes.error;

      // Create lookup maps
      const studentsMap = new Map((studentsRes.data || []).map(s => [s.id, { full_name: s.full_name, email: s.email, city: s.city }]));
      const usersMap = new Map((usersRes.data || []).map(u => [u.id, { full_name: u.full_name, email: u.email, city: u.city }]));

      // Combine matches with student and user data
      const enrichedMatches = matchesData.map(match => ({
        ...match,
        students: match.student_id ? studentsMap.get(match.student_id) || null : null,
        users: match.user_id ? usersMap.get(match.user_id) || null : null,
      }));

      setMatches(enrichedMatches);
    } catch (error: any) {
      toast.error("שגיאה בטעינת ההתאמות המאושרות");
      console.error(error);
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (matches.length === 0) {
      toast.error("אין התאמות לייצוא");
      return;
    }

    // Create CSV header
    const headers = [
      "student_id",
      "user_id", 
      "student_name",
      "user_name",
      "student_city",
      "user_city",
      "confidence_score",
      "match_reason",
      "approved_at"
    ];

    // Create CSV rows
    const rows = matches.map(match => [
      match.student_id,
      match.user_id,
      match.students?.full_name || "",
      match.users?.full_name || "",
      match.students?.city || "",
      match.users?.city || "",
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
    <div className="min-h-screen bg-secondary/30" dir="rtl">
      <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
          <div className="text-right w-full sm:w-auto">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="gap-2 mb-2"
            >
              <ArrowRight className="h-4 w-4" />
              חזרה לדשבורד
            </Button>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
              התאמות מאושרות
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              סה״כ {matches.length} התאמות מאושרות
            </p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              onClick={exportToCSV}
              variant="outline"
              className="gap-2 flex-1 sm:flex-initial"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">ייצא CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button 
              onClick={handlePrint}
              variant="outline"
              className="gap-2 flex-1 sm:flex-initial"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">הדפס</span>
              <span className="sm:hidden">הדפס</span>
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
              <div className="rounded-md border print:border-gray-300 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right whitespace-nowrap">סטודנט</TableHead>
                      <TableHead className="text-right whitespace-nowrap">משתמש</TableHead>
                      <TableHead className="text-right whitespace-nowrap hidden sm:table-cell">עיר</TableHead>
                      <TableHead className="text-right print:hidden whitespace-nowrap hidden md:table-cell">ציון התאמה</TableHead>
                      <TableHead className="text-right hidden print:table-cell">ציון</TableHead>
                      <TableHead className="text-right whitespace-nowrap hidden lg:table-cell">סיבת התאמה</TableHead>
                      <TableHead className="text-right whitespace-nowrap">תאריך אישור</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((match) => (
                      <TableRow key={match.id} className="print:break-inside-avoid">
                        <TableCell className="font-medium">
                          <div>
                            <div>{match.students?.full_name || "N/A"}</div>
                            <div className="text-xs text-muted-foreground print:hidden sm:hidden">
                              {match.students?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{match.users?.full_name || "N/A"}</div>
                            <div className="text-xs text-muted-foreground print:hidden sm:hidden">
                              {match.users?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="text-sm">
                            <div>{match.students?.city}</div>
                            <div className="text-muted-foreground">{match.users?.city}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center hidden md:table-cell print:hidden">
                          <span className="font-semibold text-primary">
                            {match.confidence_score}%
                          </span>
                        </TableCell>
                        <TableCell className="max-w-md hidden lg:table-cell">
                          <p className="text-sm text-muted-foreground line-clamp-2 print:line-clamp-none">
                            {match.match_reason}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
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
