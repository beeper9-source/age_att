-- age_members 테이블의 role 컬럼 check constraint 업데이트 및 email 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

-- 이메일 컬럼 추가
ALTER TABLE age_members ADD COLUMN IF NOT EXISTS email TEXT;

-- 기존 constraint 삭제 (이름이 다를 수 있으므로 확인 필요)
ALTER TABLE age_members DROP CONSTRAINT IF EXISTS age_members_role_check;

-- 새로운 constraint 추가 (악장, 부악장, 휴식 포함)
ALTER TABLE age_members 
ADD CONSTRAINT age_members_role_check 
CHECK (role IS NULL OR role IN (
    '단장',
    '부단장',
    '악장',
    '부악장',
    '총무',
    '음악감독',
    '파트장',
    '휴식'
));

