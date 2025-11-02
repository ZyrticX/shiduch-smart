import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyMatchRequest {
  matchId: string;
}

async function sendResendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "מערכת שיבוץ <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return await response.json();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { matchId }: NotifyMatchRequest = await req.json();

    if (!matchId) {
      return new Response(
        JSON.stringify({ error: "Missing matchId" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log(`Sending notifications for match ${matchId}`);

    // Fetch match with related data
    const { data: match, error: matchError } = await supabaseClient
      .from("matches")
      .select(`
        *,
        students(id, full_name, email, phone, city, native_language),
        volunteers(id, full_name, email, phone, city, native_language)
      `)
      .eq("id", matchId)
      .eq("status", "approved")
      .single();

    if (matchError || !match) {
      console.error("Match not found or not approved:", matchError);
      return new Response(
        JSON.stringify({ error: "התאמה לא נמצאה או לא מאושרת" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    const student = match.students as any;
    const volunteer = match.volunteers as any;

    if (!student || !volunteer) {
      return new Response(
        JSON.stringify({ error: "חסרים נתוני סטודנט או מתנדב" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    const notifications = [];

    // Send email to student
    if (student.email) {
      try {
        const studentEmailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
    .content { background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { color: #3ecf8e; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
    .info { background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 15px 0; border-right: 4px solid #3ecf8e; }
    .label { font-weight: bold; color: #333; }
    .value { color: #666; margin-top: 5px; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <div class="header">🎉 שובצת למתנדב!</div>
      <p>שלום ${student.full_name},</p>
      <p>שמחים לבשר לך שמצאנו עבורך התאמה מעולה למתנדב!</p>
      
      <div class="info">
        <div class="label">פרטי המתנדב שלך:</div>
        <div class="value">
          <strong>שם:</strong> ${volunteer.full_name}<br>
          <strong>עיר:</strong> ${volunteer.city}<br>
          <strong>שפת אם:</strong> ${volunteer.native_language}<br>
          ${volunteer.email ? `<strong>אימייל:</strong> ${volunteer.email}<br>` : ""}
          ${volunteer.phone ? `<strong>טלפון:</strong> ${volunteer.phone}<br>` : ""}
        </div>
      </div>

      <div class="info">
        <div class="label">סיבת ההתאמה:</div>
        <div class="value">${match.match_reason}</div>
        <div class="value" style="margin-top: 10px;">
          <strong>ציון התאמה:</strong> ${match.confidence_score}%
        </div>
      </div>

      <p>מומלץ ליצור קשר עם המתנדב בהקדם כדי לתאם את תחילת הלימודים.</p>
      <p>בהצלחה!</p>

      <div class="footer">
        מערכת שיבוץ חכמה<br>
        הודעה זו נשלחה אוטומטית
      </div>
    </div>
  </div>
</body>
</html>
        `;

        const { error: studentEmailError } = await sendResendEmail(
          student.email,
          "שובצת למתנדב! 🎉",
          studentEmailHtml
        );

        if (studentEmailError) {
          throw studentEmailError;
        }

        // Log successful notification
        await supabaseClient.from("audit_log").insert({
          match_id: matchId,
          action: "match_approved_notification",
          actor_type: "system",
          recipient_email: student.email,
          notification_channel: "email",
          status: "sent",
          metadata: { recipient_type: "student", confidence_score: match.confidence_score },
        });

        notifications.push({ type: "student_email", status: "sent" });
        console.log(`Email sent to student: ${student.email}`);
      } catch (error) {
        console.error("Error sending email to student:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        // Log failed notification
        await supabaseClient.from("audit_log").insert({
          match_id: matchId,
          action: "match_approved_notification",
          actor_type: "system",
          recipient_email: student.email,
          notification_channel: "email",
          status: "failed",
          error_message: errorMessage,
          metadata: { recipient_type: "student" },
        });

        notifications.push({ type: "student_email", status: "failed", error: errorMessage });
      }
    }

    // Send email to volunteer
    if (volunteer.email) {
      try {
        const volunteerEmailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
    .content { background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { color: #3ecf8e; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
    .info { background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 15px 0; border-right: 4px solid #3ecf8e; }
    .label { font-weight: bold; color: #333; }
    .value { color: #666; margin-top: 5px; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <div class="header">🎓 סטודנט חדש שובץ אליך!</div>
      <p>שלום ${volunteer.full_name},</p>
      <p>תודה על התנדבותך! שובץ אליך סטודנט חדש.</p>
      
      <div class="info">
        <div class="label">פרטי הסטודנט:</div>
        <div class="value">
          <strong>שם:</strong> ${student.full_name}<br>
          <strong>עיר:</strong> ${student.city}<br>
          <strong>שפת אם:</strong> ${student.native_language}<br>
          ${student.email ? `<strong>אימייל:</strong> ${student.email}<br>` : ""}
          ${student.phone ? `<strong>טלפון:</strong> ${student.phone}<br>` : ""}
        </div>
      </div>

      <div class="info">
        <div class="label">סיבת ההתאמה:</div>
        <div class="value">${match.match_reason}</div>
        <div class="value" style="margin-top: 10px;">
          <strong>ציון התאמה:</strong> ${match.confidence_score}%
        </div>
      </div>

      <p>מומלץ ליצור קשר עם הסטודנט בהקדם כדי לתאם את תחילת הלימודים.</p>
      <p>תודה על ההתנדבות!</p>

      <div class="footer">
        מערכת שיבוץ חכמה<br>
        הודעה זו נשלחה אוטומטית
      </div>
    </div>
  </div>
</body>
</html>
        `;

        const { error: volunteerEmailError } = await sendResendEmail(
          volunteer.email,
          "סטודנט חדש שובץ אליך! 🎓",
          volunteerEmailHtml
        );

        if (volunteerEmailError) {
          throw volunteerEmailError;
        }

        // Log successful notification
        await supabaseClient.from("audit_log").insert({
          match_id: matchId,
          action: "match_approved_notification",
          actor_type: "system",
          recipient_email: volunteer.email,
          notification_channel: "email",
          status: "sent",
          metadata: { recipient_type: "volunteer", confidence_score: match.confidence_score },
        });

        notifications.push({ type: "volunteer_email", status: "sent" });
        console.log(`Email sent to volunteer: ${volunteer.email}`);
      } catch (error) {
        console.error("Error sending email to volunteer:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        // Log failed notification
        await supabaseClient.from("audit_log").insert({
          match_id: matchId,
          action: "match_approved_notification",
          actor_type: "system",
          recipient_email: volunteer.email,
          notification_channel: "email",
          status: "failed",
          error_message: errorMessage,
          metadata: { recipient_type: "volunteer" },
        });

        notifications.push({ type: "volunteer_email", status: "failed", error: errorMessage });
      }
    }

    // SMS/WhatsApp notifications (optional - placeholder for future implementation)
    // if (student.phone) {
    //   // TODO: Implement SMS/WhatsApp via Twilio or similar
    //   console.log(`SMS notification for student phone: ${student.phone}`);
    // }
    // if (volunteer.phone) {
    //   // TODO: Implement SMS/WhatsApp via Twilio or similar
    //   console.log(`SMS notification for volunteer phone: ${volunteer.phone}`);
    // }

    return new Response(
      JSON.stringify({
        success: true,
        message: "התראות נשלחו בהצלחה",
        notifications,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in notify-match:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
