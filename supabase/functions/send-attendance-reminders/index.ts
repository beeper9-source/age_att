import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts"

serve(async (req) => {
  // CORS 프리플라이트 요청 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    // SMTP 설정 정보 (기본값: Gmail SMTP)
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUsername = Deno.env.get("SMTP_USERNAME") || "beeper9@gmail.com";
    const smtpPassword = Deno.env.get("SMTP_PASSWORD"); // App Password
    const senderEmail = Deno.env.get("SENDER_EMAIL") || "beeper9@gmail.com";
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:8000";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in environment variables.");
    }
    if (!smtpPassword) {
      throw new Error("SMTP_PASSWORD (App Password) is required in environment variables to connect to SMTP server.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // KST(한국 표준시) 기준 날짜 계산
    const now = new Date();
    // Deno Deploy 서버가 UTC 기준일 수 있으므로 서울 시간으로 변환
    const kstTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    
    // 다음 다가오는 토요일 계산 (금요일(5)에 실행되면 1일 더하여 토요일(6))
    const daysToSaturday = (6 - kstTime.getDay() + 7) % 7;
    const targetSaturday = new Date(kstTime.getTime() + daysToSaturday * 24 * 60 * 60 * 1000);
    
    const yyyy = targetSaturday.getFullYear();
    const mm = String(targetSaturday.getMonth() + 1).padStart(2, "0");
    const dd = String(targetSaturday.getDate()).padStart(2, "0");
    const targetDateString = `${yyyy}-${mm}-${dd}`;

    console.log(`Checking attendance for target practice date: ${targetDateString}`);

    // 1. 해당 토요일의 활성화된 연습일 일정 조회
    const { data: schedule, error: scheduleError } = await supabase
      .from("age_schedule")
      .select("id, practice_date, memo")
      .eq("practice_date", targetDateString)
      .eq("is_active", true)
      .maybeSingle();

    if (scheduleError) {
      throw scheduleError;
    }

    if (!schedule) {
      console.log(`No active schedule found for next Saturday (${targetDateString}). Skipping reminders.`);
      return new Response(JSON.stringify({ message: "No active schedule found. Skipping reminders." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2. 전체 단원 목록 조회 (휴식 중이 아닌 단원)
    const { data: members, error: membersError } = await supabase
      .from("age_members")
      .select("id, name, nickname, email, part, role");

    if (membersError) {
      throw membersError;
    }

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ message: "No members registered." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 파트장 정보 파싱 (part -> leader email)
    const partLeaders = new Map();
    members.forEach((m) => {
      if (m.role === "파트장" && m.email && m.part) {
        partLeaders.set(m.part, { name: m.name, email: m.email });
      }
    });

    // 3. 해당 연습일의 출석 기록 조회
    const { data: attendance, error: attendanceError } = await supabase
      .from("age_attendance")
      .select("member_id, status")
      .eq("schedule_id", schedule.id);

    if (attendanceError) {
      throw attendanceError;
    }

    // 출석/불참 완료자 집합 생성
    const checkedInMemberIds = new Set();
    const undecidedMemberIds = new Set();

    if (attendance) {
      attendance.forEach((record) => {
        if (record.status === "출석" || record.status === "불참") {
          checkedInMemberIds.add(record.member_id);
        } else if (record.status === "미정") {
          undecidedMemberIds.add(record.member_id);
        }
      });
    }

    // 4. 출석 체크가 미정 또는 안 되어 있는 단원 추출 (이메일이 등록된 실활동 단원 기준)
    const pendingMembers = members.filter((m) => {
      // 역할이 '휴식'인 단원은 제외
      if (m.role === "휴식") return false;
      // 이메일이 없는 단원은 발송 불가하므로 제외
      if (!m.email || m.email.trim() === "") return false;

      const hasChecked = checkedInMemberIds.has(m.id);
      const isUndecided = undecidedMemberIds.has(m.id);

      // 출석을 완료하지 않았거나('미정' 포함), 출석 기록 자체가 없는 경우
      return !hasChecked || isUndecided;
    });

    console.log(`Found ${pendingMembers.length} pending members without attendance checked.`);

    if (pendingMembers.length === 0) {
      return new Response(JSON.stringify({ message: "All active members have checked their attendance." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 5. SMTP 클라이언트 연결 초기화
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465 || Deno.env.get("SMTP_TLS") === "true",
        auth: {
          username: smtpUsername,
          password: smtpPassword,
        },
      },
    });

    // 6. 독촉 이메일 발송 루프
    const results = [];
    for (const m of pendingMembers) {
      try {
        const to = m.email;
        const cc = [];
        const partLeader = m.part ? partLeaders.get(m.part) : null;
        
        // 본인이 파트장이 아니고 파트장 이메일이 등록되어 있으면 참조(Cc) 추가
        if (partLeader && partLeader.email && partLeader.email !== m.email) {
          cc.push(partLeader.email);
        }

        const emailBody = `
          <div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 25px; border-radius: 8px; color: #333333;">
            <h2 style="color: #2b579a; border-bottom: 2px solid #2b579a; padding-bottom: 12px; margin-top: 0;">🎸 Reina 출석 체크 요청</h2>
            <p>안녕하세요, <strong>${m.name}</strong>님 (${m.nickname ? `닉네임: ${m.nickname}, ` : ''}${m.part || ''}).</p>
            <p>돌아오는 <strong>${targetSaturday.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })} 연습 일정</strong>의 출석 체크가 완료되지 않아 안내해 드립니다.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 5px 0; font-weight: bold; color: #555;">📅 연습일 일정</p>
              <p style="margin: 0; font-size: 1.1em; color: #222;">${targetSaturday.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} (토요일)</p>
              ${schedule.memo ? `<p style="margin: 5px 0 0 0; color: #666; font-size: 0.95em;">📝 메모: ${schedule.memo}</p>` : ""}
            </div>
            
            <p>원활한 합주 준비 및 인원 점검을 위해 오늘 중으로 출석 여부를 결정해 주시기 바랍니다.</p>
            
            <div style="margin: 30px 0; text-align: center;">
              <a href="${appUrl}/attendance.html" target="_blank" style="background-color: #2b579a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">출석 체크 화면으로 가기</a>
            </div>
            
            <p style="font-size: 0.85em; color: #888888; border-top: 1px solid #eeeeee; padding-top: 15px; margin-top: 30px;">
              ※ 본 메일은 출석체크 알림 시스템에 의해 자동으로 발송되었습니다.<br>
              ※ 수신인: 본인(${m.name}) ${cc.length > 0 ? `, 파트장(${partLeader.name}) 참조` : ''}
            </p>
          </div>
        `;

        await client.send({
          from: senderEmail,
          to: to,
          ...(cc.length > 0 ? { cc: cc } : {}),
          subject: `[Reina] ${m.name}님, 이번 주 토요일 연습 출석 체크 요청`,
          html: emailBody,
        });

        results.push({ name: m.name, status: "sent" });
      } catch (err) {
        console.error(`Failed to send email to ${m.name}:`, err);
        results.push({ name: m.name, status: "failed", error: err.message });
      }
    }

    // SMTP 연결 닫기
    await client.close();

    return new Response(JSON.stringify({
      message: "Attendance reminders processed successfully.",
      results: results
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error processing attendance reminders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
