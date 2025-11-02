import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" dir="rtl">
      <div className="text-center max-w-md">
        <h1 className="mb-4 text-6xl sm:text-8xl font-bold text-primary">404</h1>
        <p className="mb-2 text-xl sm:text-2xl font-semibold text-foreground">אופס! הדף לא נמצא</p>
        <p className="mb-6 text-sm sm:text-base text-muted-foreground">
          הדף שביקשת לא קיים או הועבר למיקום אחר
        </p>
        <Button onClick={() => navigate("/")} className="gap-2">
          <Home className="h-4 w-4" />
          חזרה לדף הראשי
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
