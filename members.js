import { getSupabase } from './app.js';

let members = [];
let currentEditId = null;

// DOM 요소
const addMemberBtn = document.getElementById('addMemberBtn');
const memberModal = document.getElementById('memberModal');
const memberForm = document.getElementById('memberForm');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');
const partFilter = document.getElementById('partFilter');
const membersList = document.getElementById('membersList');

// 이벤트 리스너
addMemberBtn?.addEventListener('click', () => openModal());
closeBtn?.addEventListener('click', () => closeModal());
cancelBtn?.addEventListener('click', () => closeModal());
partFilter?.addEventListener('change', () => filterMembers());

// 모달 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
    if (e.target === memberModal) {
        closeModal();
    }
});

// 폼 제출
memberForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveMember();
});

// 모달 열기
function openModal(member = null) {
    currentEditId = member ? member.id : null;
    const modalTitle = document.getElementById('modalTitle');
    
    if (member) {
        modalTitle.textContent = '단원 수정';
        document.getElementById('memberId').value = member.id;
        document.getElementById('memberName').value = member.name;
        document.getElementById('memberNickname').value = member.nickname || '';
        document.getElementById('memberPart').value = member.part;
        document.getElementById('memberRole').value = member.role || '';
    } else {
        modalTitle.textContent = '단원 추가';
        memberForm.reset();
        document.getElementById('memberId').value = '';
    }
    
    memberModal.style.display = 'block';
}

// 모달 닫기
function closeModal() {
    memberModal.style.display = 'none';
    currentEditId = null;
    memberForm.reset();
}

// 단원 저장
async function saveMember() {
    const supabase = getSupabase();
    if (!supabase) return;

    const id = document.getElementById('memberId').value;
    const name = document.getElementById('memberName').value;
    const nickname = document.getElementById('memberNickname').value;
    const part = document.getElementById('memberPart').value;
    const role = document.getElementById('memberRole').value;

    const memberData = {
        name,
        nickname: nickname || null,
        part,
        role: role || null
    };

    try {
        if (id) {
            // 수정
            const { error } = await supabase
                .from('age_members')
                .update(memberData)
                .eq('id', id);
            
            if (error) throw error;
        } else {
            // 추가
            const { error } = await supabase
                .from('age_members')
                .insert([memberData]);
            
            if (error) throw error;
        }

        closeModal();
        await loadMembers();
    } catch (error) {
        console.error('단원 저장 오류:', error);
        alert('단원 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 단원 삭제
async function deleteMember(id) {
    if (!confirm('정말 이 단원을 삭제하시겠습니까?')) return;

    // 비밀번호 확인
    const password = prompt('거북코사번을 입력하세요:');
    
    // 취소를 누르면 null이 반환됨
    if (password === null) {
        return; // 사용자가 취소를 눌렀으므로 그냥 종료
    }
    
    // 비밀번호가 일치하지 않으면 삭제 취소
    if (password !== '22331') {
        alert('비밀번호가 일치하지 않습니다. 삭제가 취소되었습니다.');
        return;
    }

    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('age_members')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await loadMembers();
    } catch (error) {
        console.error('단원 삭제 오류:', error);
        alert('단원 삭제 중 오류가 발생했습니다: ' + error.message);
    }
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
        displayMembers();
    } catch (error) {
        console.error('단원 목록 로드 오류:', error);
        alert('단원 목록을 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 단원 목록 표시
function displayMembers() {
    const filterValue = partFilter.value;
    const filteredMembers = filterValue 
        ? members.filter(m => m.part === filterValue)
        : members;

    if (filteredMembers.length === 0) {
        membersList.innerHTML = '<p class="empty-message">등록된 단원이 없습니다.</p>';
        return;
    }

    membersList.innerHTML = filteredMembers.map(member => `
        <div class="member-card">
            <h3>${member.name}${member.nickname ? ` (${member.nickname})` : ''}</h3>
            <div class="member-info">
                <p><strong>파트:</strong> <span class="badge badge-part">${member.part}</span></p>
                ${member.role ? `<p><strong>역할:</strong> <span class="badge badge-role">${member.role}</span></p>` : ''}
            </div>
            <div class="member-actions">
                <button class="btn btn-primary btn-small" onclick="window.editMember('${member.id}')">수정</button>
                <button class="btn btn-danger btn-small" onclick="window.deleteMember('${member.id}')">삭제</button>
            </div>
        </div>
    `).join('');
}

// 필터링
function filterMembers() {
    displayMembers();
}

// 전역 함수로 등록 (HTML에서 호출하기 위해)
window.editMember = (id) => {
    const member = members.find(m => m.id === id);
    if (member) openModal(member);
};

window.deleteMember = deleteMember;

// 페이지 로드 시 단원 목록 로드
document.addEventListener('DOMContentLoaded', () => {
    loadMembers();
});
