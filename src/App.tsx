import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import ApprovedMatches from "./pages/ApprovedMatches";
import AuditLogs from "./pages/AuditLogs";
import Students from "./pages/Students";
import Users from "./pages/Volunteers";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Matching from "./pages/Matching";
import NotFound from "./pages/NotFound";
import Login from "./components/Login";
import Footer from "./components/Footer";

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // בדיקה אם המשתמש כבר מאומת
    checkAuthentication();
    
    // האזנה לשינויים ב-sessionStorage (למקרה של פתיחת טאבים נוספים)
    const handleStorageChange = () => {
      checkAuthentication();
    };
    
    window.addEventListener("storage", handleStorageChange);
    
    // בדיקה תקופתית (כל 5 דקות) לוודא שהאימות עדיין תקף
    const interval = setInterval(() => {
      checkAuthentication();
    }, 5 * 60 * 1000);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const checkAuthentication = () => {
    const authenticated = sessionStorage.getItem("site_authenticated");
    const timestamp = sessionStorage.getItem("auth_timestamp");
    
    if (authenticated === "true" && timestamp) {
      // בדיקה שהאימות לא ישן מדי (24 שעות)
      const authTime = parseInt(timestamp);
      const now = Date.now();
      const hoursSinceAuth = (now - authTime) / (1000 * 60 * 60);
      
      if (hoursSinceAuth < 24) {
        setIsAuthenticated(true);
        return;
      } else {
        // אימות פג תוקף
        sessionStorage.removeItem("site_authenticated");
        sessionStorage.removeItem("auth_timestamp");
      }
    }
    
    setIsAuthenticated(false);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("site_authenticated");
    sessionStorage.removeItem("auth_timestamp");
    setIsAuthenticated(false);
  };

  // מציג מסך טעינה עד שבודקים את האימות
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">בודק הרשאות...</p>
        </div>
      </div>
    );
  }

  // אם לא מאומת, מציג מסך התחברות
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // אם מאומת, מציג את האפליקציה
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="flex flex-col min-h-screen">
            <div className="flex-1">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/approved-matches" element={<ApprovedMatches />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/students" element={<Students />} />
                <Route path="/users" element={<Users />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/matching" element={<Matching />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <Footer />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
