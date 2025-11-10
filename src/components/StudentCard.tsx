import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, MapPin, Languages, Phone, Mail } from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string;
  native_language: string;
  gender: string | null;
  special_requests: string | null;
}

interface Match {
  id: string;
  confidence_score: number;
  match_reason: string;
  status: string;
  created_at: string;
  users: {
    id: string;
    full_name: string;
    city: string;
    email: string;
    phone: string | null;
  };
}

interface StudentCardProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StudentCard({ student, open, onOpenChange }: StudentCardProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && student) {
      loadMatches();
    }
  }, [open, student]);

  const loadMatches = async () => {
    if (!student) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("matches")
      .select(`
        id,
        confidence_score,
        match_reason,
        status,
        created_at,
        users!inner(id, full_name, city, email, phone)
      `)
      .eq("student_id", student.id)
      .order("confidence_score", { ascending: false });

    if (error) {
      console.error("Error loading matches:", error);
      toast.error("שגיאה בטעינת התאמות");
    } else {
      setMatches(data || []);
    }
    setLoading(false);
  };

  const handleApprove = async (matchId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("update-match-status", {
        body: { matchId, action: "approve" },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("ההתאמה אושרה בהצלחה");
        loadMatches();
      } else {
        throw new Error(data?.error || "שגיאה באישור התאמה");
      }
    } catch (error: any) {
      console.error("Error approving match:", error);
      toast.error(error.message || "שגיאה באישור התאמה");
    }
  };

  const handleReject = async (matchId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("update-match-status", {
        body: { matchId, action: "reject" },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("ההתאמה נדחתה");
        loadMatches();
      } else {
        throw new Error(data?.error || "שגיאה בדחיית התאמה");
      }
    } catch (error: any) {
      console.error("Error rejecting match:", error);
      toast.error(error.message || "שגיאה בדחיית התאמה");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">אושרה</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">נדחתה</Badge>;
      case "Suggested":
        return <Badge className="bg-blue-100 text-blue-800">מוצעת</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl">כרטיס חייל</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Student Info */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-xl font-bold mb-4 text-right">{student.full_name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="font-medium">עיר:</span>
                <span>{student.city}</span>
              </div>
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-blue-600" />
                <span className="font-medium">שפת אם:</span>
                <span>{student.native_language}</span>
              </div>
              {student.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">טלפון:</span>
                  <span>{student.phone}</span>
                </div>
              )}
              {student.gender && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">מין:</span>
                  <span>{student.gender}</span>
                </div>
              )}
            </div>
            {student.special_requests && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <span className="font-medium text-sm">בקשות מיוחדות:</span>
                <p className="text-sm mt-1">{student.special_requests}</p>
              </div>
            )}
          </div>

          {/* Matches */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-right">
              התאמות ({matches.length})
            </h3>

            {loading ? (
              <div className="text-center py-8">טוען התאמות...</div>
            ) : matches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                אין התאמות עדיין
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold">{match.users.full_name}</h4>
                          {getStatusBadge(match.status)}
                          <Badge variant="outline" className="mr-auto">
                            {match.confidence_score}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <MapPin className="h-3 w-3" />
                          <span>{match.users.city}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {match.match_reason}
                        </p>
                      </div>
                    </div>

                    {match.status === "Suggested" && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApprove(match.id)}
                          className="flex-1"
                        >
                          <CheckCircle2 className="h-4 w-4 ml-1" />
                          אשר התאמה
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(match.id)}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 ml-1" />
                          דחה
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

