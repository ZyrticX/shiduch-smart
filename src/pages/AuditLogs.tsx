import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, CheckCircle, XCircle, Clock, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";

interface AuditLog {
  id: string;
  match_id: string;
  action: string;
  actor_type: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  notification_channel: string | null;
  status: string;
  error_message: string | null;
  metadata: any;
  created_at: string;
}

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadLogs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('audit-logs-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_log' }, loadLogs)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      toast.error("שגיאה בטעינת הלוגים");
      console.error(error);
    } else {
      setLogs(data || []);
    }
    setIsLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      sent: { className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" },
      failed: { className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400" },
      pending: { className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400" },
    };

    return (
      <Badge variant="secondary" {...variants[status]}>
        {status === 'sent' ? 'נשלח' : status === 'failed' ? 'נכשל' : 'ממתין'}
      </Badge>
    );
  };

  const getChannelIcon = (channel: string | null) => {
    if (channel === 'email') {
      return <Mail className="h-4 w-4" />;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center">
        <div className="text-center">טוען לוגים...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30" dir="rtl">
      <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-right w-full sm:w-auto">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="gap-2 mb-2"
            >
              <ArrowRight className="h-4 w-4" />
              חזרה לדשבורד
            </Button>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
              לוג התראות
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              מעקב אחר כל ההתראות שנשלחו במערכת
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">נשלח בהצלחה</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {logs.filter(l => l.status === 'sent').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">נכשל</p>
                  <p className="text-2xl font-bold text-red-600">
                    {logs.filter(l => l.status === 'failed').length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">סה״כ</p>
                  <p className="text-2xl font-bold text-foreground">
                    {logs.length}
                  </p>
                </div>
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>רשימת התראות</CardTitle>
            <CardDescription>
              100 ההתראות האחרונות במערכת
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">אין לוגים עדיין</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right whitespace-nowrap">תאריך</TableHead>
                      <TableHead className="text-right whitespace-nowrap hidden sm:table-cell">סוג פעולה</TableHead>
                      <TableHead className="text-right whitespace-nowrap">נמען</TableHead>
                      <TableHead className="text-right whitespace-nowrap hidden md:table-cell">ערוץ</TableHead>
                      <TableHead className="text-right whitespace-nowrap">סטטוס</TableHead>
                      <TableHead className="text-right whitespace-nowrap hidden lg:table-cell">פרטים</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('he-IL')}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-sm">
                            {log.action === 'match_approved_notification' 
                              ? 'התראת אישור התאמה' 
                              : log.action}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {log.recipient_email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                <span className="truncate max-w-[150px] sm:max-w-none">{log.recipient_email}</span>
                              </div>
                            )}
                            {log.recipient_phone && (
                              <div className="text-muted-foreground">
                                {log.recipient_phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            {getChannelIcon(log.notification_channel)}
                            <span className="text-sm">
                              {log.notification_channel === 'email' ? 'אימייל' : log.notification_channel}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            {getStatusBadge(log.status)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs hidden lg:table-cell">
                          {log.error_message ? (
                            <p className="text-xs text-red-600 line-clamp-2">
                              {log.error_message}
                            </p>
                          ) : log.metadata ? (
                            <p className="text-xs text-muted-foreground">
                              {log.metadata.recipient_type === 'student' 
                                ? 'סטודנט' 
                                : log.metadata.recipient_type === 'volunteer'
                                ? 'מתנדב'
                                : ''}
                              {log.metadata.confidence_score && 
                                ` (ציון: ${log.metadata.confidence_score}%)`}
                            </p>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuditLogs;
