// Supabase 클라이언트 초기화
// 특정 버전 사용으로 안정성 향상
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm';
import { SUPABASE_CONFIG } from './config.js';

let supabase;
let initializationPromise = null;

// Supabase 클라이언트 초기화
export function initSupabase() {
    // 이미 초기화 중이면 기존 Promise 반환
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            // Config 유효성 검사
            if (!SUPABASE_CONFIG) {
                const error = 'Supabase 설정 객체가 없습니다. config.js 파일을 확인하세요.';
                console.error(error);
                alert('Supabase 설정이 필요합니다. config.js 파일을 확인해주세요.');
                return null;
            }

            if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
                const error = 'Supabase 설정이 필요합니다. config.js 파일을 확인하세요.';
                console.error(error);
                console.error('URL:', SUPABASE_CONFIG.url);
                console.error('AnonKey:', SUPABASE_CONFIG.anonKey ? '설정됨' : '없음');
                alert('Supabase 설정이 필요합니다. config.js 파일에 URL과 anonKey를 입력해주세요.');
                return null;
            }

            // URL과 anonKey가 문자열인지 확인
            if (typeof SUPABASE_CONFIG.url !== 'string' || typeof SUPABASE_CONFIG.anonKey !== 'string') {
                const error = 'Supabase 설정 값이 올바른 형식이 아닙니다.';
                console.error(error);
                alert(error);
                return null;
            }

            // 빈 문자열 체크
            if (SUPABASE_CONFIG.url.trim() === '' || SUPABASE_CONFIG.anonKey.trim() === '') {
                const error = 'Supabase 설정 값이 비어있습니다.';
                console.error(error);
                alert(error + ' config.js 파일을 확인해주세요.');
                return null;
            }
            
            // createClient가 함수인지 확인
            if (typeof createClient !== 'function') {
                const error = 'createClient 함수를 사용할 수 없습니다. Supabase 라이브러리 로드를 확인해주세요.';
                console.error(error);
                alert(error);
                return null;
            }
            
            supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            
            // 클라이언트가 제대로 생성되었는지 확인
            if (!supabase) {
                const error = 'Supabase 클라이언트 생성에 실패했습니다.';
                console.error(error);
                alert(error);
                return null;
            }

            // auth 속성이 있는지 확인 (클라이언트가 제대로 초기화되었는지 검증)
            if (!supabase.auth) {
                const error = 'Supabase 클라이언트가 올바르게 초기화되지 않았습니다.';
                console.error(error);
                alert(error);
                return null;
            }
            
            return supabase;
        } catch (error) {
            console.error('Supabase 초기화 중 오류 발생:', error);
            console.error('오류 상세:', error.stack);
            alert('Supabase 초기화 중 오류가 발생했습니다: ' + error.message);
            return null;
        }
    })();

    return initializationPromise;
}

// 전역에서 사용할 수 있도록 export (동기 버전)
export function getSupabase() {
    if (!supabase) {
        // 동기적으로 초기화 시도 (이미 시작된 경우)
        if (initializationPromise) {
            // Promise가 완료될 때까지 기다리지 않고 현재 상태 반환
            console.warn('Supabase가 아직 초기화 중입니다.');
        } else {
            // 초기화가 시작되지 않았으면 시작
            initSupabase();
        }
    }
    return supabase;
}

// 비동기 버전 (권장)
export async function getSupabaseAsync() {
    if (!supabase && !initializationPromise) {
        await initSupabase();
    } else if (initializationPromise) {
        await initializationPromise;
    }
    return supabase;
}

// 페이지 로드 시 초기화
if (typeof window !== 'undefined') {
    // 즉시 초기화 시작
    initSupabase().catch(error => {
        console.error('페이지 로드 시 Supabase 초기화 실패:', error);
    });
}


