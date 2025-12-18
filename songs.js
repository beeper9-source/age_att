import { getSupabase, getSupabaseAsync, initSupabase } from './app.js';

let songs = [];
let songPracticeCounts = {}; // 곡별 연습 횟수
let songPracticeDetails = {}; // 곡별 연습 상세 정보

// DOM 요소
const addSongBtn = document.getElementById('addSongBtn');
const songModal = document.getElementById('songModal');
const songForm = document.getElementById('songForm');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');
const songsList = document.getElementById('songsList');

// 이벤트 리스너
addSongBtn?.addEventListener('click', () => openModal());
closeBtn?.addEventListener('click', () => closeModal());
cancelBtn?.addEventListener('click', () => closeModal());

// 모달 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
    if (e.target === songModal) {
        closeModal();
    }
});

// 폼 제출
songForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSong();
});

// 모달 열기
function openModal(song = null) {
    const modalTitle = document.getElementById('modalTitle');
    
    if (song) {
        modalTitle.textContent = '연습곡 수정';
        document.getElementById('songId').value = song.id;
        document.getElementById('songTitle').value = song.title;
        document.getElementById('songComposer').value = song.composer || '';
        document.getElementById('songArranger').value = song.arranger || '';
        document.getElementById('songMemo').value = song.memo || '';
    } else {
        modalTitle.textContent = '연습곡 추가';
        songForm.reset();
        document.getElementById('songId').value = '';
    }
    
    songModal.style.display = 'block';
}

// 모달 닫기
function closeModal() {
    songModal.style.display = 'none';
    songForm.reset();
}

// 연습곡 저장
async function saveSong() {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    const id = document.getElementById('songId').value;
    const title = document.getElementById('songTitle').value;
    const composer = document.getElementById('songComposer').value;
    const arranger = document.getElementById('songArranger').value;
    const memo = document.getElementById('songMemo').value;

    const songData = {
        title,
        composer: composer || null,
        arranger: arranger || null,
        memo: memo || null
    };

    try {
        if (id) {
            // 수정
            const { error } = await supabase
                .from('age_songs')
                .update(songData)
                .eq('id', id);
            
            if (error) throw error;
        } else {
            // 추가
            const { error } = await supabase
                .from('age_songs')
                .insert([songData]);
            
            if (error) throw error;
        }

        closeModal();
        await loadSongs();
    } catch (error) {
        console.error('연습곡 저장 오류:', error);
        alert('연습곡 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 연습곡 삭제
async function deleteSong(id) {
    if (!confirm('정말 이 연습곡을 삭제하시겠습니까?')) return;

    // 비밀번호 확인
    const password = prompt('거북코사번을 입력하세요:');
    
    if (password === null) {
        return;
    }
    
    if (password !== '22331') {
        alert('비밀번호가 일치하지 않습니다. 삭제가 취소되었습니다.');
        return;
    }

    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    try {
        // 먼저 연습일-곡 연결 삭제
        const { error: linkError } = await supabase
            .from('age_schedule_songs')
            .delete()
            .eq('song_id', id);

        if (linkError) throw linkError;

        // 곡 삭제
        const { error } = await supabase
            .from('age_songs')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await loadSongs();
    } catch (error) {
        console.error('연습곡 삭제 오류:', error);
        alert('연습곡 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// 각 곡의 연습 횟수 및 상세 정보 로드
async function loadSongPracticeInfo() {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    try {
        // 모든 연습일-곡 연결 정보 가져오기
        const { data: scheduleSongs, error: scheduleSongsError } = await supabase
            .from('age_schedule_songs')
            .select('song_id, schedule_id');

        if (scheduleSongsError) {
            console.error('연습일-곡 연결 정보 로드 오류:', scheduleSongsError);
            return;
        }

        if (!scheduleSongs || scheduleSongs.length === 0) {
            songPracticeCounts = {};
            songPracticeDetails = {};
            return;
        }

        // 모든 고유한 schedule_id 수집
        const scheduleIds = [...new Set(scheduleSongs.map(item => item.schedule_id))];
        
        // 연습일 정보 가져오기
        const { data: schedules, error: schedulesError } = await supabase
            .from('age_schedule')
            .select('id, practice_date, memo')
            .in('id', scheduleIds);

        if (schedulesError) {
            console.error('연습일 정보 로드 오류:', schedulesError);
            return;
        }

        // schedule_id를 키로 하는 맵 생성
        const scheduleMap = {};
        if (schedules) {
            schedules.forEach(schedule => {
                scheduleMap[schedule.id] = schedule;
            });
        }

        // 곡별로 그룹화하여 카운트 및 상세 정보 저장
        songPracticeCounts = {};
        songPracticeDetails = {};

        scheduleSongs.forEach(item => {
            const songId = item.song_id;
            const schedule = scheduleMap[item.schedule_id];
            
            // 카운트 증가
            if (!songPracticeCounts[songId]) {
                songPracticeCounts[songId] = 0;
                songPracticeDetails[songId] = [];
            }
            songPracticeCounts[songId]++;
            
            // 상세 정보 추가
            if (schedule) {
                songPracticeDetails[songId].push({
                    scheduleId: item.schedule_id,
                    practiceDate: schedule.practice_date,
                    memo: schedule.memo
                });
            }
        });

        // 날짜순으로 정렬
        Object.keys(songPracticeDetails).forEach(songId => {
            songPracticeDetails[songId].sort((a, b) => 
                new Date(a.practiceDate) - new Date(b.practiceDate)
            );
        });
    } catch (error) {
        console.error('연습 정보 로드 오류:', error);
    }
}

// 연습곡 목록 로드
async function loadSongs() {
    // DOM 요소 확인
    if (!songsList) {
        console.error('songsList DOM 요소를 찾을 수 없습니다.');
        return;
    }

    // 로딩 메시지 표시
    songsList.innerHTML = '<p class="empty-message">연습곡 목록을 불러오는 중...</p>';

    const supabase = await getSupabaseAsync();
    if (!supabase) {
        songsList.innerHTML = '<p class="empty-message" style="color: red;">Supabase 연결에 실패했습니다. 페이지를 새로고침해주세요.</p>';
        console.error('Supabase 클라이언트를 가져올 수 없습니다.');
        return;
    }

    try {
        // 곡 목록과 연습 정보를 병렬로 로드
        const [songsResult] = await Promise.all([
            supabase
                .from('age_songs')
                .select('*')
                .order('title', { ascending: true }),
            loadSongPracticeInfo()
        ]);

        if (songsResult.error) {
            console.error('Supabase 쿼리 오류:', songsResult.error);
            throw songsResult.error;
        }

        songs = songsResult.data || [];
        console.log('로드된 연습곡 수:', songs.length);
        displaySongs();
    } catch (error) {
        console.error('연습곡 목록 로드 오류:', error);
        if (songsList) {
            songsList.innerHTML = `<p class="empty-message" style="color: red;">연습곡 목록을 불러오는 중 오류가 발생했습니다: ${error.message}</p>`;
        }
        alert('연습곡 목록을 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 연습곡 목록 표시
function displaySongs() {
    // DOM 요소 확인
    if (!songsList) {
        console.error('songsList DOM 요소를 찾을 수 없습니다.');
        return;
    }

    if (songs.length === 0) {
        songsList.innerHTML = '<p class="empty-message">등록된 연습곡이 없습니다.</p>';
        return;
    }

    songsList.innerHTML = songs.map(song => {
        const practiceCount = songPracticeCounts[song.id] || 0;
        const hasPracticeDetails = practiceCount > 0;
        
        return `
        <div class="song-card">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <h3 style="margin: 0;">${song.title}</h3>
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: bold; color: #4CAF50;">
                        연습 ${practiceCount}회
                    </div>
                    ${hasPracticeDetails ? `
                        <button class="btn btn-small" 
                                style="background: #2196F3; color: white; margin-top: 5px; font-size: 12px;"
                                onclick="window.showPracticeDetails('${song.id}')">
                            상세보기
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="song-info">
                ${song.composer ? `<p><strong>작곡가:</strong> ${song.composer}</p>` : ''}
                ${song.arranger ? `<p><strong>편곡가:</strong> ${song.arranger}</p>` : ''}
                ${song.memo ? `<p><strong>메모:</strong> ${song.memo}</p>` : ''}
            </div>
            <div class="song-actions">
                <button class="btn btn-primary btn-small" onclick="window.editSong('${song.id}')">수정</button>
                <button class="btn btn-danger btn-small" onclick="window.deleteSong('${song.id}')">삭제</button>
            </div>
        </div>
    `;
    }).join('');
}

// 연습 상세 정보 표시
function showPracticeDetails(songId) {
    const song = songs.find(s => s.id === songId);
    const details = songPracticeDetails[songId] || [];
    
    if (!song) return;
    
    let detailsHtml = `
        <h3>${song.title} - 연습 이력</h3>
        <p style="margin-bottom: 15px;"><strong>총 연습 횟수:</strong> ${details.length}회</p>
    `;
    
    if (details.length === 0) {
        detailsHtml += '<p>아직 연습한 기록이 없습니다.</p>';
    } else {
        detailsHtml += '<div style="max-height: 400px; overflow-y: auto;">';
        detailsHtml += details.map((detail, index) => {
            const date = new Date(detail.practiceDate);
            const dateStr = date.toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                weekday: 'short'
            });
            
            return `
                <div style="padding: 10px; border-bottom: 1px solid #eee; margin-bottom: 5px;">
                    <div style="font-weight: bold; color: #333;">${index + 1}. ${dateStr}</div>
                    ${detail.memo ? `<div style="color: #666; font-size: 14px; margin-top: 5px;">${detail.memo}</div>` : ''}
                </div>
            `;
        }).join('');
        detailsHtml += '</div>';
    }
    
    // 모달 생성 및 표시
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            ${detailsHtml}
            <div style="margin-top: 20px; text-align: right;">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">닫기</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 전역 함수로 등록 (HTML에서 호출하기 위해)
window.editSong = (id) => {
    const song = songs.find(s => s.id === id);
    if (song) openModal(song);
};

window.deleteSong = deleteSong;
window.showPracticeDetails = showPracticeDetails;

// 페이지 로드 시 연습곡 목록 로드
document.addEventListener('DOMContentLoaded', async () => {
    // Supabase 초기화가 완료될 때까지 잠시 대기
    try {
        // Supabase 초기화 시작 (이미 시작되었을 수도 있음)
        await initSupabase();
        // 초기화 완료 후 목록 로드
        await loadSongs();
    } catch (error) {
        console.error('페이지 초기화 오류:', error);
        if (songsList) {
            songsList.innerHTML = '<p class="empty-message" style="color: red;">페이지 초기화 중 오류가 발생했습니다. 페이지를 새로고침해주세요.</p>';
        }
    }
});

