// Supabase 데이터베이스 설정 스크립트
// 이 스크립트는 Supabase Management API를 사용하여 테이블을 생성합니다.
// 주의: 서비스 역할 키가 필요합니다.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm';
import { SUPABASE_CONFIG } from './config.js';

// SQL 스크립트
const SQL_SCRIPT = `
-- 연습곡 테이블
CREATE TABLE IF NOT EXISTS age_songs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    composer TEXT,
    arranger TEXT,
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 연습일-곡 연결 테이블 (다대다 관계)
CREATE TABLE IF NOT EXISTS age_schedule_songs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_id UUID NOT NULL REFERENCES age_schedule(id) ON DELETE CASCADE,
    song_id UUID NOT NULL REFERENCES age_songs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(schedule_id, song_id)
);

-- 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_schedule_songs_schedule_id ON age_schedule_songs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_songs_song_id ON age_schedule_songs(song_id);
CREATE INDEX IF NOT EXISTS idx_songs_title ON age_songs(title);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE age_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_schedule_songs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
DROP POLICY IF EXISTS "Anyone can read songs" ON age_songs;
CREATE POLICY "Anyone can read songs" ON age_songs
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read schedule_songs" ON age_schedule_songs;
CREATE POLICY "Anyone can read schedule_songs" ON age_schedule_songs
    FOR SELECT USING (true);

-- 모든 사용자가 쓰기 가능
DROP POLICY IF EXISTS "Anyone can insert songs" ON age_songs;
CREATE POLICY "Anyone can insert songs" ON age_songs
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can insert schedule_songs" ON age_schedule_songs;
CREATE POLICY "Anyone can insert schedule_songs" ON age_schedule_songs
    FOR INSERT WITH CHECK (true);

-- 모든 사용자가 수정 가능
DROP POLICY IF EXISTS "Anyone can update songs" ON age_songs;
CREATE POLICY "Anyone can update songs" ON age_songs
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can update schedule_songs" ON age_schedule_songs;
CREATE POLICY "Anyone can update schedule_songs" ON age_schedule_songs
    FOR UPDATE USING (true);

-- 모든 사용자가 삭제 가능
DROP POLICY IF EXISTS "Anyone can delete songs" ON age_songs;
CREATE POLICY "Anyone can delete songs" ON age_songs
    FOR DELETE USING (true);

DROP POLICY IF EXISTS "Anyone can delete schedule_songs" ON age_schedule_songs;
CREATE POLICY "Anyone can delete schedule_songs" ON age_schedule_songs
    FOR DELETE USING (true);
`;

async function setupDatabase() {
    try {
        // Supabase 클라이언트 생성 (서비스 역할 키가 필요)
        // 주의: 서비스 역할 키는 환경 변수나 안전한 곳에 저장해야 합니다
        console.log('⚠️ 주의: 이 스크립트는 Supabase Management API를 사용합니다.');
        console.log('⚠️ 서비스 역할 키가 필요하며, anon key로는 SQL을 실행할 수 없습니다.');
        console.log('\n대신 다음 방법을 사용하세요:');
        console.log('1. Supabase 대시보드에 로그인');
        console.log('2. SQL Editor로 이동');
        console.log('3. database_schema.sql 파일의 내용을 복사하여 실행');
        console.log('\n또는 Supabase CLI를 사용하세요:');
        console.log('supabase db push --db-url "your-database-url" < database_schema.sql');
        
        return false;
    } catch (error) {
        console.error('오류:', error);
        return false;
    }
}

// 브라우저에서 실행할 경우
if (typeof window !== 'undefined') {
    window.setupDatabase = setupDatabase;
    console.log('setupDatabase() 함수를 호출하여 데이터베이스를 설정할 수 있습니다.');
    console.log('하지만 Supabase의 anon key로는 SQL을 실행할 수 없으므로');
    console.log('Supabase 대시보드에서 직접 실행하는 것을 권장합니다.');
}

export { setupDatabase, SQL_SCRIPT };

