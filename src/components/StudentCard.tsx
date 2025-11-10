import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, MapPin, Languages, Phone, Mail, Calendar, User, Building2, Flag, Briefcase, Award } from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string;
  native_language: string;
  gender: string | null;
  special_requests: string | null;
  contact_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  last_report_date?: string | null;
  last_call_date?: string | null;
  coordinator?: string | null;
  country_of_origin?: string | null;
  how_arrived_to_organization?: string | null;
  arrival_other_notes?: string | null;
  project_affiliation?: string | null;
  military_unit?: string | null;
  service_location?: string | null;
  enlistment_date?: string | null;
  release_date?: string | null;
  role_in_unit?: string | null;
  language_preference?: string | null;
  volunteer_or_volunteer?: string | null;
  belongs_to_patrol?: boolean | null;
  is_soldiers_club?: boolean | null;
  origin_other_notes?: string | null;
  contact_type?: string | null;
  district_coordinator?: string | null;
  responsible_volunteer?: string | null;
  participation_level?: string | null;
  student_status?: string | null;
  created_at?: string | null;
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
            
            {/* Basic Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
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
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">מין:</span>
                  <span>{student.gender}</span>
                </div>
              )}
              {student.student_status && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">סטטוס:</span>
                  <Badge variant="outline">{student.student_status}</Badge>
                </div>
              )}
              {student.contact_id && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">מזהה איש קשר:</span>
                  <span className="text-xs font-mono">{student.contact_id}</span>
                </div>
              )}
            </div>

            {/* Military Service Info */}
            {(student.military_unit || student.service_location || student.enlistment_date || student.release_date || student.role_in_unit) && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  פרטי שירות צבאי
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {student.military_unit && (
                    <div>
                      <span className="font-medium">חיל:</span> {student.military_unit}
                    </div>
                  )}
                  {student.service_location && (
                    <div>
                      <span className="font-medium">מקום שירות:</span> {student.service_location}
                    </div>
                  )}
                  {student.role_in_unit && (
                    <div>
                      <span className="font-medium">תפקיד ביחידה:</span> {student.role_in_unit}
                    </div>
                  )}
                  {student.enlistment_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span className="font-medium">תאריך גיוס:</span> {new Date(student.enlistment_date).toLocaleDateString('he-IL')}
                    </div>
                  )}
                  {student.release_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span className="font-medium">תאריך שחרור:</span> {new Date(student.release_date).toLocaleDateString('he-IL')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Organization Info */}
            {(student.coordinator || student.district_coordinator || student.project_affiliation || student.how_arrived_to_organization || student.country_of_origin) && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  פרטי ארגון
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {student.coordinator && (
                    <div>
                      <span className="font-medium">רכז:</span> {student.coordinator}
                    </div>
                  )}
                  {student.district_coordinator && (
                    <div>
                      <span className="font-medium">רכז מחוז:</span> {student.district_coordinator}
                    </div>
                  )}
                  {student.responsible_volunteer && (
                    <div>
                      <span className="font-medium">מתנדב/ת אחראי/ת:</span> {student.responsible_volunteer}
                    </div>
                  )}
                  {student.project_affiliation && (
                    <div>
                      <span className="font-medium">שיכות לפרויקט:</span> {student.project_affiliation}
                    </div>
                  )}
                  {student.how_arrived_to_organization && (
                    <div>
                      <span className="font-medium">כיצד הגיע לעמותה:</span> {student.how_arrived_to_organization}
                    </div>
                  )}
                  {student.country_of_origin && (
                    <div className="flex items-center gap-2">
                      <Flag className="h-3 w-3" />
                      <span className="font-medium">ארץ מוצא:</span> {student.country_of_origin}
                    </div>
                  )}
                  {student.language_preference && (
                    <div>
                      <span className="font-medium">העדפת שפה:</span> {student.language_preference}
                    </div>
                  )}
                  {student.participation_level && (
                    <div>
                      <span className="font-medium">רמת השתתפות:</span> {student.participation_level}
                    </div>
                  )}
                </div>
                {student.arrival_other_notes && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    הערות הגעה: {student.arrival_other_notes}
                  </div>
                )}
                {student.origin_other_notes && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    הערות ארץ מוצא: {student.origin_other_notes}
                  </div>
                )}
              </div>
            )}

            {/* Additional Flags */}
            {(student.belongs_to_patrol || student.is_soldiers_club) && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <div className="flex flex-wrap gap-2">
                  {student.belongs_to_patrol && (
                    <Badge variant="outline" className="bg-blue-100">שייך לסיירת</Badge>
                  )}
                  {student.is_soldiers_club && (
                    <Badge variant="outline" className="bg-green-100">מועדון חיילים</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Special Requests */}
            {student.special_requests && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <span className="font-medium text-sm">בקשות מיוחדות:</span>
                <p className="text-sm mt-1">{student.special_requests}</p>
              </div>
            )}

            {/* Dates */}
            {(student.last_report_date || student.last_call_date || student.created_at) && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  תאריכים
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {student.last_report_date && (
                    <div>דיווח אחרון: {new Date(student.last_report_date).toLocaleDateString('he-IL')}</div>
                  )}
                  {student.last_call_date && (
                    <div>שיחה אחרונה: {new Date(student.last_call_date).toLocaleDateString('he-IL')}</div>
                  )}
                  {student.created_at && (
                    <div>נוצר ב: {new Date(student.created_at).toLocaleDateString('he-IL')}</div>
                  )}
                </div>
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

