import { getSupabaseAsync } from './app.js';

let members = [];
let schedules = [];
let attendanceBySchedule = {}; // scheduleId -> { id?, status }

const memberSelect = document.getElementById('memberSelect');
const schedulesSection = document.getElementById('schedulesSection');
const schedulesList = document.getElementById('schedulesList');
const emptyMessage = document.getElementById('emptyMessage');

// 단원 선택 시
memberSelect?.addEventListener('change', async (e) => {
    const memberId = e.target.value;
    if (!memberId) {
        schedulesSection.style.display = 'none';
        emptyMessage.style.display = 'block';
        emptyMessage.textContent = '단원을 선택하면 해당 단원의 연습일 목록이 표시됩니다.';
        return;
    }
    await loadMemberAttendance(memberId);
    displaySchedules(memberId);
    schedulesSection.style.display = 'block';
    emptyMessage.style.display = 'none';
});

// 일괄 설정 버튼
document.querySelectorAll('.btn-bulk').forEach(btn => {
    btn.addEventListener('click', async () => {
        const memberId = memberSelect.value;
        if (!memberId) {
            alert('단원을 먼저 선택하세요.');
            return;
        }
        const status = btn.getAttribute('data-status');
        const checked = Array.from(document.querySelectorAll('.schedule-row-cb:checked')).map(cb => cb.value);
        if (checked.length === 0) {
            alert('일괄 설정할 연습일을 하나 이상 선택하세요.');
            return;
        }
        for (const scheduleId of checked) {
            await setAttendance(memberId, scheduleId, status);
        }
        await loadMemberAttendance(memberId);
        displaySchedules(memberId);
    });
});

// 단원 목록 로드
async function loadMembers() {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('age_members')
            .select('*')
            .order('part', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;
        // 이름 또는 닉네임에 '휴식'이 포함된 단원은 제외 (단원관리 외 모든 화면에서 숨김)
        members = (data || []).filter(member => 
            (!member.name || !member.name.includes('휴식')) && 
            (!member.nickname || !member.nickname.includes('휴식'))
        );
        renderMemberOptions();
    } catch (error) {
        console.error('단원 목록 로드 오류:', error);
    }
}

function renderMemberOptions() {
    if (!memberSelect) return;
    memberSelect.innerHTML = '<option value="">단원을 선택하세요</option>' +
        members.map(m => {
            const label = `${m.name}${m.nickname ? ` (${m.nickname})` : ''} - ${m.part || ''}`;
            return `<option value="${m.id}">${label}</option>`;
        }).join('');
}

// 연습일 목록 로드
async function loadSchedules() {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('age_schedule')
            .select('*')
            .eq('is_active', true)
            .order('practice_date', { ascending: true });

        if (error) throw error;
        schedules = data || [];
    } catch (error) {
        console.error('연습일 목록 로드 오류:', error);
    }
}

// 선택한 단원의 출석 기록 로드 (모든 연습일 기준)
async function loadMemberAttendance(memberId) {
    const supabase = await getSupabaseAsync();
    if (!supabase || !memberId) return;

    attendanceBySchedule = {};
    try {
        const { data, error } = await supabase
            .from('age_attendance')
            .select('*')
            .eq('member_id', memberId);

        if (error) throw error;
        (data || []).forEach(r => {
            attendanceBySchedule[r.schedule_id] = { id: r.id, status: r.status };
        });
    } catch (error) {
        console.error('출석 기록 로드 오류:', error);
    }
}

// 연습일 목록 표시 (체크박스 + 상태 + 버튼)
function displaySchedules(memberId) {
    if (!schedules.length) {
        schedulesList.innerHTML = '<p class="empty-message">등록된 연습일이 없습니다.</p>';
        return;
    }

    schedulesList.innerHTML = schedules.map(schedule => {
        const rec = attendanceBySchedule[schedule.id];
        const status = rec ? rec.status : '미정';
        const statusClass = status === '출석' ? 'present' : status === '불참' ? 'absent' : 'unknown';
        const date = new Date(schedule.practice_date);
        const dateStr = date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });
        const memoText = schedule.memo ? ` (${schedule.memo})` : '';

        return `
            <div class="schedule-row ${statusClass}" data-schedule-id="${schedule.id}">
                <label class="schedule-row-check">
                    <input type="checkbox" class="schedule-row-cb" value="${schedule.id}">
                    <span class="schedule-date">${dateStr}${memoText}</span>
                </label>
                <span class="schedule-status-badge status-${statusClass}">${status}</span>
                <div class="schedule-row-actions">
                    <button type="button" class="btn btn-small" data-status="출석">출석</button>
                    <button type="button" class="btn btn-small" data-status="불참">불참</button>
                    <button type="button" class="btn btn-small" data-status="미정">미정</button>
                </div>
            </div>
        `;
    }).join('');

    // 행별 출석/불참/미정 버튼
    schedulesList.querySelectorAll('.schedule-row-actions button').forEach(btn => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('.schedule-row');
            const scheduleId = row.getAttribute('data-schedule-id');
            const status = btn.getAttribute('data-status');
            await setAttendance(memberId, scheduleId, status);
            await loadMemberAttendance(memberId);
            displaySchedules(memberId);
        });
    });
}

// 출석 한 건 저장/수정
async function setAttendance(memberId, scheduleId, status) {
    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    const existing = attendanceBySchedule[scheduleId];

    try {
        if (existing) {
            const { error } = await supabase
                .from('age_attendance')
                .update({ status })
                .eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('age_attendance')
                .insert([{ member_id: memberId, schedule_id: scheduleId, status }]);
            if (error) throw error;
        }
    } catch (error) {
        console.error('출석 저장 오류:', error);
        alert('출석 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    await loadSchedules();
    await loadMembers();
});
