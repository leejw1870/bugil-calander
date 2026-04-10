/* ================================
   BUGIL - Main Application
   Firebase 기반 (계정별 데이터 동기화)
   ================================ */

function handleLogout() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    });
}

// ========================
// 전역 상태
// ========================
let currentPage = 'dashboard';
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let selectedDate = null;
let currentFilter = 'all';
let searchQuery = '';
let pendingDeleteId = null;
let customSelectedDates = [];

// 카테고리 정보
const CATEGORIES = {
    class:      { label: '수업',  emoji: '📚', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
    exam:       { label: '시험',  emoji: '📝', color: '#f87171', bg: 'rgba(239,68,68,0.15)' },
    assignment: { label: '과제',  emoji: '📋', color: '#fb923c', bg: 'rgba(249,115,22,0.15)' },
    study:      { label: '자습',  emoji: '📖', color: '#4ade80', bg: 'rgba(34,197,94,0.15)' },
    other:      { label: '기타',  emoji: '🎯', color: '#c084fc', bg: 'rgba(168,85,247,0.15)' },
};

// ========================
// localStorage CRUD
// ========================
// Firebase 캐시 (메모리)
let schedulesCache = [];
let recordsCache = [];
let currentUid = null;

function loadSchedules() {
    return schedulesCache;
}

function saveSchedules(schedules) {
    schedulesCache = schedules;
    if (currentUid) {
        db.collection('users').doc(currentUid).collection('data').doc('schedules')
            .set({ items: schedules })
            .catch(e => console.error('Schedule save error:', e));
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addSchedule(data) {
    const schedules = loadSchedules();
    const newItem = { ...data, id: generateId(), completed: false };
    schedules.push(newItem);
    saveSchedules(schedules);
    return newItem;
}

function updateSchedule(id, data) {
    const schedules = loadSchedules();
    const idx = schedules.findIndex(s => s.id === id);
    if (idx === -1) return null;
    schedules[idx] = { ...schedules[idx], ...data };
    saveSchedules(schedules);
    return schedules[idx];
}

function deleteScheduleById(id) {
    const schedules = loadSchedules().filter(s => s.id !== id);
    saveSchedules(schedules);
}

// ========================
// 샘플 데이터
// ========================
async function initSampleData() {
    const metaDoc = await db.collection('users').doc(currentUid).collection('data').doc('meta').get();
    if (metaDoc.exists) return;

    const today = new Date();
    const fmt = (d) => {
        const t = new Date(today);
        t.setDate(today.getDate() + d);
        return formatDate(t);
    };

    const samples = [
        { title: '수학 중간고사', date: fmt(7),  start_time: '09:00', end_time: '11:00', category: 'exam',       priority: 'high',   is_dday: true,  description: '3단원까지 범위', completed: false },
        { title: '영어 단어 암기', date: fmt(1),  start_time: '20:00', end_time: '21:00', category: 'study',      priority: 'medium', is_dday: false, description: 'DAY 51~60', completed: false },
        { title: '국어 수행평가', date: fmt(3),  start_time: '14:00', end_time: '',       category: 'assignment', priority: 'high',   is_dday: true,  description: '시 분석 발표 준비', completed: false },
        { title: '수학 개념 복습', date: fmt(0),  start_time: '18:00', end_time: '20:00', category: 'study',      priority: 'medium', is_dday: false, description: '미적분 파트', completed: false },
        { title: '물리학 수업',    date: fmt(0),  start_time: '10:00', end_time: '11:50', category: 'class',      priority: 'low',    is_dday: false, description: '파동 단원', completed: true  },
        { title: '화학 실험 보고서', date: fmt(2), start_time: '',      end_time: '',      category: 'assignment', priority: 'high',   is_dday: false, description: '산화환원 반응 실험', completed: false },
        { title: '수능 모의고사',   date: fmt(14), start_time: '08:40', end_time: '17:05', category: 'exam',      priority: 'high',   is_dday: true,  description: '전국연합 학력평가', completed: false },
        { title: '자습 (수학)',     date: fmt(-1), start_time: '21:00', end_time: '22:30', category: 'study',     priority: 'low',    is_dday: false, description: '', completed: true  },
    ];

    const schedules = samples.map(s => ({ ...s, id: generateId() }));
    schedulesCache = schedules;
    await db.collection('users').doc(currentUid).collection('data').doc('schedules').set({ items: schedules });
    await db.collection('users').doc(currentUid).collection('data').doc('meta').set({ initialized: true });
}

// ========================
// 초기화
// ========================
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        currentUid = user.uid;

        // Firestore에서 데이터 로드
        try {
            const schedulesDoc = await db.collection('users').doc(currentUid)
                .collection('data').doc('schedules').get();
            schedulesCache = schedulesDoc.exists ? (schedulesDoc.data().items || []) : [];

            const recordsDoc = await db.collection('users').doc(currentUid)
                .collection('data').doc('records').get();
            recordsCache = recordsDoc.exists
                ? (recordsDoc.data().items || JSON.parse(JSON.stringify(DEFAULT_RECORDS)))
                : JSON.parse(JSON.stringify(DEFAULT_RECORDS));
        } catch (e) {
            console.error('데이터 로드 실패:', e);
            schedulesCache = [];
            recordsCache = JSON.parse(JSON.stringify(DEFAULT_RECORDS));
        }

        await initSampleData();
        initRecord();
        initToday();
        navigate('dashboard');
        initFormListeners();
        initRepeatListeners();
        initSearch();
        initCalendarNav();

        // 사용자 이메일 표시
        const emailEl = document.getElementById('user-email');
        if (emailEl) emailEl.textContent = user.email;
    });
});

function initToday() {
    const today = new Date();
    const dayNames = ['일','월','화','수','목','금','토'];
    const formatted = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일 (${dayNames[today.getDay()]})`;
    const el = document.getElementById('sidebar-today');
    if (el) el.textContent = formatted;

    // 한국 시간 실시간 시계
    function tickClock() {
        const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const h = String(kst.getHours()).padStart(2, '0');
        const m = String(kst.getMinutes()).padStart(2, '0');
        const s = String(kst.getSeconds()).padStart(2, '0');
        const clockEl = document.getElementById('sidebar-clock');
        if (clockEl) clockEl.textContent = `${h}:${m}:${s}`;
    }
    tickClock();
    setInterval(tickClock, 1000);
}

// ========================
// 위젯 열기 (같은 브라우저 → localStorage 공유)
// ========================
function openWidget() {
    const w = 350, h = 430;
    const left = window.screen.width  - w - 20;
    const top  = window.screen.height - h - 60;
    window.open(
        'popup.html',
        'bugil-widget',
        `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
    );
}

// ========================
// 네비게이션
// ========================
function navigate(page) {
    currentPage = page;

    document.querySelectorAll('.page-view').forEach(v => v.classList.add('hidden'));
    const view = document.getElementById(`view-${page}`);
    if (view) {
        view.classList.remove('hidden');
        view.style.animation = 'none';
        view.offsetHeight;
        view.style.animation = '';
    }

    document.querySelectorAll('.nav-item').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.page === page));
    document.querySelectorAll('.mobile-nav-item').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.page === page));

    if (page === 'record') renderRecordList();

    const titles = {
        dashboard: ['Dashboard',  "Check today's schedule"],
        calendar:  ['Calendar',   'View your monthly schedule'],
        schedules: ['Schedule',   'Manage all your schedules'],
        record:    ['Records',    'Write and manage your student record'],
    };
    const [title, subtitle] = titles[page] || ['', ''];
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-subtitle').textContent = subtitle;

    if (page === 'dashboard') renderDashboard();
    if (page === 'calendar')  renderCalendar();
    if (page === 'schedules') renderScheduleList();

    updateSidebarStats();
}

// ========================
// 사이드바 통계
// ========================
function updateSidebarStats() {
    const schedules = loadSchedules();
    const total = schedules.length;
    const done  = schedules.filter(s => s.completed).length;
    const elTotal = document.getElementById('stat-total');
    const elDone  = document.getElementById('stat-done');
    if (elTotal) elTotal.textContent = total;
    if (elDone)  elDone.textContent  = done;
}

// ========================
// 대시보드
// ========================
function renderDashboard() {
    const schedules = loadSchedules();
    const todayStr  = formatDate(new Date());

    // 오늘의 일정
    const todaySchedules = schedules
        .filter(s => s.date === todayStr)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    const todayContainer = document.getElementById('today-schedules');
    const todayCount     = document.getElementById('today-count');
    todayCount.textContent = `${todaySchedules.length}개`;

    if (todaySchedules.length === 0) {
        todayContainer.innerHTML = `
            <div class="text-center py-8 text-gray-300">
                <i class="fas fa-calendar-check text-4xl mb-3"></i>
                <p class="text-sm">오늘 등록된 일정이 없습니다</p>
                <button onclick="openAddModalWithDate('${todayStr}')" class="mt-3 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 transition-colors">
                    <i class="fas fa-plus mr-1"></i> 일정 추가
                </button>
            </div>`;
    } else {
        todayContainer.innerHTML = todaySchedules.map(s => renderScheduleCard(s)).join('');
    }

    // D-Day
    const ddayItems = schedules
        .filter(s => s.is_dday && s.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date));

    const ddayContainer = document.getElementById('dday-widget');
    if (ddayItems.length === 0) {
        ddayContainer.innerHTML = `
            <div class="text-center py-6 text-primary-200">
                <i class="fas fa-hourglass-half text-3xl mb-2"></i>
                <p class="text-sm">등록된 D-Day가 없습니다</p>
                <p class="text-xs mt-1 opacity-70">일정 추가 시 D-Day로 설정하세요</p>
            </div>`;
    } else {
        ddayContainer.innerHTML = ddayItems.slice(0, 4).map(s => {
            const daysLeft = getDaysLeft(s.date);
            const cat = CATEGORIES[s.category] || CATEGORIES.other;
            const label = daysLeft === 0 ? 'D-Day!' : `D-${daysLeft}`;
            return `
                <div class="dday-item">
                    <div class="flex items-center justify-between gap-2">
                        <div class="min-w-0">
                            <p class="text-xs text-primary-200">${cat.emoji} ${cat.label}</p>
                            <p class="font-bold text-sm truncate mt-0.5">${escHtml(s.title)}</p>
                            <p class="text-xs text-primary-200 mt-0.5">${s.date}</p>
                        </div>
                        <div class="dday-number shrink-0 ${daysLeft === 0 ? 'text-yellow-300' : ''}">${label}</div>
                    </div>
                </div>`;
        }).join('');
    }

    // 카테고리 통계
    renderCategoryStats(schedules);

    // 이번 주 미리보기
    renderWeekPreview(schedules);
}

function renderCategoryStats(schedules) {
    const container = document.getElementById('category-stats');
    const total = schedules.length || 1;
    let html = '';

    Object.entries(CATEGORIES).forEach(([key, cat]) => {
        const count = schedules.filter(s => s.category === key).length;
        const pct   = Math.round((count / total) * 100);
        html += `
            <div>
                <div class="flex items-center justify-between text-xs mb-1">
                    <span class="font-medium text-gray-200">${cat.emoji} ${cat.label}</span>
                    <span class="text-gray-400">${count}개</span>
                </div>
                <div class="progress-bar-track">
                    <div class="stat-bar" style="width:${pct}%;background-color:${cat.color}"></div>
                </div>
            </div>`;
    });

    // 완료율
    const done = schedules.filter(s => s.completed).length;
    const donePct = schedules.length ? Math.round((done / schedules.length) * 100) : 0;
    html += `
        <div class="mt-2 pt-3 border-t border-gray-100">
            <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-medium text-gray-200">✅ 완료율</span>
                <span class="text-gray-400">${donePct}%</span>
            </div>
            <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${donePct}%"></div>
            </div>
        </div>`;

    container.innerHTML = html;
}

function renderWeekPreview(schedules) {
    const container = document.getElementById('week-preview');
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);

    const dayNames = ['일','월','화','수','목','금','토'];
    let html = '';

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDate(d);
        const isToday = dateStr === formatDate(today);
        const daySchedules = schedules
            .filter(s => s.date === dateStr)
            .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

        html += `
            <div class="week-day-col ${isToday ? 'today' : ''}">
                <div class="text-xs font-semibold ${i===0?'text-red-400':i===6?'text-blue-400':'text-gray-300'}">${dayNames[i]}</div>
                <div class="text-sm font-bold mt-1 ${isToday?'text-orange-400':'text-white'}">${d.getDate()}</div>
                <div class="mt-2 space-y-0.5">
                    ${daySchedules.slice(0,3).map(s => {
                        const cat = CATEGORIES[s.category] || CATEGORIES.other;
                        return `<div class="text-[9px] md:text-[10px] truncate px-1 py-0.5 rounded" style="background-color:${cat.bg};color:${cat.color}">${escHtml(s.title)}</div>`;
                    }).join('')}
                    ${daySchedules.length > 3 ? `<div class="text-[9px] text-gray-400">+${daySchedules.length-3}</div>` : ''}
                    ${daySchedules.length === 0 ? '<div class="text-[9px] text-gray-300 mt-1">-</div>' : ''}
                </div>
            </div>`;
    }

    container.innerHTML = html;
}

// ========================
// 캘린더
// ========================
function initCalendarNav() {
    document.getElementById('cal-prev').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 1) { currentMonth = 12; currentYear--; }
        renderCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 12) { currentMonth = 1; currentYear++; }
        renderCalendar();
    });
}

function goToToday() {
    const today = new Date();
    currentYear  = today.getFullYear();
    currentMonth = today.getMonth() + 1;
    renderCalendar();
}

function renderCalendar() {
    const grid  = document.getElementById('cal-grid');
    const title = document.getElementById('cal-title');
    title.textContent = `${currentYear}년 ${currentMonth}월`;

    const firstDay      = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth   = new Date(currentYear, currentMonth, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    const todayStr      = formatDate(new Date());
    const schedules     = loadSchedules();

    let html = '';
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
        let day, month, year, isOtherMonth = false;

        if (i < firstDay) {
            day = prevMonthDays - firstDay + i + 1;
            month = currentMonth - 1; year = currentYear;
            if (month < 1) { month = 12; year--; }
            isOtherMonth = true;
        } else if (i >= firstDay + daysInMonth) {
            day = i - firstDay - daysInMonth + 1;
            month = currentMonth + 1; year = currentYear;
            if (month > 12) { month = 1; year++; }
            isOtherMonth = true;
        } else {
            day = i - firstDay + 1; month = currentMonth; year = currentYear;
        }

        const dateStr   = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const dayOfWeek = new Date(year, month - 1, day).getDay();
        const isToday   = dateStr === todayStr;
        const isSelected = dateStr === selectedDate;
        const daySchedules = schedules.filter(s => s.date === dateStr);

        let classes = ['cal-cell'];
        if (isOtherMonth) classes.push('other-month');
        if (isToday)      classes.push('today');
        if (isSelected)   classes.push('selected');
        if (dayOfWeek === 0) classes.push('sunday');
        if (dayOfWeek === 6) classes.push('saturday');

        html += `<div class="${classes.join(' ')}" onclick="selectDate('${dateStr}')">`;
        html += `<div class="cal-date">${day}</div>`;

        if (daySchedules.length > 0) {
            // 모바일: 점(dot) + 개수
            html += '<div class="flex gap-0.5 mt-1 flex-wrap items-center md:hidden">';
            daySchedules.slice(0, 4).forEach(s => {
                const cat = CATEGORIES[s.category] || CATEGORIES.other;
                html += `<span class="cal-dot" style="background-color:${cat.color}"></span>`;
            });
            if (daySchedules.length > 4) html += `<span class="text-[9px] text-white font-bold ml-0.5">+${daySchedules.length-4}</span>`;
            html += '</div>';

            // PC: 제목 라벨 (최대 3개)
            html += '<div class="hidden md:block mt-1 space-y-0.5">';
            daySchedules.slice(0, 3).forEach(s => {
                const cat = CATEGORIES[s.category] || CATEGORIES.other;
                html += `<div class="text-[10px] truncate px-1 py-0.5 rounded font-medium" style="background-color:${cat.bg};color:${cat.color}">${cat.emoji} ${escHtml(s.title)}</div>`;
            });
            if (daySchedules.length > 3) {
                html += `<div class="text-[9px] text-gray-400 pl-1">+${daySchedules.length-3}개 더</div>`;
            }
            html += '</div>';
        }

        html += '</div>';
    }

    grid.innerHTML = html;
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    showDayDetail(dateStr);
}

function showDayDetail(dateStr) {
    const container = document.getElementById('cal-day-detail');
    const titleEl   = document.getElementById('cal-day-title');
    const listEl    = document.getElementById('cal-day-schedules');
    const addBtn    = document.getElementById('cal-add-btn');

    const date = new Date(dateStr + 'T00:00:00');
    const dayNames = ['일','월','화','수','목','금','토'];
    titleEl.textContent = `📅 ${date.getFullYear()}년 ${date.getMonth()+1}월 ${date.getDate()}일 (${dayNames[date.getDay()]})`;

    addBtn.onclick = () => openAddModalWithDate(dateStr);

    const schedules = loadSchedules();
    const daySchedules = schedules
        .filter(s => s.date === dateStr)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    if (daySchedules.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-6 text-gray-300">
                <i class="fas fa-calendar-day text-3xl mb-2"></i>
                <p class="text-sm">이 날의 일정이 없습니다</p>
            </div>`;
    } else {
        listEl.innerHTML = daySchedules.map(s => renderScheduleCard(s)).join('');
    }

    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ========================
// 일정 목록
// ========================
function renderScheduleList() {
    const schedules = loadSchedules();
    const container = document.getElementById('schedule-list');

    let filtered = schedules;
    if (currentFilter === 'completed') {
        filtered = schedules.filter(s => s.completed);
    } else if (currentFilter !== 'all') {
        filtered = schedules.filter(s => s.category === currentFilter && !s.completed);
    }

    // 검색 적용
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(s =>
            s.title.toLowerCase().includes(q) ||
            (s.description || '').toLowerCase().includes(q)
        );
    }

    filtered.sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || ''));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-300">
                <i class="fas fa-clipboard-list text-5xl mb-3"></i>
                <p class="text-sm">${searchQuery ? `"${escHtml(searchQuery)}" 검색 결과가 없습니다` : '등록된 일정이 없습니다'}</p>
                ${!searchQuery ? `<button onclick="openAddModal()" class="mt-4 px-6 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors"><i class="fas fa-plus mr-1"></i> 일정 추가하기</button>` : ''}
            </div>`;
        return;
    }

    // 날짜별 그룹핑
    const grouped = {};
    filtered.forEach(s => {
        if (!grouped[s.date]) grouped[s.date] = [];
        grouped[s.date].push(s);
    });

    const todayStr = formatDate(new Date());
    let html = '';
    Object.keys(grouped).sort().forEach(date => {
        const d = new Date(date + 'T00:00:00');
        const dayNames = ['일','월','화','수','목','금','토'];
        const dateLabel = `${d.getMonth()+1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
        const isToday = date === todayStr;
        const isPast  = date < todayStr;

        html += `
            <div class="mb-5">
                <div class="flex items-center gap-2 mb-2">
                    <h4 class="text-sm font-bold ${isToday ? 'text-orange-400' : isPast ? 'text-gray-500' : 'text-gray-200'}">
                        ${isToday ? '📌 오늘 — ' : ''}${dateLabel}
                    </h4>
                    ${isToday ? '<span class="text-[10px] bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full font-medium">TODAY</span>' : ''}
                </div>
                <div class="space-y-2">
                    ${grouped[date].map(s => renderScheduleCard(s, searchQuery)).join('')}
                </div>
            </div>`;
    });

    container.innerHTML = html;
}

function filterCategory(cat) {
    currentFilter = cat;
    searchQuery   = '';
    const mobileInput = document.getElementById('mobile-search-input');
    if (mobileInput) mobileInput.value = '';

    document.querySelectorAll('.filter-btn').forEach(btn => {
        const isActive = btn.dataset.filter === cat;
        btn.classList.toggle('active', isActive);
        if (!isActive) {
            btn.classList.add('bg-gray-100', 'text-gray-600');
            btn.classList.remove('bg-primary-500', 'text-white');
        } else {
            btn.classList.remove('bg-gray-100', 'text-gray-600');
            btn.classList.add('bg-primary-500', 'text-white');
        }
    });

    renderScheduleList();
}

// ========================
// 스케줄 카드
// ========================
function renderScheduleCard(schedule, highlight = '') {
    const cat     = CATEGORIES[schedule.category] || CATEGORIES.other;
    const timeStr = schedule.start_time
        ? (schedule.end_time ? `${schedule.start_time} ~ ${schedule.end_time}` : schedule.start_time)
        : '';

    const title = highlight
        ? highlightText(escHtml(schedule.title), highlight)
        : escHtml(schedule.title);
    const desc = highlight && schedule.description
        ? highlightText(escHtml(schedule.description), highlight)
        : (schedule.description ? escHtml(schedule.description) : '');

    return `
        <div class="schedule-card ${schedule.completed ? 'completed' : ''}" onclick="openEditModal('${schedule.id}')">
            <div class="cat-bar ${schedule.category}"></div>
            <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-sm">${cat.emoji}</span>
                            <span class="schedule-title text-sm font-semibold text-gray-100">${title}</span>
                            ${schedule.priority === 'high' ? '<span class="priority-badge high">⭐ 높음</span>' : ''}
                            ${schedule.is_dday ? '<span class="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-medium">D-Day</span>' : ''}
                        </div>
                        ${timeStr ? `<p class="text-xs text-gray-400 mt-1"><i class="far fa-clock mr-1"></i>${timeStr}</p>` : ''}
                        ${desc ? `<p class="text-xs text-gray-400 mt-1 truncate">${desc}</p>` : ''}
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <button onclick="event.stopPropagation(); toggleComplete('${schedule.id}', ${!schedule.completed})"
                            class="w-7 h-7 rounded-lg ${schedule.completed ? 'bg-green-100 text-green-500' : 'bg-gray-50 text-gray-300 hover:text-green-400'} flex items-center justify-center transition-colors"
                            title="${schedule.completed ? '미완료로 변경' : '완료 처리'}">
                            <i class="fas fa-check text-xs"></i>
                        </button>
                        <button onclick="event.stopPropagation(); confirmDelete('${schedule.id}')"
                            class="w-7 h-7 rounded-lg bg-gray-50 text-gray-300 hover:text-red-400 flex items-center justify-center transition-colors"
                            title="삭제">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
}

// ========================
// 모달
// ========================
function openAddModal() {
    document.getElementById('form-id').value = '';
    document.getElementById('schedule-form').reset();
    document.getElementById('modal-title').textContent = '일정 추가';
    document.getElementById('modal-submit-text').textContent = '저장';
    document.getElementById('form-date').value = formatDate(new Date());
    document.querySelector('input[name="category"][value="class"]').checked = true;
    document.querySelector('input[name="priority"][value="medium"]').checked = true;
    // 반복 섹션 초기화
    resetRepeatSection();
    document.getElementById('repeat-section').classList.remove('hidden');
    showModal();
}

function resetRepeatSection() {
    customSelectedDates = [];
    document.getElementById('form-repeat').checked = false;
    document.getElementById('repeat-options').classList.add('hidden');
    document.querySelector('input[name="repeat_type"][value="daily"]').checked = true;
    document.getElementById('repeat-end-section').classList.remove('hidden');
    document.getElementById('repeat-days-section').classList.add('hidden');
    document.getElementById('repeat-custom-section').classList.add('hidden');
    document.getElementById('form-repeat-end').value = '';
    document.getElementById('repeat-preview').classList.add('hidden');
    document.getElementById('repeat-preview').textContent = '';
    document.getElementById('custom-dates-container').innerHTML = '';
    document.querySelectorAll('.day-cb').forEach(cb => cb.checked = false);
}

function openAddModalWithDate(dateStr) {
    openAddModal();
    document.getElementById('form-date').value = dateStr;
}

function openEditModal(id) {
    const schedules = loadSchedules();
    const s = schedules.find(s => s.id === id);
    if (!s) return;

    document.getElementById('form-id').value = s.id;
    document.getElementById('form-title').value = s.title;
    document.getElementById('form-date').value = s.date;
    document.getElementById('form-start-time').value = s.start_time || '';
    document.getElementById('form-end-time').value   = s.end_time   || '';
    document.getElementById('form-description').value = s.description || '';
    document.getElementById('form-dday').checked = s.is_dday || false;

    const catR = document.querySelector(`input[name="category"][value="${s.category}"]`);
    if (catR) catR.checked = true;
    const priR = document.querySelector(`input[name="priority"][value="${s.priority || 'medium'}"]`);
    if (priR) priR.checked = true;

    document.getElementById('modal-title').textContent = '일정 수정';
    document.getElementById('modal-submit-text').textContent = '수정';
    // 수정 시 반복 섹션 숨김
    document.getElementById('repeat-section').classList.add('hidden');
    showModal();
}

function showModal() {
    const modal = document.getElementById('add-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('form-title').focus(), 100);
}

function closeAddModal() {
    const modal = document.getElementById('add-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

document.getElementById('add-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAddModal();
});

// 삭제 확인 모달
function confirmDelete(id) {
    pendingDeleteId = id;
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeConfirmModal() {
    pendingDeleteId = null;
    const modal = document.getElementById('confirm-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    if (!pendingDeleteId) return;
    deleteScheduleById(pendingDeleteId);
    closeConfirmModal();
    showToast('🗑️ 일정이 삭제되었습니다');
    refreshCurrentView();
    updateSidebarStats();
});

document.getElementById('confirm-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeConfirmModal();
});

// ========================
// 폼 제출
// ========================
function initFormListeners() {
    document.getElementById('schedule-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const id = document.getElementById('form-id').value;
        const data = {
            title:       document.getElementById('form-title').value.trim(),
            date:        document.getElementById('form-date').value,
            start_time:  document.getElementById('form-start-time').value || '',
            end_time:    document.getElementById('form-end-time').value   || '',
            category:    document.querySelector('input[name="category"]:checked').value,
            priority:    document.querySelector('input[name="priority"]:checked').value,
            is_dday:     document.getElementById('form-dday').checked,
            description: document.getElementById('form-description').value.trim(),
        };

        if (!data.title) { showToast('❗ 제목을 입력해주세요'); return; }
        if (!data.date)  { showToast('❗ 날짜를 선택해주세요'); return; }

        const isRepeat = !id && document.getElementById('form-repeat').checked;

        if (isRepeat) {
            const { dates, error } = getRepeatDates();
            if (error) { showToast(`❗ ${error}`); return; }
            if (dates.length > 100) { showToast('❗ 최대 100개까지 추가 가능합니다'); return; }
            dates.forEach(date => addSchedule({ ...data, date }));
            showToast(`✅ ${dates.length}개 날짜에 일정이 추가되었습니다`);
        } else if (id) {
            updateSchedule(id, data);
            showToast('✅ 일정이 수정되었습니다');
        } else {
            addSchedule(data);
            showToast('✅ 일정이 추가되었습니다');
        }

        closeAddModal();
        refreshCurrentView();
        updateSidebarStats();
    });
}

// ========================
// 반복 일정
// ========================
function toggleRepeat() {
    const cb = document.getElementById('form-repeat');
    // onclick으로 두 번 호출되는 것 방지
    const opts = document.getElementById('repeat-options');
    opts.classList.toggle('hidden', !cb.checked);
    if (cb.checked) updateRepeatPreview();
}

function initRepeatListeners() {
    document.querySelectorAll('input[name="repeat_type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const type = e.target.value;
            document.getElementById('repeat-days-section').classList.toggle('hidden', type !== 'weekly');
            document.getElementById('repeat-end-section').classList.toggle('hidden', type === 'custom');
            document.getElementById('repeat-custom-section').classList.toggle('hidden', type !== 'custom');
            updateRepeatPreview();
        });
    });

    document.getElementById('form-repeat-end').addEventListener('change', updateRepeatPreview);
    document.getElementById('form-date').addEventListener('change', updateRepeatPreview);
    document.querySelectorAll('.day-cb').forEach(cb => cb.addEventListener('change', updateRepeatPreview));

    document.getElementById('form-custom-date-picker').addEventListener('change', (e) => {
        const date = e.target.value;
        if (date && !customSelectedDates.includes(date)) {
            customSelectedDates.push(date);
            customSelectedDates.sort();
            renderCustomDates();
            updateRepeatPreview();
        }
        e.target.value = '';
    });
}

function renderCustomDates() {
    const container = document.getElementById('custom-dates-container');
    container.innerHTML = customSelectedDates.map(d => {
        const dt = new Date(d + 'T00:00:00');
        const label = `${dt.getMonth()+1}/${dt.getDate()}`;
        return `<span class="custom-date-tag" onclick="removeCustomDate('${d}')">${label} ×</span>`;
    }).join('');
}

function removeCustomDate(date) {
    customSelectedDates = customSelectedDates.filter(d => d !== date);
    renderCustomDates();
    updateRepeatPreview();
}

function getRepeatDates() {
    const startDate = document.getElementById('form-date').value;
    if (!startDate) return { dates: [], error: '시작 날짜를 선택해주세요' };

    const repeatType = document.querySelector('input[name="repeat_type"]:checked')?.value || 'daily';

    // 날짜 직접 선택 모드
    if (repeatType === 'custom') {
        if (customSelectedDates.length === 0) return { dates: [], error: '날짜를 하나 이상 선택해주세요' };
        return { dates: [...customSelectedDates], error: null };
    }

    // 매일 / 매주: 종료 날짜 필수
    const endDate = document.getElementById('form-repeat-end').value;
    if (!endDate) return { dates: [], error: '종료 날짜를 설정해주세요' };
    if (endDate < startDate) return { dates: [], error: '종료 날짜가 시작 날짜보다 빨라요' };

    const dates = [];
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    if (repeatType === 'daily') {
        while (cur <= end) {
            dates.push(formatDate(cur));
            cur.setDate(cur.getDate() + 1);
        }
    } else if (repeatType === 'weekly') {
        const checkedDays = [...document.querySelectorAll('.day-cb:checked')].map(cb => parseInt(cb.value));
        if (checkedDays.length === 0) return { dates: [], error: '반복할 요일을 선택해주세요' };
        while (cur <= end) {
            if (checkedDays.includes(cur.getDay())) dates.push(formatDate(cur));
            cur.setDate(cur.getDate() + 1);
        }
        if (dates.length === 0) return { dates: [], error: '선택한 기간에 해당 요일이 없습니다' };
    }

    return { dates, error: dates.length === 0 ? '반복 날짜가 없습니다' : null };
}

function updateRepeatPreview() {
    if (!document.getElementById('form-repeat').checked) return;
    const el = document.getElementById('repeat-preview');
    const { dates, error } = getRepeatDates();
    if (error || dates.length === 0) {
        el.classList.add('hidden');
        return;
    }
    const dayNames = ['일','월','화','수','목','금','토'];
    const firstLabel = (() => { const d = new Date(dates[0]+'T00:00:00'); return `${d.getMonth()+1}/${d.getDate()}(${dayNames[d.getDay()]})`; })();
    const lastLabel  = (() => { const d = new Date(dates[dates.length-1]+'T00:00:00'); return `${d.getMonth()+1}/${d.getDate()}(${dayNames[d.getDay()]})`; })();
    el.textContent = `📅 총 ${dates.length}개 날짜에 추가됩니다 (${firstLabel} ~ ${lastLabel})`;
    el.classList.remove('hidden');
}

// ========================
// CRUD 액션
// ========================
function toggleComplete(id, completed) {
    updateSchedule(id, { completed });
    showToast(completed ? '✅ 완료 처리되었습니다' : '🔄 미완료로 변경되었습니다');
    refreshCurrentView();
    updateSidebarStats();
}

// ========================
// 검색
// ========================
function initSearch() {
    // PC 검색
    const pcInput = document.getElementById('search-input');
    if (pcInput) {
        pcInput.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            if (q.length === 0) {
                clearSearch();
                return;
            }
            showSearchResults(q);
        });
        pcInput.addEventListener('keydown', e => {
            if (e.key === 'Escape') clearSearch();
        });
    }

    // 모바일 검색
    const mobileInput = document.getElementById('mobile-search-input');
    if (mobileInput) {
        mobileInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderScheduleList();
        });
    }
}

function showSearchResults(query) {
    const overlay = document.getElementById('search-overlay');
    const container = document.getElementById('search-results');

    const schedules = loadSchedules();
    const q = query.toLowerCase();
    const results = schedules.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
    ).slice(0, 8);

    if (results.length === 0) {
        container.innerHTML = `<p class="text-sm text-gray-400 text-center py-4">검색 결과가 없습니다</p>`;
    } else {
        container.innerHTML = results.map(s => {
            const cat = CATEGORIES[s.category] || CATEGORIES.other;
            const title = highlightText(escHtml(s.title), query);
            return `
                <div class="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors" onclick="openEditModal('${s.id}'); clearSearch();">
                    <span class="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style="background-color:${cat.bg}">${cat.emoji}</span>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-gray-100">${title}</p>
                        <p class="text-xs text-gray-400">${s.date}${s.start_time ? ' · ' + s.start_time : ''}</p>
                    </div>
                    ${s.is_dday ? `<span class="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">D-${getDaysLeft(s.date)}</span>` : ''}
                </div>`;
        }).join('');
    }

    overlay.classList.remove('hidden');
}

function clearSearch() {
    const overlay = document.getElementById('search-overlay');
    overlay.classList.add('hidden');
    const pcInput = document.getElementById('search-input');
    if (pcInput) pcInput.value = '';
}

// 외부 클릭 시 검색 닫기
document.addEventListener('click', (e) => {
    const overlay = document.getElementById('search-overlay');
    const searchInput = document.getElementById('search-input');
    if (!overlay.contains(e.target) && e.target !== searchInput) {
        overlay.classList.add('hidden');
    }
});

// ========================
// 유틸리티
// ========================
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getDaysLeft(dateStr) {
    const target = new Date(dateStr + 'T00:00:00');
    const today  = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function refreshCurrentView() {
    navigate(currentPage);
}

function escHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function highlightText(html, query) {
    if (!query) return html;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return html.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

// 토스트
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ========================
// 스톱워치
// ========================
let swInterval = null;
let swRunning  = false;
let swElapsed  = 0;      // ms
let swLapStart = 0;

function swTick() {
    swElapsed += 10;
    document.getElementById('sw-display').textContent = swFormat(swElapsed);
}

function swFormat(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function swStartStop() {
    const btn = document.getElementById('sw-start-btn');
    if (!swRunning) {
        swInterval = setInterval(swTick, 10);
        swRunning  = true;
        btn.textContent = 'Pause';
        btn.classList.replace('bg-orange-500','bg-yellow-500');
        btn.classList.replace('hover:bg-orange-600','hover:bg-yellow-600');
    } else {
        clearInterval(swInterval);
        swRunning = false;
        // 랩 저장
        swSaveLap();
        btn.textContent = 'Resume';
        btn.classList.replace('bg-yellow-500','bg-orange-500');
        btn.classList.replace('hover:bg-yellow-600','hover:bg-orange-600');
    }
}

function swSaveLap() {
    const lapTime = swElapsed - swLapStart;
    if (lapTime < 1000) return;
    swLapStart = swElapsed;

    const label   = document.getElementById('sw-label').value.trim() || '공부';
    const laps    = document.getElementById('sw-laps');
    const lapEl   = document.createElement('div');
    lapEl.className = 'flex justify-between items-center px-2 py-1 bg-[#282828] rounded-lg text-[10px]';
    lapEl.innerHTML = `<span class="text-gray-400">${label}</span><span class="text-orange-400 font-mono font-bold">${swFormat(lapTime)}</span>`;
    laps.prepend(lapEl);
}

function swReset() {
    clearInterval(swInterval);
    swRunning  = false;
    swElapsed  = 0;
    swLapStart = 0;
    document.getElementById('sw-display').textContent = '00:00:00';
    document.getElementById('sw-laps').innerHTML = '';
    const btn = document.getElementById('sw-start-btn');
    btn.textContent = 'Start';
    btn.className = btn.className
        .replace('bg-yellow-500','bg-orange-500')
        .replace('hover:bg-yellow-600','hover:bg-orange-600');
}

// ========================
// 생기부 관리
// ========================
const DEFAULT_RECORDS = [
    { id: 'r1', title: '자율활동',           content: '', emoji: '🎯', updatedAt: '' },
    { id: 'r2', title: '동아리활동',          content: '', emoji: '🤝', updatedAt: '' },
    { id: 'r3', title: '봉사활동',            content: '', emoji: '❤️', updatedAt: '' },
    { id: 'r4', title: '진로활동',            content: '', emoji: '🚀', updatedAt: '' },
    { id: 'r5', title: '독서활동',            content: '', emoji: '📚', updatedAt: '' },
    { id: 'r6', title: '교과 세부능력',       content: '', emoji: '📝', updatedAt: '' },
    { id: 'r7', title: '행동특성 및 종합의견', content: '', emoji: '⭐', updatedAt: '' },
];

let currentRecordId = null;
let recordAutoSaveTimer = null;

function loadRecords() {
    return recordsCache.length ? recordsCache : JSON.parse(JSON.stringify(DEFAULT_RECORDS));
}

function saveRecords(records) {
    recordsCache = records;
    if (currentUid) {
        db.collection('users').doc(currentUid).collection('data').doc('records')
            .set({ items: records })
            .catch(e => console.error('Record save error:', e));
    }
}

function renderRecordList() {
    const records = loadRecords();
    const list = document.getElementById('record-item-list');
    if (!list) return;

    list.innerHTML = records.map(r => {
        const isActive = r.id === currentRecordId;
        const hasContent = r.content.trim().length > 0;
        return `
        <button onclick="selectRecord('${r.id}')"
            class="w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150
            ${isActive
                ? 'bg-primary-500/15 border-orange-500/40 text-orange-400'
                : 'bg-[#141414] border-[#222] text-gray-400 hover:border-orange-500/30 hover:text-gray-200'}">
            <div class="flex items-center gap-2">
                <span class="text-base">${r.emoji}</span>
                <span class="text-sm font-semibold truncate flex-1">${escHtml(r.title)}</span>
                ${hasContent ? '<span class="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0"></span>' : ''}
            </div>
            ${r.updatedAt ? `<p class="text-[10px] text-gray-600 mt-0.5 ml-6">${r.updatedAt} 수정</p>` : ''}
        </button>`;
    }).join('');
}

function selectRecord(id) {
    currentRecordId = id;
    const records = loadRecords();
    const rec = records.find(r => r.id === id);
    if (!rec) return;

    const titleInput = document.getElementById('record-title-input');
    const editor     = document.getElementById('record-editor');
    const deleteBtn  = document.getElementById('record-delete-btn');
    const updated    = document.getElementById('record-updated');

    titleInput.value = rec.title;
    titleInput.readOnly = false;
    editor.value = rec.content;
    editor.readOnly = false;
    editor.placeholder = `${rec.title} 내용을 자유롭게 작성하세요...`;
    deleteBtn.classList.remove('hidden');
    updated.textContent = rec.updatedAt ? `마지막 수정: ${rec.updatedAt}` : '';

    updateRecordCharCount();
    renderRecordList();
    editor.focus();
}

function onRecordEditorInput() {
    updateRecordCharCount();
    scheduleRecordAutoSave();
}

function onRecordTitleInput() {
    scheduleRecordAutoSave();
}

function updateRecordCharCount() {
    const editor = document.getElementById('record-editor');
    const count  = document.getElementById('record-char-count');
    if (!editor || !count) return;
    count.textContent = editor.value.length.toLocaleString() + '자';
}

function scheduleRecordAutoSave() {
    const status = document.getElementById('record-save-status');
    if (status) status.textContent = '저장 중...';
    clearTimeout(recordAutoSaveTimer);
    recordAutoSaveTimer = setTimeout(() => {
        saveCurrentRecord();
        if (status) { status.textContent = '저장됨 ✓'; setTimeout(() => { status.textContent = ''; }, 2000); }
    }, 800);
}

function saveCurrentRecord() {
    if (!currentRecordId) return;
    const records = loadRecords();
    const idx = records.findIndex(r => r.id === currentRecordId);
    if (idx === -1) return;

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;

    records[idx].title     = document.getElementById('record-title-input').value.trim() || records[idx].title;
    records[idx].content   = document.getElementById('record-editor').value;
    records[idx].updatedAt = dateStr;
    saveRecords(records);
    renderRecordList();
}

function addRecordItem() {
    const records = loadRecords();
    const emojis = ['📌','💡','🌟','📎','🔖','🗒️','🏆'];
    const newRec = {
        id: 'r_' + Date.now(),
        title: '새 항목',
        content: '',
        emoji: emojis[records.length % emojis.length],
        updatedAt: ''
    };
    records.push(newRec);
    saveRecords(records);
    renderRecordList();
    selectRecord(newRec.id);

    // 제목 바로 편집
    const titleInput = document.getElementById('record-title-input');
    titleInput.select();
}

function deleteCurrentRecord() {
    if (!currentRecordId) return;
    const records = loadRecords();
    const rec = records.find(r => r.id === currentRecordId);
    if (!rec) return;

    if (!confirm(`"${rec.title}" 항목을 삭제하시겠습니까?`)) return;

    const filtered = records.filter(r => r.id !== currentRecordId);
    saveRecords(filtered);
    currentRecordId = null;

    // 에디터 초기화
    document.getElementById('record-title-input').value = '';
    document.getElementById('record-title-input').readOnly = true;
    document.getElementById('record-editor').value = '';
    document.getElementById('record-editor').readOnly = true;
    document.getElementById('record-delete-btn').classList.add('hidden');
    document.getElementById('record-updated').textContent = '';
    document.getElementById('record-char-count').textContent = '0자';

    renderRecordList();
    showToast('🗑️ 항목이 삭제되었습니다');
}

function copyRecord() {
    const editor = document.getElementById('record-editor');
    if (!editor.value) { showToast('❗ 복사할 내용이 없습니다'); return; }
    navigator.clipboard.writeText(editor.value).then(() => showToast('📋 복사되었습니다'));
}

function initRecord() {
    if (!recordsCache.length) {
        recordsCache = JSON.parse(JSON.stringify(DEFAULT_RECORDS));
    }
    renderRecordList();
}

// ========================
// 생기부 탭 전환
// ========================
function switchRecordTab(tab) {
    const isNotes = tab === 'notes';
    document.getElementById('rec-panel-notes').classList.toggle('hidden', !isNotes);
    document.getElementById('rec-panel-counter').classList.toggle('hidden', isNotes);

    const notesBtn   = document.getElementById('rec-tab-notes');
    const counterBtn = document.getElementById('rec-tab-counter');

    if (isNotes) {
        notesBtn.className   = notesBtn.className.replace('bg-[#1e1e1e] text-gray-400 border border-[#333333] hover:border-orange-500/40 hover:text-gray-200', 'bg-primary-500 text-white shadow-lg shadow-orange-500/20');
        counterBtn.className = counterBtn.className.replace('bg-primary-500 text-white shadow-lg shadow-orange-500/20', 'bg-[#1e1e1e] text-gray-400 border border-[#333333] hover:border-orange-500/40 hover:text-gray-200');
    } else {
        counterBtn.className = counterBtn.className.replace('bg-[#1e1e1e] text-gray-400 border border-[#333333] hover:border-orange-500/40 hover:text-gray-200', 'bg-primary-500 text-white shadow-lg shadow-orange-500/20');
        notesBtn.className   = notesBtn.className.replace('bg-primary-500 text-white shadow-lg shadow-orange-500/20', 'bg-[#1e1e1e] text-gray-400 border border-[#333333] hover:border-orange-500/40 hover:text-gray-200');
    }
}

// ========================
// NEIS 글자수 계산기 (나이스 오차 없는 정확한 알고리즘)
// ========================
let neisLimit = 1600;

function setNeisLimit(limit) {
    neisLimit = limit;
    document.querySelectorAll('.neis-limit-btn').forEach(btn => {
        const isActive = parseInt(btn.dataset.limit) === limit;
        btn.className = btn.className
            .replace('bg-orange-500 text-white border-transparent', 'bg-[#1e1e1e] text-gray-400 border-[#333]')
            .replace('bg-[#1e1e1e] text-gray-400 border-[#333]', isActive ? 'bg-orange-500 text-white border-transparent' : 'bg-[#1e1e1e] text-gray-400 border-[#333]');
        // remove duplicate if replaced twice
        if (isActive) {
            btn.classList.remove('bg-[#1e1e1e]', 'text-gray-400', 'border-[#333]', 'hover:border-orange-400');
            btn.classList.add('bg-orange-500', 'text-white', 'border-transparent');
        } else {
            btn.classList.remove('bg-orange-500', 'text-white', 'border-transparent');
            btn.classList.add('bg-[#1e1e1e]', 'text-gray-400', 'border-[#333]', 'hover:border-orange-400');
        }
    });
    updateNeisCounter();
}

function neisCalc(content) {
    // 나이스 계산기(https://hjh010501.github.io/neis-counter/)와 동일한 알고리즘
    if (content === '\n' && content.startsWith('\n')) content = content.slice(1);
    if (content !== '\n' && content.endsWith('\n'))   content = content.slice(0, -1);

    const math_symbols  = /[\+\-\*\/=<>∞∑∏∫√∂∆πθΩαβγδεζηλμνξοπρστυφχψω·]/g;
    const other_symbols = /[''""]/g;
    const std_special   = /[\{\}\[\]\/?.,;:|\)*~`!^\-\_+<>@\#$%&\\=\(\'\"]/g;

    const english = content
        .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '')
        .replace(/[0-9]/g, '')
        .replace(math_symbols, '')
        .replace(std_special, '')
        .replace(/\s/g, '')
        .replace(other_symbols, '');

    const korean = content
        .replace(/[a-zA-Z]/g, '')
        .replace(/[0-9]/g, '')
        .replace(math_symbols, '')
        .replace(std_special, '')
        .replace(/\s/g, '')
        .replace(other_symbols, '');

    const number = content
        .replace(/[a-zA-Z]/g, '')
        .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '')
        .replace(math_symbols, '')
        .replace(std_special, '')
        .replace(/\s/g, '')
        .replace(other_symbols, '');

    const onebyte_special = content
        .replace(/[a-zA-Z]/g, '')
        .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '')
        .replace(/[0-9]/g, '')
        .replace(/[\n\t\r\s]/g, '');

    const threebyte_special = content
        .replace(/[a-zA-Z]/g, '')
        .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '')
        .replace(/[0-9]/g, '')
        .replace(math_symbols, '')
        .replace(std_special, '')
        .replace(/[\n\t\r\s]/g, '')
        .replace(other_symbols, '');

    const space = content
        .replace(/[a-zA-Z]/g, '')
        .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '')
        .replace(/[0-9]/g, '')
        .replace(math_symbols, '')
        .replace(std_special, '')
        .replace(other_symbols, '')
        .replace(/[^\s]/g, '')
        .replace(/[\n\r]/g, '');

    const line = content
        .replace(/[a-zA-Z]/g, '')
        .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '')
        .replace(std_special, '')
        .replace(/[0-9]/g, '')
        .replace(math_symbols, '')
        .replace(/[^\n]/g, '')
        .replace(other_symbols, '');

    const bytes = english.length + (korean.length * 3) + number.length +
                  onebyte_special.length + (threebyte_special.length * 3) +
                  space.length + (line.length * 2);

    const charNoSpace  = content.replace(/(\r\n\t|\n|\r\t)/gm, '').replace(/ /gi, '').length;
    const charWithSpace = content.length;

    return { bytes, charNoSpace, charWithSpace,
             ko: korean.length, en: english.length,
             num: number.length, sym: onebyte_special.length,
             sp: space.length, nl: line.length };
}

function updateNeisCounter() {
    const input = document.getElementById('neis-input');
    if (!input) return;
    const content = input.value;
    const r = neisCalc(content);

    document.getElementById('neis-char-nospace').textContent = r.charNoSpace.toLocaleString();
    document.getElementById('neis-char-space').textContent   = r.charWithSpace.toLocaleString();
    document.getElementById('neis-bytes').textContent        = r.bytes.toLocaleString();

    document.getElementById('nd-ko').textContent  = r.ko;
    document.getElementById('nd-en').textContent  = r.en;
    document.getElementById('nd-num').textContent = r.num;
    document.getElementById('nd-sym').textContent = r.sym;
    document.getElementById('nd-sp').textContent  = r.sp;
    document.getElementById('nd-nl').textContent  = r.nl;

    const pct = neisLimit > 0 ? Math.min((r.bytes / neisLimit) * 100, 100) : 0;
    const bar  = document.getElementById('neis-bar');
    const warn = document.getElementById('neis-warning');
    const pctLabel = document.getElementById('neis-pct');
    const limitLabel = document.getElementById('neis-limit-label');

    limitLabel.textContent = neisLimit.toLocaleString();
    pctLabel.innerHTML = `${r.bytes.toLocaleString()} / <span id="neis-limit-label">${neisLimit.toLocaleString()}</span> bytes`;
    bar.style.width = pct + '%';

    if (r.bytes > neisLimit) {
        bar.className = bar.className.replace('bg-orange-500', 'bg-red-500').replace('bg-green-500', 'bg-red-500');
        bar.classList.add('bg-red-500');
        bar.classList.remove('bg-orange-500', 'bg-green-500');
        warn.textContent = `⚠️ ${(r.bytes - neisLimit).toLocaleString()} bytes over limit!`;
        warn.classList.remove('hidden', 'text-yellow-400');
        warn.classList.add('text-red-400');
    } else if (pct >= 90) {
        bar.classList.add('bg-yellow-500');
        bar.classList.remove('bg-orange-500', 'bg-red-500', 'bg-green-500');
        warn.textContent = `⚡ ${(neisLimit - r.bytes).toLocaleString()} bytes remaining`;
        warn.classList.remove('hidden', 'text-red-400');
        warn.classList.add('text-yellow-400');
    } else {
        bar.classList.add('bg-orange-500');
        bar.classList.remove('bg-red-500', 'bg-yellow-500', 'bg-green-500');
        warn.classList.add('hidden');
    }
}

function clearNeisInput() {
    const input = document.getElementById('neis-input');
    if (input) { input.value = ''; updateNeisCounter(); }
}

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAddModal();
        closeConfirmModal();
        clearSearch();
    }
    // Ctrl+N = 새 일정
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openAddModal();
    }
});
