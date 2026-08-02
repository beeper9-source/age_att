-- 매주 금요일 오전 9시 (KST) 출석 체크 독촉 메일링 크론 작업 설정 SQL
-- Supabase SQL Editor에서 실행하세요.

-- 1. pg_cron 익스텐션 활성화 (활성화되어 있지 않은 경우)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 기존 동일한 크론 작업 일정이 등록되어 있으면 삭제
SELECT cron.unschedule('send-attendance-reminders-job');

-- 3. 크론 일정 등록 (매주 금요일 KST 오전 9시 = UTC 오전 0시)
-- ⚠️ 중요: URL의 'nqwjvrznwzmfytjlpfsk' 부분은 사용자의 Supabase 프로젝트 ID로 자동 적용되어 있으나,
-- ⚠️ headers의 '<SERVICE_ROLE_KEY>' 부분은 실제 Supabase 서비스 역할 키(service_role secret key)로 교체하여 실행하셔야 합니다.
SELECT cron.schedule(
  'send-attendance-reminders-job',
  '0 0 * * 5', -- 매주 금요일 00:00 UTC (09:00 KST)
  $$
  SELECT net.http_post(
    url := 'https://nqwjvrznwzmfytjlpfsk.supabase.co/functions/v1/send-attendance-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>", "apikey": "<SERVICE_ROLE_KEY>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 등록 확인용 쿼리 (등록 후 실행하여 확인해 보세요)
-- SELECT * FROM cron.job;
