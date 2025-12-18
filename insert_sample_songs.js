// 연습곡 샘플 데이터 10건 삽입 스크립트
// 브라우저 콘솔에서 실행하거나 별도 HTML 페이지에서 사용

import { getSupabaseAsync, initSupabase } from './app.js';

const sampleSongs = [
    {
        title: '카르멘 서곡',
        composer: '비제',
        arranger: '클래식기타 편곡',
        memo: '오케스트라 곡을 클래식기타 앙상블로 편곡'
    },
    {
        title: '아라베스크 1번',
        composer: '드뷔시',
        arranger: null,
        memo: '인상주의 작곡가의 대표작'
    },
    {
        title: '캐논',
        composer: '파헬벨',
        arranger: '클래식기타 편곡',
        memo: '바로크 시대의 유명한 캐논'
    },
    {
        title: '사계 중 봄',
        composer: '비발디',
        arranger: '클래식기타 편곡',
        memo: '사계 중 첫 번째 곡'
    },
    {
        title: '아다지오',
        composer: '알비노니',
        arranger: null,
        memo: '슬로우 템포의 아름다운 곡'
    },
    {
        title: '미뉴엣',
        composer: '바흐',
        arranger: '클래식기타 편곡',
        memo: '바로크 시대의 우아한 춤곡'
    },
    {
        title: '녹턴',
        composer: '쇼팽',
        arranger: '클래식기타 편곡',
        memo: '로맨틱 시대의 피아노 곡'
    },
    {
        title: '세레나데',
        composer: '슈베르트',
        arranger: null,
        memo: '밤의 세레나데'
    },
    {
        title: '피가로의 결혼 서곡',
        composer: '모차르트',
        arranger: '클래식기타 편곡',
        memo: '오페라 서곡'
    },
    {
        title: '사랑의 인사',
        composer: '엘가',
        arranger: null,
        memo: '로맨틱한 선율의 곡'
    }
];

async function insertSampleSongs() {
    try {
        await initSupabase();
        const supabase = await getSupabaseAsync();
        
        if (!supabase) {
            console.error('Supabase 클라이언트를 가져올 수 없습니다.');
            alert('Supabase 연결에 실패했습니다.');
            return;
        }

        // 기존 곡 확인 (중복 방지)
        const { data: existingSongs, error: checkError } = await supabase
            .from('age_songs')
            .select('title');

        if (checkError) {
            console.error('기존 곡 확인 오류:', checkError);
            throw checkError;
        }

        const existingTitles = existingSongs?.map(s => s.title) || [];
        const songsToInsert = sampleSongs.filter(song => !existingTitles.includes(song.title));

        if (songsToInsert.length === 0) {
            alert('모든 샘플 곡이 이미 등록되어 있습니다.');
            return;
        }

        // 샘플 데이터 삽입
        const { data, error } = await supabase
            .from('age_songs')
            .insert(songsToInsert)
            .select();

        if (error) {
            console.error('샘플 곡 삽입 오류:', error);
            throw error;
        }

        console.log(`${songsToInsert.length}개의 샘플 곡이 성공적으로 추가되었습니다:`, data);
        alert(`✅ ${songsToInsert.length}개의 샘플 곡이 성공적으로 추가되었습니다!`);
        
        // 페이지 새로고침 (연습곡 관리 페이지인 경우)
        if (window.location.pathname.includes('songs.html')) {
            window.location.reload();
        }
    } catch (error) {
        console.error('샘플 곡 삽입 중 오류:', error);
        alert('샘플 곡 삽입 중 오류가 발생했습니다: ' + error.message);
    }
}

// 전역 함수로 등록
if (typeof window !== 'undefined') {
    window.insertSampleSongs = insertSampleSongs;
    console.log('insertSampleSongs() 함수를 호출하여 샘플 곡을 추가할 수 있습니다.');
}

export { insertSampleSongs, sampleSongs };

