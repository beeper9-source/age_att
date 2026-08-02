import { getSupabase, getSupabaseAsync, initSupabase } from './app.js';

let members = [];
let schedules = [];
let attendanceRecords = [];

// DOM 요소
const yearSelect = document.getElementById('yearSelect');
const matrixContainer = document.getElementById('matrixContainer');

// 이벤트 리스너
yearSelect?.addEventListener('change', async () => {
    await loadAttendanceMatrix();
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

        // 역할(role)이 '휴식'인 단원은 제외 (단원관리 외 모든 화면에서 숨김)
        members = (data || []).filter(member => member.role !== '휴식');
    } catch (error) {
        console.error('단원 목록 로드 오류:', error);
    }
}

// 출석 매트릭스 로드
async function loadAttendanceMatrix() {
    const selectedYear = yearSelect?.value || new Date().getFullYear();
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    // 로딩 메시지
    if (matrixContainer) {
        matrixContainer.innerHTML = '<div class="loading">출석 매트릭스를 불러오는 중...</div>';
    }

    const supabase = await getSupabaseAsync();
    if (!supabase) {
        if (matrixContainer) {
            matrixContainer.innerHTML = '<div class="loading" style="color: red;">Supabase 연결에 실패했습니다.</div>';
        }
        return;
    }

    try {
        // 해당 연도의 활성화된 연습일 목록 가져오기
        const { data: schedulesData, error: schedulesError } = await supabase
            .from('age_schedule')
            .select('id, practice_date')
            .eq('is_active', true)
            .gte('practice_date', yearStart)
            .lte('practice_date', yearEnd)
            .order('practice_date', { ascending: true });

        if (schedulesError) throw schedulesError;

        schedules = schedulesData || [];

        if (schedules.length === 0) {
            if (matrixContainer) {
                matrixContainer.innerHTML = `<div class="loading">${selectedYear}년에 등록된 활성화된 연습일이 없습니다.</div>`;
            }
            return;
        }

        const scheduleIds = schedules.map(s => s.id);

        // 해당 연도의 모든 출석 기록 가져오기
        const { data: attendanceData, error: attendanceError } = await supabase
            .from('age_attendance')
            .select('member_id, status, schedule_id')
            .in('schedule_id', scheduleIds);

        if (attendanceError) throw attendanceError;

        attendanceRecords = attendanceData || [];

        // 매트릭스 표시
        displayMatrix();
    } catch (error) {
        console.error('출석 매트릭스 로드 오류:', error);
        if (matrixContainer) {
            matrixContainer.innerHTML = `<div class="loading" style="color: red;">출석 매트릭스를 불러오는 중 오류가 발생했습니다: ${error.message}</div>`;
        }
        alert('출석 매트릭스를 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 매트릭스 표시
function displayMatrix() {
    if (!matrixContainer) return;

    // 단원별 통계 계산
    const memberStats = {};
    
    members.forEach(member => {
        const memberRecords = attendanceRecords.filter(r => r.member_id === member.id);
        const present = memberRecords.filter(r => r.status === '출석').length;
        const absent = memberRecords.filter(r => r.status === '불참').length;
        const total = schedules.length;
        const attendanceRate = total > 0 ? (present / total * 100).toFixed(1) : 0;

        memberStats[member.id] = {
            member,
            present,
            absent,
            total,
            attendanceRate: parseFloat(attendanceRate),
            records: {}
        };

        // 각 연습일별 출석 상태 저장
        memberRecords.forEach(record => {
            memberStats[member.id].records[record.schedule_id] = record.status;
        });
    });

    // 파트별로 그룹화
    const membersByPart = {};
    Object.values(memberStats).forEach(stat => {
        const part = stat.member.part;
        if (!membersByPart[part]) {
            membersByPart[part] = [];
        }
        membersByPart[part].push(stat);
    });

    // 파트 순서 정의
    const partOrder = ['1파트', '2파트', '3파트', '4파트', '5파트', '6파트', '콘트라베이스파트'];

    // 테이블 생성
    let html = '<table class="matrix-table">';
    
    // 헤더 행
    html += '<thead><tr>';
    html += '<th>파트</th>';
    html += '<th>이름</th>';
    html += '<th>출석율</th>';
    html += '<th>참석수</th>';
    html += '<th>결석수</th>';
    
    // 각 연습일 헤더
    schedules.forEach(schedule => {
        const date = new Date(schedule.practice_date);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        html += `<th title="${schedule.practice_date}">${month}/${day}</th>`;
    });
    
    html += '</tr></thead><tbody>';

    // 데이터 행
    partOrder.forEach(part => {
        if (!membersByPart[part]) return;

        membersByPart[part].forEach((stat, index) => {
            const rateClass = getRateClass(stat.attendanceRate);
            
            html += '<tr>';
            
            // 파트 (모든 행에 표시하되, 첫 번째 행만 내용 표시)
            if (index === 0) {
                html += `<td rowspan="${membersByPart[part].length}" class="part-header" style="vertical-align: top;">${part}</td>`;
            }
            
            // 이름
            html += `<td>${stat.member.name}${stat.member.nickname ? ` (${stat.member.nickname})` : ''}</td>`;
            
            // 출석율
            html += `<td class="attendance-rate ${rateClass}">${stat.attendanceRate}%</td>`;
            
            // 참석수
            html += `<td style="color: #4CAF50; font-weight: bold;">${stat.present}</td>`;
            
            // 결석수
            html += `<td style="color: #F44336; font-weight: bold;">${stat.absent}</td>`;
            
            // 각 연습일별 출석 상태
            schedules.forEach(schedule => {
                const status = stat.records[schedule.id] || null;
                const cellClass = status === '출석' ? 'cell-present' : 
                                 status === '불참' ? 'cell-absent' : 
                                 status === '미정' ? 'cell-unknown' : 'cell-none';
                const cellText = status === '출석' ? '○' : 
                               status === '불참' ? '×' : 
                               status === '미정' ? '?' : '-';
                
                html += `<td><div class="attendance-cell ${cellClass}" title="${schedule.practice_date}: ${status || '미기록'}">${cellText}</div></td>`;
            });
            
            html += '</tr>';
        });
    });

    html += '</tbody></table>';
    
    matrixContainer.innerHTML = html;
}

// 출석율에 따른 클래스 반환
function getRateClass(rate) {
    if (rate >= 90) return 'rate-excellent';
    if (rate >= 70) return 'rate-good';
    if (rate >= 50) return 'rate-fair';
    return 'rate-poor';
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initSupabase();
        await loadMembers();
        
        // 기본값을 당해년도로 설정
        const currentYear = new Date().getFullYear();
        if (yearSelect) {
            yearSelect.value = currentYear.toString();
        }
        
        await loadAttendanceMatrix();
    } catch (error) {
        console.error('페이지 초기화 오류:', error);
        if (matrixContainer) {
            matrixContainer.innerHTML = '<div class="loading" style="color: red;">페이지 초기화 중 오류가 발생했습니다.</div>';
        }
    }
});

