import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  variant?: "default" | "success" | "warning" | "info";
}

const StatsCard = ({ title, value, icon, variant = "default" }: StatsCardProps) => {
  const variantStyles = {
    default: "bg-card border-border",
    success: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800",
    warning: "bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800",
    info: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
  };

  const iconStyles = {
    default: "text-muted-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-orange-600 dark:text-orange-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  return (
    <Card className={cn("transition-all hover:shadow-md", variantStyles[variant])}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1 text-right">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
          </div>
          <div className={cn("p-3 rounded-lg bg-background/50", iconStyles[variant])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsCard;
