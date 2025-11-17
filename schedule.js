import { getSupabase } from './app.js';

let schedules = [];

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

    const supabase = getSupabase();
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

// 모달 열기
function openModal(schedule = null) {
    const modalTitle = document.getElementById('modalTitle');
    
    if (schedule) {
        modalTitle.textContent = '연습일 수정';
        document.getElementById('scheduleId').value = schedule.id;
        document.getElementById('practiceDate').value = schedule.practice_date;
        document.getElementById('isActive').checked = schedule.is_active;
        document.getElementById('scheduleMemo').value = schedule.memo || '';
    } else {
        modalTitle.textContent = '연습일 추가';
        scheduleForm.reset();
        document.getElementById('scheduleId').value = '';
        document.getElementById('isActive').checked = true;
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
    const supabase = getSupabase();
    if (!supabase) return;

    const id = document.getElementById('scheduleId').value;
    const practiceDate = document.getElementById('practiceDate').value;
    const isActive = document.getElementById('isActive').checked;
    const memo = document.getElementById('scheduleMemo').value;

    const scheduleData = {
        practice_date: practiceDate,
        is_active: isActive,
        memo: memo || null
    };

    try {
        if (id) {
            // 수정
            const { error } = await supabase
                .from('age_schedule')
                .update(scheduleData)
                .eq('id', id);
            
            if (error) throw error;
        } else {
            // 추가
            const { error } = await supabase
                .from('age_schedule')
                .insert([scheduleData]);
            
            if (error) throw error;
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

    const supabase = getSupabase();
    if (!supabase) return;

    try {
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
    const supabase = getSupabase();
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
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('age_schedule')
            .select('*')
            .order('practice_date', { ascending: true });

        if (error) throw error;

        schedules = data || [];
        displaySchedules();
    } catch (error) {
        console.error('연습일 목록 로드 오류:', error);
        alert('연습일 목록을 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 연습일 목록 표시
function displaySchedules() {
    if (schedules.length === 0) {
        scheduleList.innerHTML = '<p class="empty-message">등록된 연습일이 없습니다.</p>';
        return;
    }

    scheduleList.innerHTML = schedules.map(schedule => {
        const date = new Date(schedule.practice_date);
        const dateStr = date.toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'short'
        });

        return `
            <div class="schedule-item">
                <div class="schedule-info">
                    <div class="schedule-date">${dateStr}</div>
                    ${schedule.memo ? `<div class="schedule-memo">${schedule.memo}</div>` : ''}
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
document.addEventListener('DOMContentLoaded', () => {
    loadSchedules();
});
