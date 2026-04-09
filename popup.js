/* ============================================
   BUGIL 팝업 위젯 - popup.js
   메인 앱(index.html)과 동일한 localStorage 사용
   ============================================ */

const STORAGE_KEY = 'studyplanner_schedules';

const CATEGORIES = {
    class:      { label: '수업',  emoji: '📚', color: '#60a5fa' },
    exam:       { label: '시험',  emoji: '📝', color: '#f87171' },
    assignment: { label: '과제',  emoji: '📋', color: '#fb923c' },
    study:      { label: '자습',  emoji: '📖', color: '#4ade80' },
    other:      { label: '기타',  emoji: '🎯', color: '#c084fc' },
};

// ── 유틸 ──────────────────────────────────────
function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDaysLeft(dateStr) {
    const target = new Date(dateStr + 'T00:00:00');
    const today  = new Date(); today.setHours(0,0,0,0);
    return Math.ceil((target - today) / 86400000);
}

function escHtml(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── localStorage 읽기/쓰기 ────────────────────
function loadSchedules() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
}

function saveSchedules(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// ── 완료 토글 ─────────────────────────────────
function toggleComplete(id) {
    const arr = loadSchedules();
    const idx = arr.findIndex(s => s.id === id);
    if (idx === -1) return;
    arr[idx].completed = !arr[idx].completed;
    saveSchedules(arr);
    render();
}

// ── 일괄 체크 / 전체 해제 ──────────────────────
function checkAll() {
    const todayStr = formatDate(new Date());
    const arr      = loadSchedules();
    const todayIdx = arr.reduce((acc, s, i) => { if (s.date === todayStr) acc.push(i); return acc; }, []);
    if (todayIdx.length === 0) return;

    const allDone = todayIdx.every(i => arr[i].completed);
    todayIdx.forEach(i => { arr[i].completed = !allDone; });
    saveSchedules(arr);

    // 완료로 바꾸는 경우 짧은 플래시 효과
    if (!allDone) {
        document.querySelectorAll('.sched-item').forEach(el => {
            el.classList.add('flash');
            el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true });
        });
    }
    render();
}

// ── 메인 앱 열기 ──────────────────────────────
function openApp() {
    const url = window.location.href.replace('popup.html', 'index.html');
    window.open(url, '_blank');
}

// ── 새로고침 버튼 ─────────────────────────────
function doRefresh() {
    const icon = document.querySelector('#refresh-btn i');
    icon.classList.add('spinning');
    setTimeout(() => icon.classList.remove('spinning'), 650);
    render();
}

// ── 메인 렌더링 ───────────────────────────────
function render() {
    const today    = new Date();
    const todayStr = formatDate(today);
    const dayNames = ['일','월','화','수','목','금','토'];

    /* 헤더 날짜 */
    document.getElementById('hdr-date').textContent =
        `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일 (${dayNames[today.getDay()]})`;

    const schedules = loadSchedules();

    /* 오늘 일정 */
    const todaySched = schedules
        .filter(s => s.date === todayStr)
        .sort((a,b) => (a.start_time||'ZZ').localeCompare(b.start_time||'ZZ'));

    const doneCnt  = todaySched.filter(s => s.completed).length;
    const totalCnt = todaySched.length;
    const pct      = totalCnt ? Math.round(doneCnt/totalCnt*100) : 0;

    /* 진행률 */
    document.getElementById('done-cnt').textContent  = doneCnt;
    document.getElementById('total-cnt').textContent = totalCnt;
    document.getElementById('bar-fill').style.width  = pct + '%';

    /* D-Day */
    const ddayItems = schedules
        .filter(s => s.is_dday && s.date >= todayStr)
        .sort((a,b) => a.date.localeCompare(b.date))
        .slice(0, 6);

    const ddayEl = document.getElementById('dday-list');
    if (ddayItems.length === 0) {
        ddayEl.innerHTML = `<p class="no-item">등록된 D-Day가 없습니다</p>`;
    } else {
        ddayEl.innerHTML = ddayItems.map(s => {
            const left    = getDaysLeft(s.date);
            const label   = left === 0 ? 'D-Day!' : `D-${left}`;
            const isToday = left === 0;
            const cat     = CATEGORIES[s.category] || CATEGORIES.other;
            return `
                <div class="dday-card">
                    <div class="dday-num ${isToday ? 'is-today' : ''}">${label}</div>
                    <div class="dday-name">${cat.emoji} ${escHtml(s.title)}</div>
                </div>`;
        }).join('');
    }

    /* 일정 목록 — 미완료 먼저, 완료 뒤 */
    const sorted = [
        ...todaySched.filter(s => !s.completed),
        ...todaySched.filter(s =>  s.completed),
    ];

    const listEl = document.getElementById('sched-list');
    const allSchedules = loadSchedules();
    if (sorted.length === 0) {
        const totalAll = allSchedules.length;
        const msg = totalAll === 0
            ? '메인 앱과 같은 브라우저로 열어주세요<br><small style="color:#f97316">앱 열기 → 버튼 클릭 후 새로고침</small>'
            : '오늘 등록된 일정이 없습니다';
        listEl.innerHTML = `
            <div class="empty-box">
                <span class="big">${totalAll === 0 ? '⚠️' : '🎉'}</span>
                <p>${msg}</p>
            </div>`;
    } else {
        listEl.innerHTML = sorted.map(s => {
            const cat     = CATEGORIES[s.category] || CATEGORIES.other;
            const timeStr = s.start_time
                ? (s.end_time ? `${s.start_time} ~ ${s.end_time}` : s.start_time)
                : '';
            return `
                <div class="sched-item ${s.completed ? 'done' : ''}"
                     onclick="toggleComplete('${s.id}')">
                    <div class="cat-bar" style="background:${cat.color}"></div>
                    <div class="check ${s.completed ? 'on' : ''}">
                        ${s.completed ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                    <div class="item-body">
                        <div class="item-title">${cat.emoji} ${escHtml(s.title)}</div>
                        ${timeStr ? `<div class="item-time">⏰ ${timeStr}</div>` : ''}
                    </div>
                    ${s.priority === 'high' ? '<div class="high-dot" title="높음"></div>' : ''}
                </div>`;
        }).join('');
    }

    /* 일괄 체크 버튼 상태 업데이트 */
    const btn       = document.getElementById('check-all-btn');
    const btnLabel  = document.getElementById('check-all-label');
    if (totalCnt === 0) {
        btn.style.display = 'none';
    } else {
        btn.style.display = '';
        const allDone = doneCnt === totalCnt;
        btn.classList.toggle('all-done', allDone);
        btnLabel.textContent = allDone ? '전체 해제' : '전체 완료';
        btn.querySelector('i').className = allDone ? 'fas fa-rotate-left' : 'fas fa-check-double';
    }

    /* 창 크기 재조정 */
    setTimeout(fitWindow, 50);

    /* 마지막 업데이트 시각 */
    const n = new Date();
    document.getElementById('upd-time').textContent =
        `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')} 업데이트`;
}

/* 창 크기를 콘텐츠 높이에 맞게 자동 조절 */
function fitWindow() {
    const h = document.body.scrollHeight;
    window.resizeTo(350, h + 1);
}

/* 60초마다 자동 새로고침 */
setInterval(render, 60000);

/* 초기 실행 */
render();
// 폰트 로드 후 정확한 높이로 재조정
document.fonts.ready.then(fitWindow);
