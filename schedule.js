import { getSupabase, getSupabaseAsync, initSupabase } from './app.js';

let schedules = [];
let songs = [];

// DOM 요소
const generateScheduleBtn = document.getElementById('generateScheduleBtn');
const addScheduleBtn = document.getElementById('addScheduleBtn');
const scheduleModal = document.getElementById('scheduleModal');
const scheduleForm = document.getElementById('scheduleForm');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');
const scheduleList = document.getElementById('scheduleList');

// 이벤트 리스너
generateScheduleBtn?.addEventListener('click', () => generateSchedules());
addScheduleBtn?.addEventListener('click', () => openModal());
closeBtn?.addEventListener('click', () => closeModal());
cancelBtn?.addEventListener('click', () => closeModal());

// 모달 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
    if (e.target === scheduleModal) {
        closeModal();
    }
});

// 폼 제출
scheduleForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSchedule();
});

// 연습일 자동 생성 (2025-11-22부터 2026-12-31까지 매주 토요일)
async function generateSchedules() {
    if (!confirm('2025년 11월 22일부터 2026년 12월 31일까지 매주 토요일을 자동 생성하시겠습니까?')) {
        return;
    }

    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    const startDate = new Date('2025-11-22');
    const endDate = new Date('2026-12-31');
    const schedulesToInsert = [];

    // 매주 토요일 찾기
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        // 토요일인지 확인 (6 = 토요일)
        if (currentDate.getDay() === 6) {
            schedulesToInsert.push({
                practice_date: currentDate.toISOString().split('T')[0],
                is_active: true,
                memo: null
            });
        }
        // 다음 날로 이동
        currentDate.setDate(currentDate.getDate() + 1);
    }

    try {
        // 기존 데이터와 중복 체크를 위해 upsert 사용
        const { error } = await supabase
            .from('age_schedule')
            .upsert(schedulesToInsert, { 
                onConflict: 'practice_date',
                ignoreDuplicates: false 
            });

        if (error) throw error;

        alert(`${schedulesToInsert.length}개의 연습일이 생성되었습니다.`);
        await loadSchedules();
    } catch (error) {
        console.error('연습일 생성 오류:', error);
        alert('연습일 생성 중 오류가 발생했습니다: ' + error.message);
    }
}

// 연습곡 목록 로드
async function loadSongs() {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('age_songs')
            .select('*')
            .order('title', { ascending: true });

        if (error) throw error;

        songs = data || [];
        updateSongSelect();
    } catch (error) {
        console.error('연습곡 목록 로드 오류:', error);
    }
}

// 곡 선택 드롭다운 업데이트
function updateSongSelect() {
    const songSelect = document.getElementById('scheduleSongs');
    if (!songSelect) return;

    // 기존 옵션 제거 (첫 번째 옵션 제외)
    while (songSelect.options.length > 1) {
        songSelect.remove(1);
    }

    // 곡 목록 추가
    songs.forEach(song => {
        const option = document.createElement('option');
        option.value = song.id;
        option.textContent = song.title;
        songSelect.appendChild(option);
    });
}

// 연습일에 연결된 곡 목록 로드
async function loadScheduleSongs(scheduleId) {
    const supabase = await getSupabaseAsync();
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('age_schedule_songs')
            .select('song_id')
            .eq('schedule_id', scheduleId);

        if (error) throw error;

        return data ? data.map(item => item.song_id) : [];
    } catch (error) {
        console.error('연습일-곡 연결 로드 오류:', error);
        return [];
    }
}

// 모달 열기
async function openModal(schedule = null) {
    const modalTitle = document.getElementById('modalTitle');
    
    // 곡 목록 로드
    await loadSongs();
    
    if (schedule) {
        modalTitle.textContent = '연습일 수정';
        document.getElementById('scheduleId').value = schedule.id;
        document.getElementById('practiceDate').value = schedule.practice_date;
        document.getElementById('isActive').checked = schedule.is_active;
        document.getElementById('scheduleMemo').value = schedule.memo || '';
        
        // 연결된 곡 선택
        const selectedSongIds = await loadScheduleSongs(schedule.id);
        const songSelect = document.getElementById('scheduleSongs');
        if (songSelect) {
            Array.from(songSelect.options).forEach(option => {
                option.selected = selectedSongIds.includes(option.value);
            });
        }
    } else {
        modalTitle.textContent = '연습일 추가';
        scheduleForm.reset();
        document.getElementById('scheduleId').value = '';
        document.getElementById('isActive').checked = true;
        
        // 곡 선택 초기화
        const songSelect = document.getElementById('scheduleSongs');
        if (songSelect) {
            Array.from(songSelect.options).forEach(option => {
                option.selected = false;
            });
        }
    }
    
    scheduleModal.style.display = 'block';
}

// 모달 닫기
function closeModal() {
    scheduleModal.style.display = 'none';
    scheduleForm.reset();
}

// 연습일 저장
async function saveSchedule() {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    const id = document.getElementById('scheduleId').value;
    const practiceDate = document.getElementById('practiceDate').value;
    const isActive = document.getElementById('isActive').checked;
    const memo = document.getElementById('scheduleMemo').value;
    const songSelect = document.getElementById('scheduleSongs');
    const selectedSongIds = songSelect ? Array.from(songSelect.selectedOptions).map(opt => opt.value).filter(v => v) : [];

    const scheduleData = {
        practice_date: practiceDate,
        is_active: isActive,
        memo: memo || null
    };

    try {
        let scheduleId = id;
        
        if (id) {
            // 수정
            const { error } = await supabase
                .from('age_schedule')
                .update(scheduleData)
                .eq('id', id);
            
            if (error) throw error;
            scheduleId = id;
        } else {
            // 추가
            const { data, error } = await supabase
                .from('age_schedule')
                .insert([scheduleData])
                .select();
            
            if (error) throw error;
            scheduleId = data[0].id;
        }

        // 연습일-곡 연결 저장
        if (scheduleId) {
            // 기존 연결 삭제
            const { error: deleteError } = await supabase
                .from('age_schedule_songs')
                .delete()
                .eq('schedule_id', scheduleId);

            if (deleteError) throw deleteError;

            // 새로운 연결 추가
            if (selectedSongIds.length > 0) {
                const scheduleSongs = selectedSongIds.map(songId => ({
                    schedule_id: scheduleId,
                    song_id: songId
                }));

                const { error: insertError } = await supabase
                    .from('age_schedule_songs')
                    .insert(scheduleSongs);

                if (insertError) throw insertError;
            }
        }

        closeModal();
        await loadSchedules();
    } catch (error) {
        console.error('연습일 저장 오류:', error);
        alert('연습일 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 연습일 삭제
async function deleteSchedule(id) {
    if (!confirm('정말 이 연습일을 삭제하시겠습니까?')) return;

    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    try {
        // 먼저 연습일-곡 연결 삭제
        const { error: linkError } = await supabase
            .from('age_schedule_songs')
            .delete()
            .eq('schedule_id', id);

        if (linkError) throw linkError;

        // 연습일 삭제
        const { error } = await supabase
            .from('age_schedule')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await loadSchedules();
    } catch (error) {
        console.error('연습일 삭제 오류:', error);
        alert('연습일 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// 활성화 상태 토글
async function toggleScheduleActive(id, currentStatus) {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('age_schedule')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (error) throw error;

        await loadSchedules();
    } catch (error) {
        console.error('활성화 상태 변경 오류:', error);
        alert('상태 변경 중 오류가 발생했습니다: ' + error.message);
    }
}

// 연습일 목록 로드
async function loadSchedules() {
    // DOM 요소 확인
    if (!scheduleList) {
        console.error('scheduleList DOM 요소를 찾을 수 없습니다.');
        return;
    }

    // 로딩 메시지 표시
    scheduleList.innerHTML = '<p class="empty-message">연습일 목록을 불러오는 중...</p>';

    const supabase = await getSupabaseAsync();
    if (!supabase) {
        scheduleList.innerHTML = '<p class="empty-message" style="color: red;">Supabase 연결에 실패했습니다. 페이지를 새로고침해주세요.</p>';
        console.error('Supabase 클라이언트를 가져올 수 없습니다.');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('age_schedule')
            .select('*')
            .order('practice_date', { ascending: true });

        if (error) {
            console.error('Supabase 쿼리 오류:', error);
            throw error;
        }

        schedules = data || [];
        console.log('로드된 연습일 수:', schedules.length);
        // 곡 목록도 함께 로드
        await loadSongs();
        await displaySchedules();
    } catch (error) {
        console.error('연습일 목록 로드 오류:', error);
        if (scheduleList) {
            scheduleList.innerHTML = `<p class="empty-message" style="color: red;">연습일 목록을 불러오는 중 오류가 발생했습니다: ${error.message}</p>`;
        }
        alert('연습일 목록을 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 연습일 목록 표시
async function displaySchedules() {
    // DOM 요소 확인
    if (!scheduleList) {
        console.error('scheduleList DOM 요소를 찾을 수 없습니다.');
        return;
    }

    if (schedules.length === 0) {
        scheduleList.innerHTML = '<p class="empty-message">등록된 연습일이 없습니다.</p>';
        return;
    }

    // 각 연습일에 연결된 곡 정보를 가져오기 위해 Promise.all 사용
    const schedulesWithSongs = await Promise.all(schedules.map(async (schedule) => {
        const scheduleSongs = await loadScheduleSongs(schedule.id);
        return { ...schedule, songs: scheduleSongs };
    }));

    scheduleList.innerHTML = schedulesWithSongs.map(schedule => {
        const date = new Date(schedule.practice_date);
        const dateStr = date.toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'short'
        });

        // 연결된 곡 이름 가져오기
        const songNames = schedule.songs
            .map(songId => {
                const song = songs.find(s => s.id === songId);
                return song ? song.title : null;
            })
            .filter(name => name !== null);

        return `
            <div class="schedule-item">
                <div class="schedule-info">
                    <div class="schedule-date">${dateStr}</div>
                    ${schedule.memo ? `<div class="schedule-memo">${schedule.memo}</div>` : ''}
                    ${songNames.length > 0 ? `<div class="schedule-songs" style="margin-top: 8px; color: #666;">
                        <strong>연습곡:</strong> ${songNames.join(', ')}
                    </div>` : ''}
                </div>
                <div class="schedule-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" ${schedule.is_active ? 'checked' : ''} 
                               onchange="window.toggleScheduleActive('${schedule.id}', ${schedule.is_active})">
                        <span class="toggle-slider"></span>
                    </label>
                    <button class="btn btn-primary btn-small" onclick="window.editSchedule('${schedule.id}')">수정</button>
                    <button class="btn btn-danger btn-small" onclick="window.deleteSchedule('${schedule.id}')">삭제</button>
                </div>
            </div>
        `;
    }).join('');
}

// 전역 함수로 등록
window.editSchedule = (id) => {
    const schedule = schedules.find(s => s.id === id);
    if (schedule) openModal(schedule);
};

window.deleteSchedule = deleteSchedule;
window.toggleScheduleActive = toggleScheduleActive;

// 페이지 로드 시 연습일 목록 로드
document.addEventListener('DOMContentLoaded', async () => {
    // Supabase 초기화가 완료될 때까지 잠시 대기
    try {
        // Supabase 초기화 시작 (이미 시작되었을 수도 있음)
        await initSupabase();
        // 초기화 완료 후 목록 로드
        await loadSchedules();
    } catch (error) {
        console.error('페이지 초기화 오류:', error);
        if (scheduleList) {
            scheduleList.innerHTML = '<p class="empty-message" style="color: red;">페이지 초기화 중 오류가 발생했습니다. 페이지를 새로고침해주세요.</p>';
        }
    }
});
