import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCheck, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import MatchesTable from "@/components/MatchesTable";
import StatsCard from "@/components/StatsCard";

const Index = () => {
  const [stats, setStats] = useState({
    waitingStudents: 0,
    activeVolunteers: 0,
    pendingMatches: 0,
    approvedMatches: 0,
  });
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    loadStats();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('stats-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, loadStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volunteers' }, loadStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, loadStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadStats = async () => {
    const [studentsRes, volunteersRes, pendingRes, approvedRes] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact' }).eq('is_matched', false),
      supabase.from('volunteers').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('matches').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('matches').select('id', { count: 'exact' }).eq('status', 'approved'),
    ]);

    setStats({
      waitingStudents: studentsRes.count || 0,
      activeVolunteers: volunteersRes.count || 0,
      pendingMatches: pendingRes.count || 0,
      approvedMatches: approvedRes.count || 0,
    });
  };

  const runMatchingAlgorithm = async () => {
    setIsMatching(true);
    toast.info("מריץ אלגוריתם התאמה חכם...");
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-matches', {
        body: { minScore: 60, limit: 100 }
      });

      if (error) throw error;

      if (data?.suggestedCount > 0) {
        toast.success(`✨ ${data.message}`);
        loadStats();
      } else {
        toast.info(data?.message || "לא נמצאו התאמות חדשות");
      }
    } catch (error: any) {
      console.error("Error running matching algorithm:", error);
      toast.error("שגיאה בהפעלת מנגנון ההתאמה");
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-right">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              מערכת שיבוץ חכמה
            </h1>
            <p className="text-muted-foreground">
              ניהול שיבוצים אוטומטי בין סטודנטים למתנדבים
            </p>
          </div>
          <Button 
            onClick={runMatchingAlgorithm}
            disabled={isMatching}
            size="lg"
            className="gap-2"
          >
            <Sparkles className="h-5 w-5" />
            הפעל התאמה חכמה
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="סטודנטים ממתינים"
            value={stats.waitingStudents}
            icon={<Clock className="h-5 w-5" />}
            variant="warning"
          />
          <StatsCard
            title="מתנדבים פעילים"
            value={stats.activeVolunteers}
            icon={<Users className="h-5 w-5" />}
            variant="info"
          />
          <StatsCard
            title="התאמות ממתינות"
            value={stats.pendingMatches}
            icon={<Clock className="h-5 w-5" />}
            variant="default"
          />
          <StatsCard
            title="התאמות מאושרות"
            value={stats.approvedMatches}
            icon={<UserCheck className="h-5 w-5" />}
            variant="success"
          />
        </div>

        {/* Matches Table */}
        <Card>
          <CardHeader className="text-right">
            <CardTitle>התאמות מוצעות</CardTitle>
            <CardDescription>
              התאמות חכמות על בסיס שפה, עיר, מין ומרחק גאוגרפי
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MatchesTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
