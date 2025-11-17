# Reina - 알기앙 출석부 앱

클래식기타 앙상블 '알기앙'을 위한 출석부 관리 시스템입니다.

## 주요 기능

### 1. 단원 관리
- 단원 정보 등록/수정/삭제
- 이름, 닉네임, 파트, 역할 관리
- 파트별 필터링

### 2. 연습일 관리
- 연습일 등록/수정/삭제
- 연습일 자동 생성 (2025-11-22 ~ 2026-12-31, 매주 토요일)
- 연습일 활성화/비활성화
- 연습일별 메모 추가

### 3. 출석 체크
- 신호등 방식 출석 관리 (출석/불참/미정)
- 파트별 정렬 및 조회
- 연습일별 출석 현황 관리

## 설치 및 설정

### 1. Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. `config.js` 파일을 열어 Supabase 프로젝트 정보를 입력합니다:

```javascript
export const SUPABASE_CONFIG = {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key'
};
```

### 2. 데이터베이스 테이블

데이터베이스 테이블은 이미 생성되어 있습니다:
- `AGE_members`: 단원 정보
- `AGE_schedule`: 연습일 정보
- `AGE_attendance`: 출석 정보

### 3. 실행

**⚠️ 중요: 파일을 직접 열면 CORS 오류가 발생합니다. 반드시 웹 서버를 통해 실행해야 합니다.**

#### 방법 1: 제공된 서버 스크립트 사용 (권장)

**Windows:**
```bash
start-server.bat
```

**Mac/Linux:**
```bash
chmod +x start-server.sh
./start-server.sh
```

또는 Python이 설치되어 있다면:
```bash
python server.py
```

#### 방법 2: Python 직접 사용
```bash
python -m http.server 8000
```

#### 방법 3: Node.js 사용
```bash
npx http-server
```

#### 방법 4: VS Code Live Server 확장
VS Code에서 `index.html`을 우클릭하고 "Open with Live Server" 선택

서버 실행 후 브라우저에서 `http://localhost:8000` 접속

## 파일 구조

```
age_att/
├── index.html          # 메인 페이지
├── members.html        # 단원 관리 페이지
├── schedule.html       # 연습일 관리 페이지
├── attendance.html     # 출석 체크 페이지
├── styles.css          # 스타일시트
├── app.js              # Supabase 클라이언트 초기화
├── config.js           # Supabase 설정
├── members.js          # 단원 관리 로직
├── schedule.js         # 연습일 관리 로직
├── attendance.js       # 출석 체크 로직
└── README.md           # 이 파일
```

## 사용 방법

### 단원 관리
1. "단원 관리" 메뉴로 이동
2. "+ 단원 추가" 버튼 클릭
3. 단원 정보 입력 후 저장
4. 파트별 필터로 단원 조회 가능

### 연습일 관리
1. "연습일 관리" 메뉴로 이동
2. "연습일 자동 생성" 버튼으로 일괄 생성
3. 또는 "+ 연습일 추가" 버튼으로 개별 추가
4. 각 연습일에 메모 추가 가능
5. 토글 스위치로 활성화/비활성화

### 출석 체크
1. "출석 체크" 메뉴로 이동
2. 연습일 선택
3. 각 단원의 출석/불참/미정 버튼 클릭
4. 파트별 필터로 특정 파트만 조회 가능

## 기술 스택

- HTML5
- CSS3
- JavaScript (ES6+)
- Supabase (PostgreSQL)

## 라이선스

이 프로젝트는 알기앙 앙상블을 위해 제작되었습니다.
