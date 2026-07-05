/* [회개하자!_Web_V1.3.1_stats.js_시작 | 작성일: 2026-07-05 18:18 KST] */
/**
 * [V1.3.1 패치 업데이트 내역 - 통계 엔진]
 * 1. 동적 모달창(app.js) 생성 시점과의 렌더링 타이밍 동기화 완벽 해결 (DOM 존재 여부 방어 로직 추가)
 * 2. KST(한국 표준시) 기준 날짜 계산 엔진 유지 (해외 사용자 오류 방지)
 * 3. 일일 목표 기도 시간(분) 설정 및 진행률(Progress Bar) 연동
 * 4. 고유 바코드(UID) 기반 <대상(이름) -> 기도문 -> 기간별(일/월/년)> 3단계 교차 분석 알고리즘
 * 5. 달력의 빈 날짜를 제외한 실제 앱 사용일(Active Days) 기준 최근 15일 추적
 */

// ============================================================================
// 1. 통계 데이터베이스 구조 및 초기화
// ============================================================================
let statsDB = {
    dailyGoalMinutes: 30, // 기본 목표 30분
    currentStreak: 0,     // 연속 달성일
    lastRecordDate: "",   // 마지막으로 기도한 날짜 (연속일 계산용)
    dailyRecords: {}      // 일간 상세 기록 구조
};

// 앱 구동 시 로컬 스토리지에서 통계 데이터 로드 및 초기화
document.addEventListener('DOMContentLoaded', () => {
    const storedStats = localStorage.getItem('v1_3_stats');
    if (storedStats) {
        try {
            statsDB = JSON.parse(storedStats);
            if (statsDB.dailyGoalMinutes === undefined) statsDB.dailyGoalMinutes = 30;
            if (statsDB.currentStreak === undefined) statsDB.currentStreak = 0;
            if (statsDB.dailyRecords === undefined) statsDB.dailyRecords = {};
        } catch(e) {
            console.error("통계 데이터 파싱 오류:", e);
        }
    }
    
    // 1년 넘은 상세 데이터 자동 정리 (앱 속도 저하 방지)
    cleanUpOldData(); 
});

// ============================================================================
// 2. KST(한국 표준시) 및 유틸리티 엔진
// ============================================================================
// 해외나 기기 시간이 달라도 무조건 한국 시간 기준으로 날짜를 반환 (YYYY-MM-DD)
function getKSTDateStr(dateObj = new Date()) {
    const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (9 * 3600000));
    return kst.toISOString().split('T')[0];
}

// 초 단위 시간을 "00시간 00분" 형태로 예쁘게 변환
function formatTime(seconds) {
    if (seconds === 0) return "0분";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
}

// ============================================================================
// 3. 데이터 기록 브릿지 엔진 (app.js에서 호출됨)
// ============================================================================
/**
 * 기도가 다음 단계로 넘어가거나 정지될 때 app.js에서 이 함수를 호출하여 데이터를 누적합니다.
 */
window.recordPrayerData = function(session, seconds) {
    if (seconds < 1) return; // 1초 미만 허수 데이터는 통계에 기록하지 않음

    const todayStr = getKSTDateStr();
    
    // 오늘자 데이터 뼈대가 없으면 신규 생성
    if (!statsDB.dailyRecords[todayStr]) {
        statsDB.dailyRecords[todayStr] = {
            totalTime: 0,
            totalCount: 0,
            details: {} 
        };
    }

    const todayRecord = statsDB.dailyRecords[todayStr];
    todayRecord.totalTime += seconds;
    todayRecord.totalCount += 1;

    // 1. 대상(이름) 계층 구조 확인 및 생성
    if (!todayRecord.details[session.nameUID]) {
        todayRecord.details[session.nameUID] = {
            nameText: session.nameText,
            prayers: {}
        };
    }

    // 2. 기도문 계층 구조 확인 및 시간/횟수 누적
    const targetNameDB = todayRecord.details[session.nameUID];
    if (!targetNameDB.prayers[session.prayerUID]) {
        targetNameDB.prayers[session.prayerUID] = {
            prayerText: session.prayerText,
            time: 0,
            count: 0
        };
    }
    
    // 최종 누적 연산
    targetNameDB.prayers[session.prayerUID].time += seconds;
    targetNameDB.prayers[session.prayerUID].count += 1;

    // 3. 연속 달성일(Streak) 검사 및 업데이트
    updateStreak(todayStr);

    // 스토리지에 최종 영구 저장
    saveStatsDB();
    console.log(`📊 통계 누적 완료: [${session.nameText}] 대상 / ${seconds}초 저장됨`);
};

// 연속 기도 달성일 계산 로직
function updateStreak(todayStr) {
    if (statsDB.lastRecordDate !== todayStr) {
        const yesterday = new Date();
        const utc = yesterday.getTime() + (yesterday.getTimezoneOffset() * 60000);
        const kstYesterday = new Date(utc + (9 * 3600000));
        kstYesterday.setDate(kstYesterday.getDate() - 1);
        const yesterdayStr = kstYesterday.toISOString().split('T')[0];

        if (statsDB.lastRecordDate === yesterdayStr) {
            statsDB.currentStreak += 1; // 어제도 했으면 이어짐
        } else if (statsDB.lastRecordDate !== todayStr) {
            statsDB.currentStreak = 1;  // 끊겼으면 냉정하게 1일부터
        }
        statsDB.lastRecordDate = todayStr;
    }
}

function saveStatsDB() {
    localStorage.setItem('v1_3_stats', JSON.stringify(statsDB));
}

// 1년(365일)이 지난 상세 데이터는 앱 속도 최적화를 위해 자동 삭제 (Tiering)
function cleanUpOldData() {
    const today = new Date();
    const keys = Object.keys(statsDB.dailyRecords);
    let isModified = false;

    keys.forEach(dateStr => {
        const recordDate = new Date(dateStr);
        const diffDays = (today - recordDate) / (1000 * 60 * 60 * 24);
        if (diffDays > 365) {
            delete statsDB.dailyRecords[dateStr];
            isModified = true;
        }
    });

    if (isModified) saveStatsDB();
}

// ============================================================================
// 4. 화면 렌더링 엔진 (대시보드 그리기) - V1.3.1 오류 수정부
// ============================================================================
// app.js의 모달 생성 후 setTimeout을 통해 안전하게 호출됨
window.renderStatsDashboard = function() {
    const tabSummaryEl = document.getElementById('tab-summary');
    const tabDetailEl = document.getElementById('tab-detail');
    
    // DOM이 아직 생성되지 않았다면 렌더링 중지 (에러 방어)
    if (!tabSummaryEl || !tabDetailEl) {
        console.warn("통계 모달의 DOM 요소가 아직 준비되지 않았습니다. 렌더링을 지연합니다.");
        return;
    }

    renderTabSummary(tabSummaryEl);
    renderTabDetailCrossAnalysis(tabDetailEl);
};

// --- (탭 1) 나의 목표 및 요약 렌더링 ---
function renderTabSummary(containerEl) {
    const todayStr = getKSTDateStr();
    const todayData = statsDB.dailyRecords[todayStr] || { totalTime: 0 };
    
    // 진행률 계산 (목표 분 -> 초 단위 변환)
    const goalSeconds = statsDB.dailyGoalMinutes * 60;
    let progressPercent = (todayData.totalTime / goalSeconds) * 100;
    if (progressPercent > 100) progressPercent = 100;

    const html = `
        <div style="text-align: center; padding: 10px 5px;">
            <div style="background: #FFF5E6; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #FFE0B2;">
                <h3 style="color: #FF9500; font-size: 18px; font-weight: 900; margin-bottom: 8px;">🔥 현재 ${statsDB.currentStreak}일 연속 기도 중!</h3>
                <p style="color: #8E8E93; font-size: 13px; margin: 0; font-weight: 700;">매일 주님과 만나는 소중한 시간입니다.</p>
            </div>
            
            <div style="margin-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                    <span style="font-weight: 900; color: #1A1A1C; font-size: 15px;">오늘의 목표 달성률</span>
                    <span style="color: #007AFF; font-weight: 900; font-size: 14px;">${formatTime(todayData.totalTime)} / ${statsDB.dailyGoalMinutes}분</span>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
            </div>
            
            <div style="margin-top: 30px; background: #F8F9FA; padding: 16px; border-radius: 12px; border: 1px solid #E9ECEF; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 900; color: #495057; font-size: 14px;">하루 목표 시간 (분)</span>
                <div style="display: flex; gap: 8px;">
                    <input type="number" id="input-goal" value="${statsDB.dailyGoalMinutes}" style="width: 70px; padding: 8px; border-radius: 8px; border: 1px solid #CED4DA; text-align: center; font-weight: 900; font-size: 15px; outline: none; color: #1A1A1C;">
                    <button type="button" class="bg-blue" onclick="updateGoal()" style="border: none; border-radius: 8px; padding: 0 16px; font-weight: 900; font-size: 14px; cursor: pointer; color: white;">저장</button>
                </div>
            </div>
        </div>
    `;
    containerEl.innerHTML = html;
}

// 목표 시간 저장 브릿지
window.updateGoal = function() {
    const newVal = document.getElementById('input-goal').value;
    if (newVal && parseInt(newVal) > 0) {
        statsDB.dailyGoalMinutes = parseInt(newVal);
        saveStatsDB();
        window.renderStatsDashboard(); // 즉시 화면 재렌더링
        alert("🎯 오늘의 목표 시간이 수정되었습니다!");
    }
};

// --- (탭 2) 대상/기도문 교차 심층 분석 렌더링 ---
function renderTabDetailCrossAnalysis(containerEl) {
    const todayStr = getKSTDateStr();
    const currentMonthPrefix = todayStr.substring(0, 7); // "2026-07"
    const currentYearPrefix = todayStr.substring(0, 4);  // "2026"
    
    // 교차 분석 데이터를 담을 최상위 상자
    const crossData = {}; 
    let hasAnyRecord = false;

    // 모든 날짜를 순회하며 UID 기준으로 계층형 묶기
    Object.keys(statsDB.dailyRecords).forEach(date => {
        const isToday = (date === todayStr);
        const isMonth = date.startsWith(currentMonthPrefix);
        const isYear = date.startsWith(currentYearPrefix);

        const dayRecord = statsDB.dailyRecords[date];
        
        Object.keys(dayRecord.details).forEach(nameUID => {
            hasAnyRecord = true;
            const nameObj = dayRecord.details[nameUID];
            
            if (!crossData[nameUID]) {
                crossData[nameUID] = {
                    nameText: nameObj.nameText,
                    totalTime: 0, totalCount: 0,
                    prayers: {}
                };
            }
            
            crossData[nameUID].totalTime += dayRecord.totalTime;
            crossData[nameUID].totalCount += dayRecord.totalCount;

            Object.keys(nameObj.prayers).forEach(prayerUID => {
                const prayer = nameObj.prayers[prayerUID];
                
                if (!crossData[nameUID].prayers[prayerUID]) {
                    crossData[nameUID].prayers[prayerUID] = {
                        prayerText: prayer.prayerText,
                        totalTime: 0, totalCount: 0,
                        todayTime: 0, todayCount: 0,
                        monthTime: 0, monthCount: 0,
                        yearTime: 0, yearCount: 0
                    };
                }
                
                const ptr = crossData[nameUID].prayers[prayerUID];
                ptr.totalTime += prayer.time;
                ptr.totalCount += prayer.count;
                
                if (isToday) { ptr.todayTime += prayer.time; ptr.todayCount += prayer.count; }
                if (isMonth) { ptr.monthTime += prayer.time; ptr.monthCount += prayer.count; }
                if (isYear) { ptr.yearTime += prayer.time; ptr.yearCount += prayer.count; }
            });
        });
    });

    // 2. 정제된 데이터를 HTML 아코디언 트리 리스트로 렌더링
    let html = `<h3 style="text-align:center; color: #1A1A1C; font-size: 16px; margin-bottom: 16px; font-weight: 900;">👤 대상별 심층 교차 통계</h3>`;
    
    if (!hasAnyRecord) {
        html += `<div style="text-align:center; padding: 40px 0; color: #8E8E93; font-size: 14px; font-weight: 700;">아직 기록된 기도 통계가 없습니다.<br>기도를 시작하여 통계를 쌓아보세요.</div>`;
        containerEl.innerHTML = html;
        return;
    }

    Object.keys(crossData).forEach(nUID => {
        const nData = crossData[nUID];
        html += `
            <div class="tree-item">
                <div class="tree-title">👤 [${nData.nameText}] 을(를) 위한 기도</div>
                <div style="font-size:12px; color:#007AFF; font-weight: 900; margin-bottom:12px;">총 누적: ${nData.totalCount}회 / ${formatTime(nData.totalTime)}</div>
        `;
        
        Object.keys(nData.prayers).forEach(pUID => {
            const pData = nData.prayers[pUID];
            html += `
                <div class="tree-sub">
                    <strong style="color:#1A1A1C; font-weight: 900;">📜 ${pData.prayerText}</strong> <span style="font-size: 11px; color:#8E8E93; font-weight:700;">(총 ${pData.totalCount}회 / ${formatTime(pData.totalTime)})</span>
                    <div style="margin-top: 6px; font-size:12px; color:#495057; font-weight:700; line-height: 1.6; background: #FFFFFF; padding: 8px; border-radius: 8px; border: 1px solid #F1F3F5;">
                        • <strong>[오늘]</strong> ${pData.todayCount}회 / ${formatTime(pData.todayTime)}<br>
                        • <strong>[이번 달]</strong> ${pData.monthCount}회 / ${formatTime(pData.monthTime)}<br>
                        • <strong>[올해]</strong> ${pData.yearCount}회 / ${formatTime(pData.yearTime)}
                    </div>
                </div>
            `;
        });
        html += `</div>`; // tree-item 닫기
    });

    // 3. 최근 15일 활동(Active Days) 요약 첨부
    html += renderActive15Days();
    containerEl.innerHTML = html;
}

// --- (보너스 로직) 실사용 최근 15일 타임라인 ---
function renderActive15Days() {
    // 날짜 내림차순 정렬 (최신순)
    const dates = Object.keys(statsDB.dailyRecords).sort((a, b) => new Date(b) - new Date(a)); 
    const active15 = dates.slice(0, 15); // 빈 날짜를 제외하고, 실제로 기도한 날짜만 15개 추출

    let html = `
        <div style="height: 1px; background: #E9ECEF; margin: 24px 0;"></div>
        <h3 style="text-align:center; color: #1A1A1C; font-size: 16px; font-weight: 900; margin-bottom: 16px;">📅 최근 15일 활동 내역 (Active Days)</h3>
        <div style="background: #F8F9FA; border-radius: 12px; padding: 8px 16px; border: 1px solid #E9ECEF;">
    `;

    if (active15.length === 0) {
        return html + `<p style="text-align:center; color:#8E8E93; font-size:13px; font-weight:700; margin: 10px 0;">기록이 없습니다.</p></div>`;
    }

    active15.forEach((date, index) => {
        const record = statsDB.dailyRecords[date];
        const isLast = index === active15.length - 1;
        const borderStyle = isLast ? "" : "border-bottom: 1px dashed #CED4DA;";
        
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; ${borderStyle}">
                <span style="font-weight:900; color:#007AFF; font-size:14px;">${date}</span>
                <span style="color:#495057; font-size:13px; font-weight:900;">총 ${record.totalCount}회 / ${formatTime(record.totalTime)}</span>
            </div>
        `;
    });

    html += `</div>`; // 컨테이너 닫기
    return html;
}
/* [회개하자!_Web_V1.3.1_stats.js_끝 | 작성일: 2026-07-05 18:18 KST] */