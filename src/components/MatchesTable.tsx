import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, X, Edit, FileDown, Eye, User, MapPin, Languages, Phone, Mail, Calendar, Building } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface StudentDetails {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  native_language: string;
  gender: string;
  special_requests: string;
  military_unit: string;
  service_location: string;
  contact_id: string;
  coordinator: string;
  student_status: string;
  is_matched: boolean;
  created_at: string;
}

interface UserDetails {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  native_language: string;
  gender: string;
  capacity_max: number;
  current_students: number;
  scholarship_active: boolean;
  is_active: boolean;
  user_status: string;
  contact_id: string;
  coordinator: string;
  created_at: string;
}

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
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  
  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedMatchForDetails, setSelectedMatchForDetails] = useState<Match | null>(null);
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

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
      // Remove from selection after update
      setSelectedMatches(prev => {
        const newSet = new Set(prev);
        newSet.delete(matchId);
        return newSet;
      });
    } catch (error: any) {
      console.error("Error updating match:", error);
      toast.error("שגיאה בעדכון ההתאמה");
    }
  };

  const toggleMatchSelection = (matchId: string) => {
    setSelectedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  };

  const toggleAllMatches = () => {
    if (selectedMatches.size === filteredMatches.length) {
      setSelectedMatches(new Set());
    } else {
      setSelectedMatches(new Set(filteredMatches.map(m => m.id)));
    }
  };

  const handleBatchAction = async (action: 'approve' | 'reject') => {
    if (selectedMatches.size === 0) {
      toast.warning("אנא בחר לפחות התאמה אחת");
      return;
    }

    setIsProcessingBatch(true);
    const matchIds = Array.from(selectedMatches);
    const actionText = action === 'approve' ? 'אישור' : 'דחייה';
    
    toast.info(`מעבד ${matchIds.length} התאמות...`);

    try {
      // Process matches in parallel batches
      const batchSize = 10;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < matchIds.length; i += batchSize) {
        const batch = matchIds.slice(i, i + batchSize);
        const promises = batch.map(matchId => 
          supabase.functions.invoke('update-match-status', {
            body: { matchId, action }
          })
        );

        const results = await Promise.allSettled(promises);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && !result.value.error && !result.value.data?.error) {
            successCount++;
          } else {
            errorCount++;
            console.error(`Error processing match ${batch[index]}:`, result);
          }
        });
      }

      if (errorCount === 0) {
        toast.success(`הושלם בהצלחה: ${successCount} התאמות ${action === 'approve' ? 'אושרו' : 'נדחו'}`);
      } else {
        toast.warning(`הושלם חלקית: ${successCount} הצליחו, ${errorCount} נכשלו`);
      }

      setSelectedMatches(new Set());
      loadMatches();
    } catch (error: any) {
      console.error("Error in batch action:", error);
      toast.error(`שגיאה ב${actionText} קבוצתי`);
    } finally {
      setIsProcessingBatch(false);
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

  // Load full details for a match
  const loadMatchDetails = async (match: Match) => {
    setSelectedMatchForDetails(match);
    setDetailsDialogOpen(true);
    setIsLoadingDetails(true);
    setStudentDetails(null);
    setUserDetails(null);

    try {
      const [studentRes, userRes] = await Promise.all([
        supabase.from('students').select('*').eq('id', match.student_id).single(),
        supabase.from('users').select('*').eq('id', match.user_id).single()
      ]);

      if (studentRes.error) {
        console.error("Error loading student:", studentRes.error);
      } else {
        setStudentDetails(studentRes.data);
      }

      if (userRes.error) {
        console.error("Error loading user:", userRes.error);
      } else {
        setUserDetails(userRes.data);
      }
    } catch (error) {
      console.error("Error loading match details:", error);
      toast.error("שגיאה בטעינת פרטי ההתאמה");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "לא צוין";
    try {
      return new Date(dateStr).toLocaleDateString('he-IL');
    } catch {
      return dateStr;
    }
  };

  // Check if details match
  const checkMatch = (studentValue: string | null, userValue: string | null) => {
    if (!studentValue || !userValue) return null;
    const s = studentValue.toLowerCase().trim();
    const u = userValue.toLowerCase().trim();
    return s === u;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">טוען התאמות...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 justify-between">
        <div className="flex items-center gap-2">
          {filteredMatches.length > 0 && (
            <>
              <Checkbox
                checked={selectedMatches.size === filteredMatches.length && filteredMatches.length > 0}
                onCheckedChange={toggleAllMatches}
                className="h-4 w-4"
              />
              <span className="text-sm text-muted-foreground">
                בחר הכל ({selectedMatches.size}/{filteredMatches.length})
              </span>
              {selectedMatches.size > 0 && (
                <div className="flex gap-2 mr-4">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleBatchAction('approve')}
                    disabled={isProcessingBatch}
                    className="gap-1"
                  >
                    <Check className="h-3 w-3" />
                    אשר נבחרים ({selectedMatches.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleBatchAction('reject')}
                    disabled={isProcessingBatch}
                    className="gap-1"
                  >
                    <X className="h-3 w-3" />
                    דחה נבחרים ({selectedMatches.size})
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
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
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedMatches.size === filteredMatches.length && filteredMatches.length > 0}
                    onCheckedChange={toggleAllMatches}
                    className="h-4 w-4"
                  />
                </TableHead>
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
                <TableRow key={match.id} className={`hover:bg-muted/50 ${selectedMatches.has(match.id) ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedMatches.has(match.id)}
                      onCheckedChange={() => toggleMatchSelection(match.id)}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <button
                      onClick={() => loadMatchDetails(match)}
                      className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      {match.students?.full_name || "N/A"}
                    </button>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {match.student_id.slice(0, 8)}...
                    </span>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => loadMatchDetails(match)}
                      className="text-green-600 hover:text-green-800 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      {match.users?.full_name || "N/A"}
                    </button>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {match.user_id.slice(0, 8)}...
                    </span>
                  </TableCell>
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

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Eye className="h-5 w-5" />
              פרטי התאמה - אימות נתונים
            </DialogTitle>
            <DialogDescription>
              בדוק את הפרטים של שני הצדדים ואמת שההתאמה מתאימה
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">טוען פרטים...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Match Score Summary */}
              {selectedMatchForDetails && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">ציון התאמה</h3>
                      <p className="text-sm text-muted-foreground">{selectedMatchForDetails.match_reason || "אין נימוק"}</p>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`${getScoreBgColor(selectedMatchForDetails.confidence_score)} ${getScoreColor(selectedMatchForDetails.confidence_score)} text-2xl px-4 py-2`}
                    >
                      {selectedMatchForDetails.confidence_score}%
                    </Badge>
                  </div>
                </div>
              )}

              {/* Side by Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Student Details */}
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3 bg-blue-50 dark:bg-blue-950">
                    <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <User className="h-5 w-5" />
                      חייל/ת
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {studentDetails ? (
                      <>
                        <DetailRow 
                          icon={<User className="h-4 w-4" />} 
                          label="שם מלא" 
                          value={studentDetails.full_name} 
                        />
                        <DetailRow 
                          icon={<span className="text-xs font-mono">#</span>} 
                          label="מזהה" 
                          value={studentDetails.id} 
                          isId 
                        />
                        <DetailRow 
                          icon={<Mail className="h-4 w-4" />} 
                          label="אימייל" 
                          value={studentDetails.email} 
                        />
                        <DetailRow 
                          icon={<Phone className="h-4 w-4" />} 
                          label="טלפון" 
                          value={studentDetails.phone} 
                        />
                        <Separator />
                        <DetailRow 
                          icon={<MapPin className="h-4 w-4" />} 
                          label="עיר" 
                          value={studentDetails.city}
                          highlight={checkMatch(studentDetails.city, userDetails?.city)}
                        />
                        <DetailRow 
                          icon={<Languages className="h-4 w-4" />} 
                          label="שפת אם" 
                          value={studentDetails.native_language}
                          highlight={checkMatch(studentDetails.native_language, userDetails?.native_language)}
                        />
                        <DetailRow 
                          icon={<User className="h-4 w-4" />} 
                          label="מין" 
                          value={studentDetails.gender}
                          highlight={checkMatch(studentDetails.gender, userDetails?.gender)}
                        />
                        <Separator />
                        <DetailRow 
                          icon={<Building className="h-4 w-4" />} 
                          label="חיל" 
                          value={studentDetails.military_unit} 
                        />
                        <DetailRow 
                          icon={<MapPin className="h-4 w-4" />} 
                          label="מקום שירות" 
                          value={studentDetails.service_location} 
                        />
                        {studentDetails.special_requests && (
                          <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-800">
                            <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">בקשות מיוחדות:</p>
                            <p className="text-sm">{studentDetails.special_requests}</p>
                          </div>
                        )}
                        <DetailRow 
                          icon={<Calendar className="h-4 w-4" />} 
                          label="נוצר בתאריך" 
                          value={formatDate(studentDetails.created_at)} 
                        />
                      </>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">לא נמצאו פרטי חייל</p>
                    )}
                  </CardContent>
                </Card>

                {/* User (Volunteer) Details */}
                <Card className="border-green-200 dark:border-green-800">
                  <CardHeader className="pb-3 bg-green-50 dark:bg-green-950">
                    <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-300">
                      <User className="h-5 w-5" />
                      מתנדב/ת
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {userDetails ? (
                      <>
                        <DetailRow 
                          icon={<User className="h-4 w-4" />} 
                          label="שם מלא" 
                          value={userDetails.full_name} 
                        />
                        <DetailRow 
                          icon={<span className="text-xs font-mono">#</span>} 
                          label="מזהה" 
                          value={userDetails.id} 
                          isId 
                        />
                        <DetailRow 
                          icon={<Mail className="h-4 w-4" />} 
                          label="אימייל" 
                          value={userDetails.email} 
                        />
                        <DetailRow 
                          icon={<Phone className="h-4 w-4" />} 
                          label="טלפון" 
                          value={userDetails.phone} 
                        />
                        <Separator />
                        <DetailRow 
                          icon={<MapPin className="h-4 w-4" />} 
                          label="עיר" 
                          value={userDetails.city}
                          highlight={checkMatch(studentDetails?.city, userDetails.city)}
                        />
                        <DetailRow 
                          icon={<Languages className="h-4 w-4" />} 
                          label="שפת אם" 
                          value={userDetails.native_language}
                          highlight={checkMatch(studentDetails?.native_language, userDetails.native_language)}
                        />
                        <DetailRow 
                          icon={<User className="h-4 w-4" />} 
                          label="מין" 
                          value={userDetails.gender}
                          highlight={checkMatch(studentDetails?.gender, userDetails.gender)}
                        />
                        <Separator />
                        <div className="p-2 bg-accent rounded">
                          <p className="text-xs font-semibold">קיבולת:</p>
                          <p className="text-sm">
                            {userDetails.current_students} / {userDetails.capacity_max} חיילים
                            {userDetails.current_students >= userDetails.capacity_max && (
                              <Badge variant="destructive" className="mr-2 text-xs">מלא</Badge>
                            )}
                          </p>
                        </div>
                        <DetailRow 
                          icon={<Check className="h-4 w-4" />} 
                          label="פעיל במלגה" 
                          value={userDetails.scholarship_active ? "✅ כן" : "❌ לא"} 
                        />
                        <DetailRow 
                          icon={<Check className="h-4 w-4" />} 
                          label="פעיל במערכת" 
                          value={userDetails.is_active ? "✅ כן" : "❌ לא"} 
                        />
                        <DetailRow 
                          icon={<Calendar className="h-4 w-4" />} 
                          label="נוצר בתאריך" 
                          value={formatDate(userDetails.created_at)} 
                        />
                      </>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">לא נמצאו פרטי מתנדב</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Match Validation Summary */}
              {studentDetails && userDetails && (
                <Card className="border-purple-200 dark:border-purple-800">
                  <CardHeader className="pb-3 bg-purple-50 dark:bg-purple-950">
                    <CardTitle className="text-lg text-purple-700 dark:text-purple-300">
                      סיכום אימות התאמה
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <ValidationItem 
                        label="שפת אם" 
                        match={checkMatch(studentDetails.native_language, userDetails.native_language)} 
                        studentValue={studentDetails.native_language}
                        userValue={userDetails.native_language}
                      />
                      <ValidationItem 
                        label="עיר" 
                        match={checkMatch(studentDetails.city, userDetails.city)} 
                        studentValue={studentDetails.city}
                        userValue={userDetails.city}
                      />
                      <ValidationItem 
                        label="מין" 
                        match={checkMatch(studentDetails.gender, userDetails.gender)} 
                        studentValue={studentDetails.gender}
                        userValue={userDetails.gender}
                      />
                      <ValidationItem 
                        label="קיבולת פנויה" 
                        match={userDetails.current_students < userDetails.capacity_max} 
                        studentValue={`${userDetails.current_students}/${userDetails.capacity_max}`}
                        userValue=""
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              {selectedMatchForDetails && (
                <div className="flex justify-center gap-4 pt-4 border-t">
                  <Button
                    size="lg"
                    variant="default"
                    className="gap-2 px-8"
                    onClick={() => {
                      updateMatchStatus(selectedMatchForDetails.id, 'approve');
                      setDetailsDialogOpen(false);
                    }}
                  >
                    <Check className="h-5 w-5" />
                    אשר התאמה
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    className="gap-2 px-8"
                    onClick={() => {
                      updateMatchStatus(selectedMatchForDetails.id, 'reject');
                      setDetailsDialogOpen(false);
                    }}
                  >
                    <X className="h-5 w-5" />
                    דחה התאמה
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Helper component for detail rows
const DetailRow = ({ 
  icon, 
  label, 
  value, 
  isId = false,
  highlight = null 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | null; 
  isId?: boolean;
  highlight?: boolean | null;
}) => (
  <div className={`flex items-start gap-2 ${highlight === true ? 'bg-green-100 dark:bg-green-900 p-1 rounded' : highlight === false ? 'bg-red-100 dark:bg-red-900 p-1 rounded' : ''}`}>
    <span className="text-muted-foreground mt-0.5">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm ${isId ? 'font-mono text-xs break-all' : ''} ${!value ? 'text-muted-foreground italic' : ''}`}>
        {value || "לא צוין"}
        {highlight === true && <span className="mr-1 text-green-600">✓</span>}
        {highlight === false && <span className="mr-1 text-red-600">✗</span>}
      </p>
    </div>
  </div>
);

// Helper component for validation items
const ValidationItem = ({ 
  label, 
  match, 
  studentValue, 
  userValue 
}: { 
  label: string; 
  match: boolean | null; 
  studentValue: string | null;
  userValue: string | null;
}) => (
  <div className={`p-3 rounded-lg text-center ${match === true ? 'bg-green-100 dark:bg-green-900' : match === false ? 'bg-red-100 dark:bg-red-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
    <div className="text-2xl mb-1">
      {match === true ? '✅' : match === false ? '❌' : '❓'}
    </div>
    <p className="font-semibold text-sm">{label}</p>
    {match === false && studentValue && userValue && (
      <p className="text-xs text-muted-foreground mt-1">
        {studentValue} ≠ {userValue}
      </p>
    )}
  </div>
);

export default MatchesTable;
