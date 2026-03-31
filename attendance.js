import { getSupabase, getSupabaseAsync } from './app.js';

let members = [];
let schedules = [];
let attendanceRecords = [];
let currentScheduleId = null;

// DOM 요소
const scheduleSelect = document.getElementById('scheduleSelect');
const partFilterAttendance = document.getElementById('partFilterAttendance');
const attendanceContainer = document.getElementById('attendanceContainer');

// 이벤트 리스너
scheduleSelect?.addEventListener('change', async (e) => {
    currentScheduleId = e.target.value;
    if (currentScheduleId) {
        await loadAttendance();
    } else {
        attendanceContainer.innerHTML = '<p class="empty-message">연습일을 선택하면 출석 체크를 시작할 수 있습니다.</p>';
    }
});

partFilterAttendance?.addEventListener('change', () => {
    if (currentScheduleId) {
        displayAttendance();
    }
});

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
        displayScheduleOptions();
    } catch (error) {
        console.error('연습일 목록 로드 오류:', error);
    }
}

// 오늘 날짜 문자열 (YYYY-MM-DD, 로컬 기준)
function getTodayDateString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// 연습일 날짜만 비교용 (practice_date가 'YYYY-MM-DD' 또는 ISO 문자열일 수 있음)
function getScheduleDateString(schedule) {
    const s = schedule.practice_date;
    if (!s) return '';
    return String(s).slice(0, 10);
}

// 디폴트 연습일: 오늘과 같은 날이 있으면 그날, 없으면 오늘 기준 다가오는 연습일
function setDefaultScheduleAndLoad() {
    if (!scheduleSelect || !schedules.length) return;

    const today = getTodayDateString();

    // 1) 오늘과 같은 연습일이 있으면 그날을 디폴트
    let defaultSchedule = schedules.find(s => getScheduleDateString(s) === today);
    if (defaultSchedule) {
        scheduleSelect.value = defaultSchedule.id;
        currentScheduleId = defaultSchedule.id;
        loadAttendance();
        return;
    }

    // 2) 오늘 이후 다가오는 연습일 중 첫 번째를 디폴트
    defaultSchedule = schedules.find(s => getScheduleDateString(s) >= today);
    if (defaultSchedule) {
        scheduleSelect.value = defaultSchedule.id;
        currentScheduleId = defaultSchedule.id;
        loadAttendance();
    }
}

// 연습일 선택 옵션 표시
function displayScheduleOptions() {
    if (!scheduleSelect) return;

    scheduleSelect.innerHTML = '<option value="">연습일을 선택하세요</option>' +
        schedules.map(schedule => {
            const date = new Date(schedule.practice_date);
            const dateStr = date.toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                weekday: 'short'
            });
            const memoText = schedule.memo ? ` (${schedule.memo})` : '';
            return `<option value="${schedule.id}">${dateStr}${memoText}</option>`;
        }).join('');
}

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

        members = data || [];
    } catch (error) {
        console.error('단원 목록 로드 오류:', error);
    }
}

// 출석 정보 로드
async function loadAttendance() {
    if (!currentScheduleId) return;

    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    try {
        // 출석 기록 로드
        const { data, error } = await supabase
            .from('age_attendance')
            .select('*')
            .eq('schedule_id', currentScheduleId);

        if (error) throw error;

        attendanceRecords = data || [];
        displayAttendance();
    } catch (error) {
        console.error('출석 정보 로드 오류:', error);
        alert('출석 정보를 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 출석 상태 업데이트
async function updateAttendance(memberId, status) {
    if (!currentScheduleId) return;

    const supabase = await getSupabaseAsync();
    if (!supabase) return;

    try {
        // 기존 기록 확인
        const existing = attendanceRecords.find(r => r.member_id === memberId);

        if (existing) {
            // 업데이트
            const { error } = await supabase
                .from('age_attendance')
                .update({ status })
                .eq('id', existing.id);

            if (error) throw error;
        } else {
            // 새로 생성
            const { error } = await supabase
                .from('age_attendance')
                .insert([{
                    member_id: memberId,
                    schedule_id: currentScheduleId,
                    status
                }]);

            if (error) throw error;
        }

        await loadAttendance();
    } catch (error) {
        console.error('출석 상태 업데이트 오류:', error);
        alert('출석 상태 업데이트 중 오류가 발생했습니다: ' + error.message);
    }
}

// 출석 현황 표시
function displayAttendance() {
    if (!currentScheduleId || members.length === 0) {
        attendanceContainer.innerHTML = '<p class="empty-message">단원이 등록되지 않았습니다.</p>';
        return;
    }

    const filterValue = partFilterAttendance.value;
    const filteredMembers = filterValue 
        ? members.filter(m => m.part === filterValue)
        : members;

    // 파트별로 그룹화
    const membersByPart = {};
    filteredMembers.forEach(member => {
        if (!membersByPart[member.part]) {
            membersByPart[member.part] = [];
        }
        membersByPart[member.part].push(member);
    });

    // 파트 순서 정의
    const partOrder = ['1파트', '2파트', '3파트', '4파트', '5파트', '6파트', '콘트라베이스파트'];

    function getMemberStatus(memberId) {
        const attendance = attendanceRecords.find(r => r.member_id === memberId);
        return attendance ? attendance.status : '미정';
    }

    // 파트별 출석 인원·총 출석 (현재 필터·연습일 기준)
    let totalPresent = 0;
    const partPresentParts = [];
    partOrder.forEach(part => {
        if (!membersByPart[part]) return;
        const cnt = membersByPart[part].filter(m => getMemberStatus(m.id) === '출석').length;
        partPresentParts.push({ part, count: cnt });
        totalPresent += cnt;
    });

    let summaryHtml = `
        <div class="attendance-summary">
            <span class="attendance-summary-label">이번 연습일 출석</span>
            <div class="attendance-summary-parts">
                ${partPresentParts.map(({ part, count }) =>
                    `<span class="attendance-summary-chip">${part} <strong>${count}명</strong></span>`
                ).join('')}
            </div>
            <span class="attendance-summary-total">총 <strong>${totalPresent}명</strong></span>
        </div>
    `;

    let html = summaryHtml;
    partOrder.forEach(part => {
        if (!membersByPart[part]) return;

        html += `
            <div class="part-section">
                <div class="part-title">${part}</div>
                <div class="members-attendance">
                    ${membersByPart[part].map(member => {
                        const status = getMemberStatus(member.id);
                        const statusClass = status === '출석' ? 'present' : status === '불참' ? 'absent' : 'unknown';

                        return `
                            <div class="member-attendance-item ${statusClass}">
                                <span class="member-name">${member.name}${member.nickname ? ` (${member.nickname})` : ''}</span>
                                <div class="member-attendance-btns">
                                    <button type="button" class="btn btn-tiny" style="background:#28a745;color:white;" onclick="window.setAttendance('${member.id}', '출석')">출석</button>
                                    <button type="button" class="btn btn-tiny" style="background:#dc3545;color:white;" onclick="window.setAttendance('${member.id}', '불참')">불참</button>
                                    <button type="button" class="btn btn-tiny" style="background:#ffc107;color:#333;" onclick="window.setAttendance('${member.id}', '미정')">미정</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    attendanceContainer.innerHTML = html || '<p class="empty-message">표시할 단원이 없습니다.</p>';
}

// 전역 함수로 등록
window.setAttendance = async (memberId, status) => {
    await updateAttendance(memberId, status);
};

// 페이지 로드 시 초기화 (단원 로드 후에 기본 연습일 설정 → 출석 조회)
document.addEventListener('DOMContentLoaded', async () => {
    await loadSchedules();
    await loadMembers();
    setDefaultScheduleAndLoad();
});
