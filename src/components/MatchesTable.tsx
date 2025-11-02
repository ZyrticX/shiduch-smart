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
  volunteer_id: string;
  confidence_score: number;
  match_reason: string;
  status: string;
  students: { full_name: string; city: string } | null;
  volunteers: { full_name: string; city: string } | null;
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
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        students(full_name, city),
        volunteers(full_name, city)
      `)
      .eq('status', 'pending')
      .order('confidence_score', { ascending: false });

    if (error) {
      toast.error("שגיאה בטעינת ההתאמות");
      console.error(error);
    } else {
      setMatches(data || []);
    }
    setIsLoading(false);
  };

  const updateMatchStatus = async (matchId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('matches')
      .update({ 
        status,
        approved_at: status === 'approved' ? new Date().toISOString() : null
      })
      .eq('id', matchId);

    if (error) {
      toast.error("שגיאה בעדכון ההתאמה");
      console.error(error);
    } else {
      toast.success(status === 'approved' ? "ההתאמה אושרה בהצלחה" : "ההתאמה נדחתה");
      loadMatches();
    }
  };

  const filteredMatches = matches.filter(match => {
    const searchLower = searchTerm.toLowerCase();
    return (
      match.students?.full_name.toLowerCase().includes(searchLower) ||
      match.volunteers?.full_name.toLowerCase().includes(searchLower) ||
      match.students?.city.toLowerCase().includes(searchLower) ||
      match.volunteers?.city.toLowerCase().includes(searchLower)
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
      <div className="flex items-center gap-4">
        <Input
          placeholder="חיפוש לפי שם, עיר..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" className="gap-2">
          <FileDown className="h-4 w-4" />
          ייצא CSV
        </Button>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">אין התאמות ממתינות</p>
          <p className="text-sm mt-2">הפעל את מנגנון ההתאמה החכם כדי ליצור התאמות חדשות</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">סטודנט</TableHead>
                <TableHead className="text-right">מתנדב</TableHead>
                <TableHead className="text-right">עיר</TableHead>
                <TableHead className="text-right">ציון התאמה</TableHead>
                <TableHead className="text-right">סיבת התאמה</TableHead>
                <TableHead className="text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatches.map((match) => (
                <TableRow key={match.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {match.students?.full_name || "N/A"}
                  </TableCell>
                  <TableCell>{match.volunteers?.full_name || "N/A"}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{match.students?.city}</div>
                      <div className="text-muted-foreground">{match.volunteers?.city}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          className={`${getScoreBgColor(match.confidence_score)} ${getScoreColor(match.confidence_score)}`}
                        >
                          {match.confidence_score}%
                        </Badge>
                      </div>
                      <Progress value={match.confidence_score} className="h-1.5" />
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {match.match_reason || "אין נימוק"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1"
                        onClick={() => updateMatchStatus(match.id, 'approved')}
                      >
                        <Check className="h-4 w-4" />
                        אשר
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => updateMatchStatus(match.id, 'rejected')}
                      >
                        <X className="h-4 w-4" />
                        דחה
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Edit className="h-4 w-4" />
                        ערוך
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
