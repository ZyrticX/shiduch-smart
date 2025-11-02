import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, X, Edit, FileDown } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

interface Match {
  id: string;
  student_id: string;
  user_id: string;
  confidence_score: number;
  match_reason: string;
  status: string;
  students: { full_name: string; city: string } | null;
  users: { full_name: string; city: string } | null;
}

const MatchesTable = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMatches();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('matches-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, loadMatches)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadMatches = async () => {
    setIsLoading(true);
    try {
      // Load matches
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'Suggested')
        .order('confidence_score', { ascending: false });

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
          ? supabase.from('students').select('id, full_name, city').in('id', studentIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length > 0
          ? supabase.from('users').select('id, full_name, city').in('id', userIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (usersRes.error) throw usersRes.error;

      // Create lookup maps
      const studentsMap = new Map((studentsRes.data || []).map(s => [s.id, { full_name: s.full_name, city: s.city }]));
      const usersMap = new Map((usersRes.data || []).map(u => [u.id, { full_name: u.full_name, city: u.city }]));

      // Combine matches with student and user data
      const enrichedMatches = matchesData.map(match => ({
        ...match,
        students: match.student_id ? studentsMap.get(match.student_id) || null : null,
        users: match.user_id ? usersMap.get(match.user_id) || null : null,
      }));

      setMatches(enrichedMatches);
    } catch (error: any) {
      toast.error("שגיאה בטעינת ההתאמות");
      console.error(error);
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMatchStatus = async (matchId: string, action: 'approve' | 'reject') => {
    try {
      const { data, error } = await supabase.functions.invoke('update-match-status', {
        body: { matchId, action }
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        console.error("Match update error:", data);
        return;
      }

      toast.success(data?.message || (action === 'approve' ? "ההתאמה אושרה בהצלחה" : "ההתאמה נדחתה"));
      loadMatches();
    } catch (error: any) {
      console.error("Error updating match:", error);
      toast.error("שגיאה בעדכון ההתאמה");
    }
  };

  const filteredMatches = matches.filter(match => {
    const searchLower = searchTerm.toLowerCase();
    return (
      match.students?.full_name.toLowerCase().includes(searchLower) ||
      match.users?.full_name.toLowerCase().includes(searchLower) ||
      match.students?.city.toLowerCase().includes(searchLower) ||
      match.users?.city.toLowerCase().includes(searchLower)
    );
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 60) return "text-blue-600 dark:text-blue-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-emerald-100 dark:bg-emerald-950";
    if (score >= 60) return "bg-blue-100 dark:bg-blue-950";
    return "bg-orange-100 dark:bg-orange-950";
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">טוען התאמות...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 justify-end">
        <Input
          placeholder="חיפוש לפי שם, עיר..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:max-w-sm text-right"
        />
        <Button variant="outline" className="gap-2 w-full sm:w-auto">
          <FileDown className="h-4 w-4" />
          <span className="hidden sm:inline">ייצא CSV</span>
          <span className="sm:hidden">CSV</span>
        </Button>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">אין התאמות מוצעות</p>
          <p className="text-sm mt-2">הפעל את מנגנון ההתאמה החכם כדי ליצור התאמות חדשות</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right whitespace-nowrap">סטודנט</TableHead>
                <TableHead className="text-right whitespace-nowrap">משתמש</TableHead>
                <TableHead className="text-right whitespace-nowrap hidden sm:table-cell">עיר</TableHead>
                <TableHead className="text-right whitespace-nowrap">ציון התאמה</TableHead>
                <TableHead className="text-right whitespace-nowrap hidden lg:table-cell">סיבת התאמה</TableHead>
                <TableHead className="text-center whitespace-nowrap">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatches.map((match) => (
                <TableRow key={match.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {match.students?.full_name || "N/A"}
                  </TableCell>
                  <TableCell>{match.users?.full_name || "N/A"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="text-sm">
                      <div>{match.students?.city}</div>
                      <div className="text-muted-foreground">{match.users?.city}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2 min-w-[80px]">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          className={`${getScoreBgColor(match.confidence_score)} ${getScoreColor(match.confidence_score)} text-xs`}
                        >
                          {match.confidence_score}%
                        </Badge>
                      </div>
                      <Progress value={match.confidence_score} className="h-1.5" />
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs hidden lg:table-cell">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {match.match_reason || "אין נימוק"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1 text-xs sm:text-sm"
                        onClick={() => updateMatchStatus(match.id, 'approve')}
                      >
                        <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">אשר</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1 text-xs sm:text-sm"
                        onClick={() => updateMatchStatus(match.id, 'reject')}
                      >
                        <X className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">דחה</span>
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-xs sm:text-sm hidden md:inline-flex">
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">ערוך</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default MatchesTable;
