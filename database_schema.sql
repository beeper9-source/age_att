-- Reina 출석부 앱 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하세요

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
-- 모든 사용자가 읽기/쓰기 가능하도록 설정 (필요에 따라 수정)
ALTER TABLE age_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_schedule_songs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can read songs" ON age_songs
    FOR SELECT USING (true);

CREATE POLICY "Anyone can read schedule_songs" ON age_schedule_songs
    FOR SELECT USING (true);

-- 모든 사용자가 쓰기 가능
CREATE POLICY "Anyone can insert songs" ON age_songs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert schedule_songs" ON age_schedule_songs
    FOR INSERT WITH CHECK (true);

-- 모든 사용자가 수정 가능
CREATE POLICY "Anyone can update songs" ON age_songs
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can update schedule_songs" ON age_schedule_songs
    FOR UPDATE USING (true);

-- 모든 사용자가 삭제 가능
CREATE POLICY "Anyone can delete songs" ON age_songs
    FOR DELETE USING (true);

CREATE POLICY "Anyone can delete schedule_songs" ON age_schedule_songs
    FOR DELETE USING (true);

