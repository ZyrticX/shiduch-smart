import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

// סיסמת הגישה לאתר - ניתן לשנות בקובץ זה
const SITE_PASSWORD = "idf_2025";

interface LoginProps {
  onLogin: () => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // בדיקת סיסמה
    if (password === SITE_PASSWORD) {
      // שמירת הסיסמה ב-sessionStorage (נמחקת עם סגירת הדפדפן)
      sessionStorage.setItem("site_authenticated", "true");
      sessionStorage.setItem("auth_timestamp", Date.now().toString());
      toast.success("אימות הצליח! נכנסים לאתר...");
      
      setTimeout(() => {
        setIsLoading(false);
        onLogin();
      }, 500);
    } else {
      setIsLoading(false);
      toast.error("סיסמה שגויה. אנא נסה שוב.");
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/20 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">גישה מוגבלת</CardTitle>
          <CardDescription className="text-base">
            האתר מוגן בסיסמה. אנא הזן את הסיסמה כדי להמשיך
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="הזן סיסמה"
                  className="pr-10"
                  disabled={isLoading}
                  autoFocus
                  dir="ltr"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !password}
              size="lg"
            >
              {isLoading ? "בודק..." : "התחבר"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>גישה מוגבלת למשתמשים מורשים בלבד</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

