import { getSupabase, getSupabaseAsync, initSupabase } from './app.js';

let members = [];
let attendanceStats = {};

// DOM 요소
const yearSelect = document.getElementById('yearSelect');
const statsTableBody = document.getElementById('statsTableBody');
const statsSummary = document.getElementById('statsSummary');

// 이벤트 리스너
yearSelect?.addEventListener('change', async () => {
    await loadAttendanceStats();
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

// 출석 통계 로드
async function loadAttendanceStats() {
    const selectedYear = yearSelect?.value || new Date().getFullYear();
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    // 로딩 메시지
    if (statsTableBody) {
        statsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">통계를 불러오는 중...</td></tr>';
    }

    const supabase = await getSupabaseAsync();
    if (!supabase) {
        if (statsTableBody) {
            statsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: red;">Supabase 연결에 실패했습니다.</td></tr>';
        }
        return;
    }

    try {
        // 해당 연도의 활성화된 연습일 목록 가져오기
        const { data: schedules, error: schedulesError } = await supabase
            .from('age_schedule')
            .select('id, practice_date')
            .eq('is_active', true)
            .gte('practice_date', yearStart)
            .lte('practice_date', yearEnd)
            .order('practice_date', { ascending: true });

        if (schedulesError) throw schedulesError;

        const totalSchedules = schedules?.length || 0;
        const scheduleIds = schedules?.map(s => s.id) || [];

        if (scheduleIds.length === 0) {
            if (statsTableBody) {
                statsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">${selectedYear}년에 등록된 연습일이 없습니다.</td></tr>`;
            }
            if (statsSummary) {
                statsSummary.innerHTML = '';
            }
            return;
        }

        // 해당 연도의 모든 출석 기록 가져오기
        const { data: attendanceRecords, error: attendanceError } = await supabase
            .from('age_attendance')
            .select('member_id, status, schedule_id')
            .in('schedule_id', scheduleIds);

        if (attendanceError) throw attendanceError;

        // 단원별 통계 계산
        attendanceStats = {};
        
        // 모든 단원 초기화
        members.forEach(member => {
            attendanceStats[member.id] = {
                memberId: member.id,
                memberName: member.name,
                memberNickname: member.nickname,
                memberPart: member.part,
                present: 0,
                absent: 0,
                unknown: 0,
                total: totalSchedules
            };
        });

        // 출석 기록 집계
        if (attendanceRecords) {
            attendanceRecords.forEach(record => {
                const memberId = record.member_id;
                if (attendanceStats[memberId]) {
                    if (record.status === '출석') {
                        attendanceStats[memberId].present++;
                    } else if (record.status === '불참') {
                        attendanceStats[memberId].absent++;
                    } else if (record.status === '미정') {
                        attendanceStats[memberId].unknown++;
                    }
                }
            });
        }

        // 통계 표시
        displayStats(totalSchedules);
    } catch (error) {
        console.error('출석 통계 로드 오류:', error);
        if (statsTableBody) {
            statsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: red;">통계를 불러오는 중 오류가 발생했습니다: ${error.message}</td></tr>`;
        }
        alert('출석 통계를 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 통계 표시
function displayStats(totalSchedules) {
    // 통계 요약 표시
    displaySummary(totalSchedules);

    // 테이블 데이터 준비
    const statsArray = Object.values(attendanceStats)
        .map(stat => {
            const attendanceRate = stat.total > 0 
                ? (stat.present / stat.total * 100).toFixed(1) 
                : 0;
            
            return {
                ...stat,
                attendanceRate: parseFloat(attendanceRate)
            };
        })
        .sort((a, b) => {
            // 출석율 내림차순, 같으면 출석 횟수 내림차순
            if (b.attendanceRate !== a.attendanceRate) {
                return b.attendanceRate - a.attendanceRate;
            }
            return b.present - a.present;
        });

    // 테이블 생성
    if (!statsTableBody) return;

    if (statsArray.length === 0) {
        statsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">등록된 단원이 없습니다.</td></tr>';
        return;
    }

    statsTableBody.innerHTML = statsArray.map((stat, index) => {
        const rateClass = getRateClass(stat.attendanceRate);
        const progressClass = getProgressClass(stat.attendanceRate);
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${stat.memberName}${stat.memberNickname ? ` (${stat.memberNickname})` : ''}</td>
                <td>${stat.memberPart}</td>
                <td style="color: #4CAF50; font-weight: bold;">${stat.present}</td>
                <td style="color: #F44336;">${stat.absent}</td>
                <td style="color: #FFC107;">${stat.unknown}</td>
                <td>${stat.total}</td>
                <td>
                    <span class="attendance-rate ${rateClass}">${stat.attendanceRate}%</span>
                    <div class="progress-bar-container">
                        <div class="progress-bar ${progressClass}" style="width: ${stat.attendanceRate}%"></div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// 통계 요약 표시
function displaySummary(totalSchedules) {
    if (!statsSummary) return;

    const statsArray = Object.values(attendanceStats);
    
    const totalMembers = statsArray.length;
    const totalPresent = statsArray.reduce((sum, stat) => sum + stat.present, 0);
    const totalAbsent = statsArray.reduce((sum, stat) => sum + stat.absent, 0);
    const avgRate = totalMembers > 0 && totalSchedules > 0
        ? (totalPresent / (totalMembers * totalSchedules) * 100).toFixed(1)
        : 0;

    statsSummary.innerHTML = `
        <div class="summary-card">
            <h3>전체 연습일</h3>
            <div class="value">${totalSchedules}</div>
        </div>
        <div class="summary-card">
            <h3>전체 단원 수</h3>
            <div class="value">${totalMembers}</div>
        </div>
        <div class="summary-card">
            <h3>전체 출석 횟수</h3>
            <div class="value">${totalPresent}</div>
        </div>
        <div class="summary-card">
            <h3>평균 출석율</h3>
            <div class="value">${avgRate}%</div>
        </div>
    `;
}

// 출석율에 따른 클래스 반환
function getRateClass(rate) {
    if (rate >= 90) return 'rate-excellent';
    if (rate >= 70) return 'rate-good';
    if (rate >= 50) return 'rate-fair';
    return 'rate-poor';
}

// 진행 바 클래스 반환
function getProgressClass(rate) {
    if (rate >= 90) return 'progress-excellent';
    if (rate >= 70) return 'progress-good';
    if (rate >= 50) return 'progress-fair';
    return 'progress-poor';
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
        
        await loadAttendanceStats();
    } catch (error) {
        console.error('페이지 초기화 오류:', error);
        if (statsTableBody) {
            statsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: red;">페이지 초기화 중 오류가 발생했습니다.</td></tr>';
        }
    }
});

