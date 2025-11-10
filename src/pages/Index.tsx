import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCheck, Clock, FileCheck, GraduationCap, Heart, BarChart3, Settings, Sparkles } from "lucide-react";
import { toast } from "sonner";
import MatchesTable from "@/components/MatchesTable";
import StatsCard from "@/components/StatsCard";
import { ExcelUpload } from "@/components/ExcelUpload";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    waitingStudents: 0,
    activeUsers: 0,
    suggestedMatches: 0,
    approvedMatches: 0,
  });
  useEffect(() => {
    loadStats();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('stats-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, loadStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, loadStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, loadStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadStats = async () => {
    const [studentsRes, usersRes, suggestedRes, approvedRes] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact' }).eq('is_matched', false),
      supabase.from('users').select('id', { count: 'exact' }).eq('is_active', true).eq('scholarship_active', true),
      supabase.from('matches').select('id', { count: 'exact' }).eq('status', 'Suggested'),
      supabase.from('matches').select('id', { count: 'exact' }).eq('status', 'approved'),
    ]);

    setStats({
      waitingStudents: studentsRes.count || 0,
      activeUsers: usersRes.count || 0,
      suggestedMatches: suggestedRes.count || 0,
      approvedMatches: approvedRes.count || 0,
    });
  };

  return (
    <div className="min-h-screen bg-secondary/30" dir="rtl">
      <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-right w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
              מערכת שיבוץ חכמה
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              ניהול שיבוצים אוטומטי בין סטודנטים למתנדבים
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button 
              onClick={() => navigate('/matching')}
              variant="outline"
              size="lg"
              className="gap-2 flex-1 sm:flex-initial text-sm sm:text-base"
            >
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden md:inline">סריקה מתקדמת</span>
              <span className="md:hidden">סריקה</span>
            </Button>
            <Button 
              onClick={() => navigate('/analytics')}
              variant="outline"
              size="lg"
              className="gap-2 flex-1 sm:flex-initial text-sm sm:text-base"
            >
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden md:inline">דוחות וניתוח</span>
              <span className="md:hidden">דוחות</span>
            </Button>
            <Button 
              onClick={() => navigate('/students')}
              variant="outline"
              size="lg"
              className="gap-2 flex-1 sm:flex-initial text-sm sm:text-base"
            >
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden md:inline">ניהול סטודנטים</span>
              <span className="md:hidden">סטודנטים</span>
            </Button>
            <Button 
              onClick={() => navigate('/users')}
              variant="outline"
              size="lg"
              className="gap-2 flex-1 sm:flex-initial text-sm sm:text-base"
            >
              <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden md:inline">ניהול משתמשים</span>
              <span className="md:hidden">משתמשים</span>
            </Button>
            <Button 
              onClick={() => navigate('/audit-logs')}
              variant="outline"
              size="lg"
              className="gap-2 flex-1 sm:flex-initial text-sm sm:text-base"
            >
              <FileCheck className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden lg:inline">לוג התראות</span>
              <span className="lg:hidden">לוגים</span>
            </Button>
            <Button 
              onClick={() => navigate('/settings')}
              variant="outline"
              size="lg"
              className="gap-2 flex-1 sm:flex-initial text-sm sm:text-base"
            >
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden lg:inline">הגדרות</span>
              <span className="lg:hidden">הגדרות</span>
            </Button>
          </div>
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
            title="משתמשים פעילים"
            value={stats.activeUsers}
            icon={<Users className="h-5 w-5" />}
            variant="info"
          />
          <StatsCard
            title="התאמות מוצעות"
            value={stats.suggestedMatches}
            icon={<Clock className="h-5 w-5" />}
            variant="default"
          />
          <div onClick={() => navigate('/approved-matches')} className="cursor-pointer">
            <StatsCard
              title="התאמות מאושרות"
              value={stats.approvedMatches}
              icon={<UserCheck className="h-5 w-5" />}
              variant="success"
            />
          </div>
        </div>

        {/* Excel Upload */}
        <ExcelUpload />

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
