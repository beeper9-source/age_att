import { getSupabase } from './app.js';

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
    const supabase = getSupabase();
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
    const supabase = getSupabase();
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

    const supabase = getSupabase();
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

// Google Calendar에 일정 추가
function addToGoogleCalendar(scheduleDate, memberName) {
    // 날짜 문자열을 파싱 (YYYY-MM-DD 형식)
    const [year, month, day] = scheduleDate.split('-').map(Number);
    
    // 오후 4시부터 6시까지 (한국 시간 기준, UTC+9)
    // Google Calendar 링크 형식: YYYYMMDDTHHmmss+0900 (한국 시간대 명시)
    const formatDate = (hours) => {
        const y = String(year);
        const m = String(month).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        const h = String(hours).padStart(2, '0');
        return `${y}${m}${d}T${h}0000+0900`; // 한국 시간대(UTC+9) 명시
    };
    
    const start = formatDate(16); // 오후 4시
    const end = formatDate(18);   // 오후 6시
    
    // Google Calendar 링크 생성
    const title = encodeURIComponent(`알기앙 연습 - ${memberName}`);
    const details = encodeURIComponent('클래식기타 앙상블 연습');
    const location = encodeURIComponent('알기앙 연습장');
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
    
    // 새 창에서 Google Calendar 열기
    window.open(calendarUrl, '_blank');
}

// 출석 상태 업데이트
async function updateAttendance(memberId, status) {
    if (!currentScheduleId) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
        // 기존 기록 확인
        const existing = attendanceRecords.find(r => r.member_id === memberId);
        const previousStatus = existing ? existing.status : null;

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

        // 출석 상태로 변경되었고, 이전 상태가 출석이 아닐 때만 Google Calendar에 추가
        if (status === '출석' && previousStatus !== '출석') {
            // 연습일 정보 가져오기
            const schedule = schedules.find(s => s.id === currentScheduleId);
            if (schedule) {
                // 단원 정보 가져오기
                const member = members.find(m => m.id === memberId);
                if (member) {
                    // Google Calendar에 일정 추가
                    addToGoogleCalendar(schedule.practice_date, member.name);
                }
            }
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

    let html = '';
    partOrder.forEach(part => {
        if (!membersByPart[part]) return;

        html += `
            <div class="part-section">
                <div class="part-title">${part}</div>
                <div class="members-attendance">
                    ${membersByPart[part].map(member => {
                        const attendance = attendanceRecords.find(r => r.member_id === member.id);
                        const status = attendance ? attendance.status : '미정';
                        const statusClass = status === '출석' ? 'present' : status === '불참' ? 'absent' : 'unknown';
                        const statusColor = status === '출석' ? '#28a745' : status === '불참' ? '#dc3545' : '#ffc107';

                        return `
                            <div class="member-attendance-item ${statusClass}">
                                <div class="member-name">${member.name}${member.nickname ? ` (${member.nickname})` : ''}</div>
                                <div class="status-buttons">
                                    <button class="status-btn active" style="background: ${statusColor};" 
                                            onclick="window.updateAttendance('${member.id}', '${status}')" 
                                            title="${status}"></button>
                                </div>
                                <div style="margin-top: 10px;">
                                    <button class="btn btn-small" style="background: #28a745; color: white; margin: 2px;" 
                                            onclick="window.setAttendance('${member.id}', '출석')">출석</button>
                                    <button class="btn btn-small" style="background: #dc3545; color: white; margin: 2px;" 
                                            onclick="window.setAttendance('${member.id}', '불참')">불참</button>
                                    <button class="btn btn-small" style="background: #ffc107; color: white; margin: 2px;" 
                                            onclick="window.setAttendance('${member.id}', '미정')">미정</button>
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

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    await loadSchedules();
    await loadMembers();
});
