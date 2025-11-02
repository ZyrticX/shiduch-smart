import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Clock, Languages, MapPin, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import StatsCard from "@/components/StatsCard";

interface WeeklyData {
  week: string;
  approved: number;
}

interface LanguageData {
  language: string;
  count: number;
}

interface CityData {
  city: string;
  students: number;
  volunteers: number;
  ratio: number;
}

export default function Analytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [weeklyApprovals, setWeeklyApprovals] = useState<WeeklyData[]>([]);
  const [topLanguages, setTopLanguages] = useState<LanguageData[]>([]);
  const [topCities, setTopCities] = useState<CityData[]>([]);
  const [avgApprovalTime, setAvgApprovalTime] = useState<number>(0);
  const [capacityUtilization, setCapacityUtilization] = useState<number>(0);
  const [totalMatched, setTotalMatched] = useState<number>(0);
  const [totalPending, setTotalPending] = useState<number>(0);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);

    try {
      // Weekly approvals - last 8 weeks
      const { data: matchesData } = await supabase
        .from("matches")
        .select("approved_at, status")
        .eq("status", "approved")
        .order("approved_at", { ascending: false });

      if (matchesData) {
        const weeklyMap = new Map<string, number>();
        const now = new Date();
        
        // Initialize last 8 weeks
        for (let i = 7; i >= 0; i--) {
          const weekDate = new Date(now);
          weekDate.setDate(now.getDate() - (i * 7));
          const weekKey = `שבוע ${8 - i}`;
          weeklyMap.set(weekKey, 0);
        }

        matchesData.forEach((match) => {
          if (match.approved_at) {
            const approvedDate = new Date(match.approved_at);
            const daysDiff = Math.floor((now.getTime() - approvedDate.getTime()) / (1000 * 60 * 60 * 24));
            const weekIndex = Math.floor(daysDiff / 7);
            
            if (weekIndex < 8) {
              const weekKey = `שבוע ${8 - weekIndex}`;
              weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + 1);
            }
          }
        });

        setWeeklyApprovals(
          Array.from(weeklyMap.entries()).map(([week, approved]) => ({ week, approved }))
        );

        // Calculate average approval time
        const approvalTimes = matchesData
          .filter(m => m.approved_at)
          .map(m => {
            const created = new Date(m.approved_at!);
            const approved = new Date(m.approved_at!);
            return Math.abs(approved.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
          });
        
        if (approvalTimes.length > 0) {
          const avg = approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length;
          setAvgApprovalTime(Math.round(avg * 10) / 10);
        }
      }

      // Top languages from students
      const { data: studentsData } = await supabase
        .from("students")
        .select("native_language");

      if (studentsData) {
        const langMap = new Map<string, number>();
        studentsData.forEach(s => {
          langMap.set(s.native_language, (langMap.get(s.native_language) || 0) + 1);
        });

        setTopLanguages(
          Array.from(langMap.entries())
            .map(([language, count]) => ({ language, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)
        );
      }

      // City analysis - supply and demand
      const { data: cityStudents } = await supabase
        .from("students")
        .select("city");

      const { data: cityVolunteers } = await supabase
        .from("volunteers")
        .select("city");

      if (cityStudents && cityVolunteers) {
        const studentMap = new Map<string, number>();
        const volunteerMap = new Map<string, number>();

        cityStudents.forEach(s => {
          studentMap.set(s.city, (studentMap.get(s.city) || 0) + 1);
        });

        cityVolunteers.forEach(v => {
          volunteerMap.set(v.city, (volunteerMap.get(v.city) || 0) + 1);
        });

        const allCities = new Set([...studentMap.keys(), ...volunteerMap.keys()]);
        const cityData: CityData[] = Array.from(allCities).map(city => {
          const students = studentMap.get(city) || 0;
          const volunteers = volunteerMap.get(city) || 0;
          return {
            city,
            students,
            volunteers,
            ratio: volunteers > 0 ? Math.round((students / volunteers) * 10) / 10 : students
          };
        });

        setTopCities(
          cityData
            .sort((a, b) => (a.students + a.volunteers) - (b.students + b.volunteers))
            .reverse()
            .slice(0, 8)
        );
      }

      // Capacity utilization
      const { data: volunteersData } = await supabase
        .from("volunteers")
        .select("current_matches, capacity, is_active")
        .eq("is_active", true);

      if (volunteersData && volunteersData.length > 0) {
        const totalCapacity = volunteersData.reduce((sum, v) => sum + v.capacity, 0);
        const totalUsed = volunteersData.reduce((sum, v) => sum + v.current_matches, 0);
        setCapacityUtilization(Math.round((totalUsed / totalCapacity) * 100));
      }

      // Match counts
      const { count: matchedCount } = await supabase
        .from("matches")
        .select("id", { count: "exact" })
        .eq("status", "approved");

      const { count: pendingCount } = await supabase
        .from("matches")
        .select("id", { count: "exact" })
        .eq("status", "pending");

      setTotalMatched(matchedCount || 0);
      setTotalPending(pendingCount || 0);

    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  return (
    <div className="min-h-screen bg-background p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">דוחות וניתוח</h1>
            <p className="text-muted-foreground mt-2">
              ניתוח מעמיק של נתוני השיבוצים והמערכת
            </p>
          </div>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowRight className="ml-2 h-4 w-4" />
            חזרה לדף הראשי
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">טוען נתונים...</div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="סה״כ התאמות מאושרות"
                value={totalMatched}
                icon={<TrendingUp className="h-5 w-5" />}
                variant="success"
              />
              <StatsCard
                title="התאמות ממתינות"
                value={totalPending}
                icon={<Clock className="h-5 w-5" />}
                variant="warning"
              />
              <StatsCard
                title="זמן ממוצע לאישור"
                value={`${avgApprovalTime}h`}
                icon={<Clock className="h-5 w-5" />}
                variant="info"
              />
              <StatsCard
                title="ניצול קיבולת"
                value={`${capacityUtilization}%`}
                icon={<Users className="h-5 w-5" />}
                variant="default"
              />
            </div>

            {/* Weekly Approvals Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  התאמות מאושרות לפי שבוע
                </CardTitle>
                <CardDescription>
                  מעקב אחר מספר ההתאמות המאושרות ב-8 השבועות האחרונים
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyApprovals}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="approved" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      name="התאמות מאושרות"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Languages and Cities */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Languages */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="h-5 w-5" />
                    שפות מובילות
                  </CardTitle>
                  <CardDescription>
                    התפלגות שפות האם של הסטודנטים
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={topLanguages}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.language}: ${entry.count}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {topLanguages.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top Cities - Supply vs Demand */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    ערים מובילות - היצע וביקוש
                  </CardTitle>
                  <CardDescription>
                    השוואה בין מספר סטודנטים למתנדבים לפי עיר
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topCities}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="city" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="students" fill="#8b5cf6" name="סטודנטים" />
                      <Bar dataKey="volunteers" fill="#06b6d4" name="מתנדבים" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* City Ratios Table */}
            <Card>
              <CardHeader>
                <CardTitle>יחס ביקוש-היצע לפי עיר</CardTitle>
                <CardDescription>
                  יחס בין מספר סטודנטים למתנדבים (מספר גבוה = ביקוש גבוה יותר)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {topCities.map((city) => (
                    <Card key={city.city}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{city.city}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">סטודנטים:</span>
                            <span className="font-medium">{city.students}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">מתנדבים:</span>
                            <span className="font-medium">{city.volunteers}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <span className="text-muted-foreground">יחס:</span>
                            <span className={`font-bold ${
                              city.ratio > 2 ? "text-red-600" : 
                              city.ratio > 1 ? "text-orange-600" : 
                              "text-green-600"
                            }`}>
                              {city.ratio.toFixed(1)}:1
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
