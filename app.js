// Supabase 클라이언트 초기화
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_CONFIG } from './config.js';

let supabase;

// Supabase 클라이언트 초기화
export function initSupabase() {
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
        console.error('Supabase 설정이 필요합니다. config.js 파일을 확인하세요.');
        alert('Supabase 설정이 필요합니다. config.js 파일에 URL과 anonKey를 입력해주세요.');
        return null;
    }
    
    supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    return supabase;
}

// 전역에서 사용할 수 있도록 export
export function getSupabase() {
    if (!supabase) {
        supabase = initSupabase();
    }
    return supabase;
}

// 페이지 로드 시 초기화
if (typeof window !== 'undefined') {
    initSupabase();
}

