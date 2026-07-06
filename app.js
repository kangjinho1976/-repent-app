/* [회개하자!_Web_V1.3.9_app.js_시작 | 작성일: 2026-07-06 12:07 KST] */
/**
 * [V1.3.9 긴급 핫픽스 및 철통 방어 업데이트 내역]
 * 1. [철통 방어] 긴 문자열(팝업 메시지)을 + 연산자로 분할 결합하여, 에디터의 강제 줄바꿈(Line-wrap)으로 인한 Syntax Error 원천 차단
 * 2. [기능 복구] V1.3.8에서 기획된 3대 팝업(창지우기/새로저장/수정저장) 및 빈칸(Empty) 예외 방어 로직 안전하게 재탑재
 * 3. [기반 유지] V1.3.7의 안드로이드 Native 종료, 배포자 숨김 토글, 실시간 나이 갱신 등 모든 기능 100% 보존
 * 4. [잘림 감지] 파일 최하단에 복사 누락 방지용 거대한 EOF 마커 유지
 */

// ============================================================================
// 1. 전역 상태 객체 (Global State)
// ============================================================================
const state = {
    startNumber: 0, limitNumber: 100, currentNumber: 0,
    startYear: 0, startMonth: 1, limitYear: 99, limitMonth: 12, currentYear: 0, currentMonth: 1,
    startGen: 1, limitGen: 30, currentGen: 1,
    
    isYearMonthMode: false, isGenerationMode: false, isManualFontOverride: false,
    hasStarted: false, historySortIndex: 0,
    isEditMode: false, 
    
    outputTextSize: 22, outputTextColor: "#1A1A1C", 
    fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif", 
    isBold: false, 
    
    ttsSpeed: 1.0, selectedVoiceName: null, isTtsEnabled: false,
    
    secondsCurrent: 0, secondsTotal: 0, isTimerRunning: false,
    wasTimerRunningBeforeMenu: false, 
    
    welcomeList: ["기도를 시작하려면 [다음단계]를 누르세요."],
    guideList: [
        "📝 [수정 모드 안내]\n<이름> 입력 시 이름이 자동 변환됩니다.\n[ ]살, [ ]대 입력 시 자동 증감됩니다.",
        "💡 [수정 모드 팁]\n하단 입력창에서 기도문을 자유롭게 수정하세요.\n수정 완료 후 우측의 '수정저장'을 눌러주세요."
    ],
    firstWelcomeMsg: "",
    currentRollIndex: 0,
    hintsList: [
        "💡 [ ]살 ➔ '한살, 두살' 자동 변환",
        "💡 [ ] ➔ 숫자만 강조 표기",
        "💡 배포자: 생명의 빛 교회"
    ],
    hintIndex: 0,

    autoSaveInterval: null,
    currentPrayerUID: 'P_DEFAULT', 
    nameList: [] 
};

let timerInterval = null;
let rollInterval = null;
let hintInterval = null;
let originalTextBeforeEdit = "";
let synthesis = (typeof window !== 'undefined' && window.speechSynthesis) ? window.speechSynthesis : null;

// ============================================================================
// 2. 로컬 스토리지 데이터 관리 및 통계 연동 헬퍼
// ============================================================================
function getLocalData() {
    try {
        const rawData = localStorage.getItem('AppHistory');
        if (rawData === null || rawData === undefined) return {};
        const parsedData = JSON.parse(rawData);
        return (typeof parsedData === 'object' && parsedData !== null) ? parsedData : {};
    } catch (error) {
        console.warn("데이터 파싱 오류 (자동 복구):", error);
        return {};
    }
}

function saveLocalData(dataObj) {
    try { localStorage.setItem('AppHistory', JSON.stringify(dataObj)); } 
    catch (error) { console.error("데이터 저장 실패:", error); }
}

function loadSavedSettings() {
    const data = getLocalData();
    state.startNumber = (data.startNumber !== undefined) ? Number(data.startNumber) : 0;
    state.limitNumber = (data.limitNumber !== undefined) ? Number(data.limitNumber) : 100;
    state.startYear = (data.startYear !== undefined) ? Number(data.startYear) : 0;
    state.startMonth = (data.startMonth !== undefined) ? Number(data.startMonth) : 1;
    state.limitYear = (data.limitYear !== undefined) ? Number(data.limitYear) : 99;
    state.limitMonth = (data.limitMonth !== undefined) ? Number(data.limitMonth) : 12;
    state.startGen = (data.startGen !== undefined) ? Number(data.startGen) : 1;
    state.limitGen = (data.limitGen !== undefined) ? Number(data.limitGen) : 30;
    state.outputTextSize = (data.outputTextSize !== undefined) ? Number(data.outputTextSize) : 22;
    state.ttsSpeed = (data.ttsSpeed !== undefined) ? Number(data.ttsSpeed) : 1.0;
    state.historySortIndex = (data.historySortIndex !== undefined) ? Number(data.historySortIndex) : 0;
    
    state.outputTextColor = data.outputTextColor || "#1A1A1C"; 
    state.fontFamily = data.fontFamily || "'Pretendard', 'Noto Sans KR', sans-serif"; 
    state.isBold = data.isBold === true; 
    state.selectedVoiceName = data.selectedVoiceName || null;
    state.isYearMonthMode = (data.isYearMonthMode === true);
    state.isGenerationMode = (data.isGenerationMode === true);
    state.isManualFontOverride = (data.isManualFontOverride === true);
    
    state.currentNumber = state.startNumber;
    state.currentYear = state.startYear;
    state.currentMonth = state.startMonth;
    state.currentGen = state.startGen;

    if (data.v1_3_nameList !== undefined) {
        state.nameList = JSON.parse(data.v1_3_nameList);
    } else {
        try {
            let oldList = JSON.parse(data.userNamesList || '[]');
            state.nameList = oldList.map((n, i) => ({
                uid: 'N_' + Date.now() + '_' + i, name: n, isDeleted: false
            })).filter(item => item.name.trim() !== "");
        } catch(e) { state.nameList = []; }
    }
}

function saveSettings() {
    let persistentData = getLocalData();
    persistentData.startNumber = state.startNumber; persistentData.limitNumber = state.limitNumber;
    persistentData.startYear = state.startYear; persistentData.startMonth = state.startMonth;
    persistentData.limitYear = state.limitYear; persistentData.limitMonth = state.limitMonth;
    persistentData.startGen = state.startGen; persistentData.limitGen = state.limitGen;
    persistentData.outputTextSize = state.outputTextSize; persistentData.outputTextColor = state.outputTextColor;
    persistentData.fontFamily = state.fontFamily; persistentData.isBold = state.isBold; 
    persistentData.ttsSpeed = state.ttsSpeed; persistentData.selectedVoiceName = state.selectedVoiceName;
    persistentData.isYearMonthMode = state.isYearMonthMode; persistentData.isGenerationMode = state.isGenerationMode;
    persistentData.isManualFontOverride = state.isManualFontOverride; persistentData.historySortIndex = state.historySortIndex;
    persistentData.v1_3_nameList = JSON.stringify(state.nameList);
    saveLocalData(persistentData);
}

function getNameStats(targetName) {
    let totalCount = 0; let totalSeconds = 0;
    try {
        let statsRaw = localStorage.getItem('prayer_stats_data');
        if(statsRaw) {
            let statsObj = JSON.parse(statsRaw);
            if(statsObj && statsObj.sessions) {
                statsObj.sessions.forEach(session => {
                    if(session.targetName === targetName || session.nameText === targetName) {
                        totalCount++; totalSeconds += (session.duration || 0);
                    }
                });
            }
        }
    } catch(e) {}
    return { count: totalCount, seconds: totalSeconds };
}

function formatTimeMinSec(totalSec) {
    if (totalSec === 0) return "0분";
    let h = Math.floor(totalSec / 3600); let m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
}

function formatSimpleDate(ts) {
    if (!ts || ts === 0) return "기록 없음";
    let d = new Date(ts);
    return `${d.getFullYear().toString().slice(2)}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
}

// ============================================================================
// 3. 앱 구동 및 초기화 로직
// ============================================================================
async function initApp() {
    try { loadSavedSettings(); } catch(e) { console.warn("설정 로드 실패:", e); }
    try { await loadAssetMessages(); } catch(e) { console.warn("메시지 로드 실패:", e); }
    try { await initializeTemplates(); } catch(e) { console.warn("템플릿 로드 실패:", e); }
    try { setupMainUI(); } catch(e) { console.error("UI 바인딩 오류:", e); }
    
    try {
        const inputElement = document.getElementById('edit-text-input');
        if (inputElement !== null && inputElement.value.trim() === "") {
            inputElement.value = state.firstWelcomeMsg;
        }
        startHintRolling();
        startRollingMessages();
        applyReadyStatePrayerUI();
        
        const closeModalBtn = document.getElementById('modal-btn-negative');
        if (closeModalBtn !== null) closeModalBtn.addEventListener('click', closeModal);
        const closeBottomBtn = document.getElementById('modal-btn-bottom-negative');
        if (closeBottomBtn !== null) closeBottomBtn.addEventListener('click', closeModal);
    } catch(e) {
        console.error("화면 세팅 오류:", e);
    }
}

if (document.readyState === 'loading') { document.addEventListener("DOMContentLoaded", initApp); } 
else { initApp(); }

async function loadAssetMessages() {
    try {
        const welcomeResponse = await fetch('welcome.txt');
        if (welcomeResponse.ok) {
            const welcomeText = await welcomeResponse.text();
            state.welcomeList = welcomeText.split("###").map(t => t.trim()).filter(t => t !== "");
            state.firstWelcomeMsg = state.welcomeList[0] || "";
        } else { throw new Error(); }
    } catch (error) {
        state.firstWelcomeMsg = "🙏 기도하자! V1.3.9\n환영합니다.";
        state.welcomeList = [state.firstWelcomeMsg];
    }
    try {
        const guideResponse = await fetch('guide.txt');
        if (guideResponse.ok) {
            const guideText = await guideResponse.text();
            state.guideList = guideText.split("###").map(t => t.trim()).filter(t => t !== "");
        }
    } catch (error) {}
}

async function initializeTemplates() {
    let persistentData = getLocalData();
    let existingList = [];
    try { if (persistentData.savedList) existingList = JSON.parse(persistentData.savedList); } catch (error) { existingList = []; }
    
    if (persistentData.isFirstRun === undefined || persistentData.isFirstRun === true || existingList.length === 0) {
        let templatesArray = [];
        try {
            const res = await fetch('prayer_templates.txt');
            if (res.ok) {
                const txt = await res.text();
                templatesArray = txt.split("%%").map(t => t.trim()).filter(t => t !== "");
            } else { throw new Error(); }
        } catch (error) {
            templatesArray = ["주님! <홍길동>이 [ ]살때 제사 음식 만들고 차린 죄를 회개합니다.", "주님! <외가> [ ]대가 무당 찾아가 점을 본 죄를 회개합니다."];
        }
        
        let currentTime = Date.now();
        let formattedItems = templatesArray.map((text, index) => {
            return { uid: 'P_' + (currentTime - index), text: text, addedAt: currentTime - index, lastUsed: 0, useCount: 0 };
        });
        
        persistentData.savedList = JSON.stringify(formattedItems);
        persistentData.isFirstRun = false;
        saveLocalData(persistentData);
    }
}

// ============================================================================
// 4. 메인 UI 이벤트 바인딩 및 화면 반전(Edit Mode) 제어
// ============================================================================
function safeBind(elementId, eventType, callbackFunction) {
    const targetElement = document.getElementById(elementId);
    if (targetElement !== null) { targetElement.addEventListener(eventType, callbackFunction); }
}

function updateTtsToolbarVisibility() {
    const ttsWrapper = document.getElementById('tts-tools-wrapper');
    const authorInfo = document.getElementById('author-info-text'); 
    if (ttsWrapper) {
        if (state.hasStarted === true) {
            ttsWrapper.classList.remove('hidden');
            if (authorInfo) authorInfo.style.display = 'none'; // 타이머 작동 중 배포자 텍스트 숨김
        } else {
            ttsWrapper.classList.add('hidden');
            if (authorInfo) authorInfo.style.display = 'inline'; // 대기 상태 진입 시 복구
        }
    }
}

function toggleFullscreen() {
    const topAppBar = document.getElementById('top-app-bar');
    const panelInput = document.getElementById('panel-input');
    const panelMenu = document.getElementById('panel-menu');
    const btnToggle = document.getElementById('btn-toggle-fullscreen');
    if (!topAppBar || !panelInput || !panelMenu || !btnToggle) return;

    if (topAppBar.classList.contains('hidden')) { resetFullscreen(); } 
    else {
        topAppBar.classList.add('hidden'); panelInput.classList.add('hidden'); panelMenu.classList.add('hidden');
        btnToggle.innerText = "🔽 메뉴보이기";
    }
}

function resetFullscreen() {
    const topAppBar = document.getElementById('top-app-bar');
    const panelInput = document.getElementById('panel-input');
    const panelMenu = document.getElementById('panel-menu');
    const btnToggle = document.getElementById('btn-toggle-fullscreen');
    if (topAppBar) topAppBar.classList.remove('hidden');
    if (panelInput) panelInput.classList.remove('hidden');
    if (panelMenu) panelMenu.classList.remove('hidden');
    if (btnToggle) btnToggle.innerText = "🔼 메뉴숨기기";
}

function updateEditButtonUI() {
    const btnGoEdit = document.getElementById('btn-go-edit');
    const topInput = document.getElementById('edit-text-input');
    if (btnGoEdit !== null) {
        let currentText = topInput ? topInput.value : "";
        let cleanedCurrent = currentText.replace(/\s+/g, "");
        let cleanedWelcome = state.firstWelcomeMsg.replace(/\s+/g, "");
        let isWelcomeMsg = (cleanedCurrent === cleanedWelcome || cleanedCurrent === "");
        if (state.hasStarted === true || isWelcomeMsg === false) btnGoEdit.innerText = "📝 기도문 수정";
        else btnGoEdit.innerText = "📝 기도문 신규입력";
    }
}

function enterEditMode(initialText) {
    state.isEditMode = true; originalTextBeforeEdit = initialText || "";
    if (!state.wasTimerRunningBeforeMenu) { state.wasTimerRunningBeforeMenu = state.isTimerRunning; }
    state.hasStarted = false; pauseTimer(); updateTtsToolbarVisibility(); 
    resetFullscreen();
    const btnToggle = document.getElementById('btn-toggle-fullscreen');
    if (btnToggle) btnToggle.classList.add('hidden');
    
    const topInput = document.getElementById('edit-text-input');
    const topGuideBox = document.getElementById('top-guide-box');
    const layoutTimers = document.getElementById('layout-timers');
    const headerNormal = document.getElementById('output-header-normal');
    const headerEdit = document.getElementById('output-header-edit');
    const outputNormalBox = document.getElementById('output-normal-box');
    const bottomEditInput = document.getElementById('bottom-edit-input');

    if (topInput) topInput.classList.add('hidden');
    if (layoutTimers) layoutTimers.classList.add('hidden');
    if (topGuideBox) topGuideBox.classList.remove('hidden');
    if (headerNormal) headerNormal.classList.add('hidden');
    if (headerEdit) headerEdit.classList.remove('hidden');
    if (outputNormalBox) outputNormalBox.classList.add('hidden');
    
    if (bottomEditInput) {
        bottomEditInput.classList.remove('hidden');
        bottomEditInput.value = originalTextBeforeEdit;
        bottomEditInput.style.fontFamily = state.fontFamily;
        bottomEditInput.style.fontWeight = state.isBold ? '900' : 'normal';
        bottomEditInput.style.color = state.outputTextColor;
        bottomEditInput.focus(); 
    }
    executeRoll();
}

function exitEditMode(saveTextToTop) {
    state.isEditMode = false;
    const topInput = document.getElementById('edit-text-input');
    const topGuideBox = document.getElementById('top-guide-box');
    const headerNormal = document.getElementById('output-header-normal');
    const headerEdit = document.getElementById('output-header-edit');
    const outputNormalBox = document.getElementById('output-normal-box');
    const bottomEditInput = document.getElementById('bottom-edit-input');

    if (saveTextToTop && topInput && bottomEditInput) topInput.value = bottomEditInput.value;

    if (topInput) topInput.classList.remove('hidden');
    if (topGuideBox) topGuideBox.classList.add('hidden');
    if (headerNormal) headerNormal.classList.remove('hidden');
    if (headerEdit) headerEdit.classList.add('hidden');
    if (outputNormalBox) outputNormalBox.classList.remove('hidden');
    if (bottomEditInput) bottomEditInput.classList.add('hidden');

    let currentText = topInput ? topInput.value : "";
    autoDetectModeFromText(currentText);
    applyReadyStatePrayerUI();
    updateTtsToolbarVisibility();
    
    if (state.wasTimerRunningBeforeMenu) {
        startTimer(); state.wasTimerRunningBeforeMenu = false;
    }
}

function setupMainUI() {
    const topInputEl = document.getElementById('edit-text-input');
    const bottomInputEl = document.getElementById('bottom-edit-input');

    safeBind('btn-toggle-fullscreen', 'click', toggleFullscreen);

    if (topInputEl !== null) { topInputEl.addEventListener('focus', function() { enterEditMode(topInputEl.value); topInputEl.blur(); }); }

    safeBind('btn-go-edit', 'click', function() {
        if (topInputEl !== null) {
            let currentText = topInputEl.value; let cleanedCurrent = currentText.replace(/\s+/g, ""); let cleanedWelcome = state.firstWelcomeMsg.replace(/\s+/g, "");
            let isWelcomeMsg = (cleanedCurrent === cleanedWelcome || cleanedCurrent === "");
            if (state.hasStarted === true || isWelcomeMsg === false) enterEditMode(topInputEl.value); else enterEditMode(""); 
        }
    });

    // ★ [V1.3.9 핫픽스 방어막] 긴 문장을 쪼개서 조립 (Line-wrap 에러 원천 차단)
    safeBind('btn-edit-clear-text', 'click', function() { 
        if (bottomInputEl) { 
            const msgBox = createEl('div', 'text-align:center; padding:10px 0; font-size:15px; color:#1A1A1C; line-height:1.5;'); 
            let msgStr = "입력된 내용을 모두 ";
            msgStr += "지우시겠습니까?";
            msgBox.innerHTML = msgStr; 
            showCustomDialogWithFooter("창 지우기 확인", msgBox, "지우기", function() { 
                bottomInputEl.value = ""; bottomInputEl.focus(); closeModal(); 
            }); 
        } 
    });

    safeBind('btn-edit-save-new', 'click', function() { 
        if (bottomInputEl) { 
            const newText = bottomInputEl.value.trim();
            if (newText === "") {
                let warnStr = "⚠️ 입력된 내용이 없습니다.<br>";
                warnStr += "기도문을 먼저 작성해 주세요.";
                showSimpleBottomDialog("저장 실패", warnStr);
                return;
            }
            saveToHistory(newText); 
            exitEditMode(true); 
            let succStr = "✨ 새로운 기도문으로<br>";
            succStr += "저장되었습니다.";
            showSimpleBottomDialog("새로 저장 완료", succStr);
        } 
    });

    safeBind('btn-edit-save-update', 'click', function() { 
        if (bottomInputEl) { 
            const newText = bottomInputEl.value.trim();
            if (newText === "") {
                let warnStr = "⚠️ 입력된 내용이 없습니다.<br>";
                warnStr += "기도문을 먼저 작성해 주세요.";
                showSimpleBottomDialog("저장 실패", warnStr);
                return;
            }
            updateHistoryItem(originalTextBeforeEdit, newText); 
            exitEditMode(true); 
            let succStr = "💾 수정된 내용이 안전하게<br>";
            succStr += "덮어쓰기 되었습니다.";
            showSimpleBottomDialog("수정 저장 완료", succStr);
        } 
    });

    safeBind('btn-edit-close', 'click', function() { exitEditMode(true); });

    safeBind('btn-tts-toggle', 'click', toggleTts);
    safeBind('btn-tts-settings', 'click', showTtsSettingsDialog);
    safeBind('btn-tts-stop', 'click', function() {
        if (synthesis !== null) synthesis.cancel();
        if (state.isTtsEnabled === true) { state.isTtsEnabled = false; refreshTtsButtonUI(); }
    });
    
    const attachPauseToMenu = (btnId, callback) => {
        safeBind(btnId, 'click', () => { 
            state.wasTimerRunningBeforeMenu = state.isTimerRunning;
            pauseTimer(); 
            callback(); 
        });
    };

    attachPauseToMenu('btn-history', function() {
        let list = getPrayerList();
        if (list.length === 0) showEmptyHistoryDialog(); else showHistoryListDialog();
    });
    attachPauseToMenu('btn-management', showManagementDialog);
    attachPauseToMenu('btn-setting-name', showNameSettingDialog);
    attachPauseToMenu('btn-setting-number', showAgeSettingDialog);
    attachPauseToMenu('btn-setting-font', showFontDialog);
    
    attachPauseToMenu('btn-menu-stats', function() {
        const container = createEl('div', 'width:100%; display:flex; flex-direction:column; height:100%;');
        const tabRow = createEl('div', 'display:flex; background:#E8EBEF; border-radius:10px; padding:4px; margin-bottom:16px; flex-shrink:0;');
        const btnTab1 = createEl('button', 'flex:1; background:#FFFFFF; color:#007AFF; border:none; padding:10px 0; font-size:13px; font-weight:bold; border-radius:8px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.05); transition:all 0.2s;', '나의 목표');
        const btnTab2 = createEl('button', 'flex:1; background:transparent; color:#8E8E93; border:none; padding:10px 0; font-size:13px; font-weight:bold; border-radius:8px; cursor:pointer; transition:all 0.2s;', '심층 분석');
        tabRow.appendChild(btnTab1); tabRow.appendChild(btnTab2); container.appendChild(tabRow);
        
        const tabContent1 = createEl('div', 'flex:1; overflow-y:auto;'); tabContent1.id = 'tab-summary';
        const tabContent2 = createEl('div', 'flex:1; overflow-y:auto; display:none;'); tabContent2.id = 'tab-detail';
        container.appendChild(tabContent1); container.appendChild(tabContent2);
        
        btnTab1.onclick = () => { btnTab1.style.background = '#FFFFFF'; btnTab1.style.color = '#007AFF'; btnTab1.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; btnTab2.style.background = 'transparent'; btnTab2.style.color = '#8E8E93'; btnTab2.style.boxShadow = 'none'; tabContent1.style.display = 'block'; tabContent2.style.display = 'none'; };
        btnTab2.onclick = () => { btnTab2.style.background = '#FFFFFF'; btnTab2.style.color = '#007AFF'; btnTab2.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; btnTab1.style.background = 'transparent'; btnTab1.style.color = '#8E8E93'; btnTab1.style.boxShadow = 'none'; tabContent2.style.display = 'block'; tabContent1.style.display = 'none'; };
        showCustomDialog("📊 기도 통계 자료", container, null, null, true); 
        
        if(typeof window.renderStatsDashboard === 'function') { setTimeout(window.renderStatsDashboard, 150); } 
        else { tabContent1.innerHTML = `<div style='padding:20px; text-align:center;'>통계 엔진(stats.js) 파일이 누락되었습니다.</div>`; }
    });

    attachPauseToMenu('btn-exit', showExitConfirmDialog);
    safeBind('btn-next', 'click', onNextStepClicked);
    safeBind('btn-once-more', 'click', handleRestartAction);
    safeBind('btn-previous', 'click', handlePreviousAction);
    safeBind('btn-timer-resume', 'click', function(e) { e.stopPropagation(); startTimer(); });
    safeBind('btn-timer-pause', 'click', function(e) { e.stopPropagation(); pauseTimer(); });
    safeBind('btn-timer-stop', 'click', function(e) {
        e.stopPropagation(); pauseTimer(); state.hasStarted = false; 
        const timerLayout = document.getElementById('layout-timers'); const topInput = document.getElementById('edit-text-input');
        if (timerLayout) timerLayout.classList.add('hidden'); if (topInput && !state.isEditMode) topInput.classList.remove('hidden');
        resetFullscreen(); const btnToggle = document.getElementById('btn-toggle-fullscreen'); if (btnToggle) btnToggle.classList.add('hidden');
        applyReadyStatePrayerUI(); updateTtsToolbarVisibility(); 
    });
    safeBind('layout-timers', 'click', showTimerMenuDialog);
}

function refreshTtsButtonUI() {
    const ttsBtn = document.getElementById('btn-tts-toggle'); const ttsStopBtn = document.getElementById('btn-tts-stop');
    if (ttsBtn === null) return;
    if (state.isTtsEnabled === true) {
        ttsBtn.innerText = "🔊 TTS 음성읽기 : ON"; ttsBtn.classList.remove('bg-gray'); ttsBtn.classList.add('bg-green'); ttsBtn.style.color = "#FFFFFF";
        if (ttsStopBtn) ttsStopBtn.classList.remove('hidden'); 
    } else {
        ttsBtn.innerText = "🔇 TTS 음성읽기 : OFF"; ttsBtn.classList.remove('bg-green'); ttsBtn.classList.add('bg-gray'); ttsBtn.style.color = "#495057";
        if (ttsStopBtn) ttsStopBtn.classList.add('hidden'); 
    }
}

// ============================================================================
// 5. 기도 핵심 진행 로직
// ============================================================================
function autoDetectModeFromText(textContent) {
    const containsAgeFormat = /\[\s*\d*\s*\]\s*살/.test(textContent);
    const containsGenerationFormat = /\[\s*\d*\s*\]\s*대/.test(textContent);
    
    if (containsGenerationFormat === true && containsAgeFormat === false) {
        state.isGenerationMode = true; state.isYearMonthMode = false; state.currentGen = state.startGen;
    } else if (containsAgeFormat === true) {
        state.isGenerationMode = false; state.currentNumber = state.startNumber; state.currentYear = state.startYear; state.currentMonth = state.startMonth;
    }
    saveSettings();
}

function onNextStepClicked() {
    if (state.isEditMode) exitEditMode(true);
    const inputElement = document.getElementById('edit-text-input'); const timerLayoutElement = document.getElementById('layout-timers');
    if (inputElement === null) return;
    const cleanedContent = inputElement.value.replace(/\s+/g, ""); const cleanedWelcome = state.firstWelcomeMsg.replace(/\s+/g, "");
    
    if (cleanedContent === "" || cleanedContent === cleanedWelcome) {
        showSimpleBottomDialog("경고", "⚠️ 먼저 기도문을 입력하시거나, 기도문목록에서 기도를 불러와주세요."); return;
    }

    if (state.hasStarted === true && typeof window.recordPrayerData === 'function') {
        let activeNameInfo = getActiveUserNameObj();
        let session = { nameUID: activeNameInfo.uid, nameText: activeNameInfo.name, prayerUID: state.currentPrayerUID, prayerText: inputElement.value.substring(0, 30) };
        window.recordPrayerData(session, state.secondsCurrent);
    }
    
    if (timerLayoutElement !== null && timerLayoutElement.classList.contains('hidden') === true) {
        timerLayoutElement.classList.remove('hidden'); inputElement.classList.add('hidden'); autoDetectModeFromText(inputElement.value);
    }

    if (state.hasStarted === true) { if (increaseCounter() === false) return; } else { state.hasStarted = true; }
    state.secondsCurrent = 0; startTimer(); updateDisplay();
}

function handlePreviousAction() { if (state.hasStarted === true) { if (decreaseCounter() === true) updateDisplay(); } }
function handleRestartAction() {
    if (state.isGenerationMode === true) state.currentGen = state.startGen;
    else { state.currentNumber = state.startNumber; state.currentYear = state.startYear; state.currentMonth = state.startMonth; }
    resetCurrentTimer(); startTimer(); updateDisplay();
}

function increaseCounter() {
    if (state.isGenerationMode === true) {
        if (state.currentGen >= state.limitGen) { showSimpleBottomDialog("안내", "🏁 목표 조상 대(代)에 도달했습니다."); return false; }
        state.currentGen++;
    } else if (state.isYearMonthMode === true) {
        if (state.currentYear > state.limitYear || (state.currentYear === state.limitYear && state.currentMonth >= state.limitMonth)) { showSimpleBottomDialog("안내", "🏁 목표 나이에 도달했습니다."); return false; }
        state.currentMonth++;
        if (state.currentYear === 0 && state.currentMonth > 10) { state.currentMonth = 1; state.currentYear++; } else if (state.currentMonth > 12) { state.currentMonth = 1; state.currentYear++; }
    } else {
        if (state.currentNumber >= state.limitNumber) { showSimpleBottomDialog("안내", "🏁 목표 나이에 도달했습니다."); return false; }
        state.currentNumber++;
    }
    return true;
}

function decreaseCounter() {
    if (state.isGenerationMode === true) {
        if (state.currentGen <= state.startGen) { showSimpleBottomDialog("안내", "🏁 시작 지점입니다."); return false; }
        state.currentGen--;
    } else if (state.isYearMonthMode === true) {
        if (state.currentYear <= state.startYear && state.currentMonth <= state.startMonth) { showSimpleBottomDialog("안내", "🏁 시작 지점입니다."); return false; }
        state.currentMonth--;
        if (state.currentMonth < 1) { if (state.currentYear > 0) { state.currentYear--; state.currentMonth = 12; } else { state.currentMonth = 1; } }
    } else {
        if (state.currentNumber <= state.startNumber) { showSimpleBottomDialog("안내", "🏁 시작 지점입니다."); return false; }
        state.currentNumber--;
    }
    return true;
}

// ============================================================================
// 6. 렌더링 및 텍스트 롤링/치환
// ============================================================================
function startHintRolling() {
    if (hintInterval !== null) clearInterval(hintInterval);
    hintInterval = setInterval(function() {
        const topInput = document.getElementById('edit-text-input'); const bottomInput = document.getElementById('bottom-edit-input');
        let newHint = state.hintsList[state.hintIndex];
        if (topInput !== null && topInput.value.trim() === "") topInput.placeholder = newHint;
        if (bottomInput !== null && bottomInput.value.trim() === "") bottomInput.placeholder = newHint;
        state.hintIndex = (state.hintIndex + 1) % state.hintsList.length;
    }, 3500);
}
function startRollingMessages() {
    if (rollInterval !== null) clearInterval(rollInterval);
    rollInterval = setInterval(executeRoll, 10000);
}
function executeRoll() {
    state.currentRollIndex++;
    if (state.isEditMode) {
        const topGuideText = document.getElementById('top-guide-text');
        if (topGuideText) { let rollingMessage = state.guideList[state.currentRollIndex % state.guideList.length] || ""; topGuideText.innerHTML = rollingMessage.replace(/\n/g, "<br>"); }
    } else { applyReadyStatePrayerUI(); }
}

function applyReadyStatePrayerUI() {
    if (state.isEditMode) return;
    updateEditButtonUI(); updateTtsToolbarVisibility(); 
    const outputElement = document.getElementById('text-output'); const scrollBox = document.querySelector('.output-scroll-box'); const inputElement = document.getElementById('edit-text-input'); const btnToggle = document.getElementById('btn-toggle-fullscreen');
    if (outputElement === null || inputElement === null) return;

    const rawContent = inputElement.value; const cleanedContent = rawContent.replace(/\s+/g, ""); const cleanedWelcomeMsg = state.firstWelcomeMsg.replace(/\s+/g, "");
    const timerLayout = document.getElementById('layout-timers');
    if (state.hasStarted === false) {
        if (timerLayout !== null) timerLayout.classList.add('hidden'); if (btnToggle !== null) btnToggle.classList.add('hidden'); resetFullscreen();
    }

    if (cleanedContent === "" || cleanedContent === cleanedWelcomeMsg || rawContent.includes("다음단계]를 누르세요")) {
        if (scrollBox !== null) { scrollBox.style.justifyContent = "center"; scrollBox.style.alignItems = "center"; }
        let welcomeText = state.welcomeList.length > 0 ? state.welcomeList[state.currentRollIndex % state.welcomeList.length] : "환영합니다.";
        welcomeText = welcomeText.replace(/\[다음단계\]/g, `<span style="color:#34C759; font-weight:800; font-size:1.2em;">[다음단계]</span>`);
        outputElement.innerHTML = `<div style="text-align:center; color:#495057; font-size:16px;">${welcomeText.replace(/\n/g, "<br>")}</div>`; return;
    }

    if (scrollBox !== null) { scrollBox.style.justifyContent = "flex-start"; scrollBox.style.alignItems = "stretch"; }
    
    let activeUserName = getActiveUserName(); let parsedText = rawContent; let isEditing = false; 
    parsedText = parsedText.replace(/<([^>]+)>\s*([이가])?/g, function(match, namePlaceholder, particle) {
        let nameToUse = (activeUserName.trim() !== "") ? activeUserName : (namePlaceholder || ""); let hasJong = hasJongseong(nameToUse); let correctParticle = particle ? (hasJong ? "이" : "가") : "";
        let finalString = nameToUse + correctParticle; if (isEditing === false) return `<span style="color:#007AFF; font-weight:800;">${finalString}</span>`; return finalString;
    });

    if (state.isGenerationMode === true) {
        let targetGenWord = `${getSinoKoreanNumber(state.currentGen)}대`; let numberGenWord = `${state.currentGen}대`;
        let spanTpl1 = (isEditing === false) ? `<span style="color:#FF3B30; font-weight:800;">${targetGenWord}</span>` : targetGenWord; let spanTpl2 = (isEditing === false) ? `<span style="color:#FF3B30; font-weight:800;">${numberGenWord}</span>` : numberGenWord;
        parsedText = parsedText.replace(/\[\s*\d*\s*\]\s*대/g, spanTpl1); parsedText = parsedText.replace(/\[\s*\d*\s*\]/g, spanTpl2);
    } else {
        let targetAge = (state.isYearMonthMode === true) ? state.currentYear : state.currentNumber; let nativeAgeString = getNativeKoreanAge(targetAge); let targetWord = ""; let numWordStr = "";
        if (state.isYearMonthMode === true) { targetWord = (targetAge === 0) ? `태아 ${state.currentMonth}개월` : `${nativeAgeString}살 ${state.currentMonth}개월`; numWordStr = (targetAge === 0) ? `태아 ${state.currentMonth}개월` : `${targetAge}살 ${state.currentMonth}개월`; } 
        else { targetWord = (targetAge === 0) ? "태아" : `${nativeAgeString}살`; numWordStr = (targetAge === 0) ? "태아" : `${targetAge}살`; }
        let spanTpl1 = (isEditing === false) ? `<span style="color:#FF3B30; font-weight:800;">${targetWord}</span>` : targetWord; let spanTpl2 = (isEditing === false) ? `<span style="color:#FF3B30; font-weight:800;">${numWordStr}</span>` : numWordStr;
        parsedText = parsedText.replace(/\[\s*\d*\s*\]\s*살/g, spanTpl1); parsedText = parsedText.replace(/\[\s*\d*\s*\]/g, spanTpl2);
    }

    let guidePrefix = "";
    if (state.hasStarted === false && rawContent !== state.firstWelcomeMsg) { guidePrefix = `<span style="color:#FF3B30; font-weight:bold; display:block; margin-bottom:10px;">[다음단계] 버튼을 눌러주세요</span>`; }
    outputElement.innerHTML = guidePrefix + parsedText.replace(/\n/g, "<br>");
    outputElement.style.color = state.outputTextColor; outputElement.style.fontSize = state.outputTextSize + "px"; outputElement.style.fontFamily = state.fontFamily; outputElement.style.fontWeight = state.isBold ? '900' : 'normal';
}

function updateDisplay() {
    updateEditButtonUI(); updateTtsToolbarVisibility(); 
    const btnToggle = document.getElementById('btn-toggle-fullscreen');
    if (state.hasStarted === true && state.isEditMode === false) { if (btnToggle) btnToggle.classList.remove('hidden'); }
    const inputElement = document.getElementById('edit-text-input'); if (inputElement === null) return;
    
    applyReadyStatePrayerUI();

    if (state.isTtsEnabled === true) {
        let activeUserName = getActiveUserName(); let textToRead = inputElement.value;
        textToRead = textToRead.replace(/<([^>]+)>\s*([이가])?/g, function(match, namePlaceholder, particle) {
            let nameToUse = (activeUserName.trim() !== "") ? activeUserName : (namePlaceholder || ""); let hasJong = hasJongseong(nameToUse); return nameToUse + (particle ? (hasJong ? "이" : "가") : "");
        });

        if (state.isGenerationMode === true) {
            textToRead = textToRead.replace(/\[\s*\d*\s*\]\s*대/g, `${getSinoKoreanNumber(state.currentGen)}대`); textToRead = textToRead.replace(/\[\s*\d*\s*\]/g, `${state.currentGen}대`);
        } else {
            let targetAge = (state.isYearMonthMode === true) ? state.currentYear : state.currentNumber; let nativeAgeString = getNativeKoreanAge(targetAge);
            let targetWord = (state.isYearMonthMode === true) ? ((targetAge === 0) ? `태아 ${state.currentMonth}개월` : `${nativeAgeString}살 ${state.currentMonth}개월`) : ((targetAge === 0) ? "태아" : `${nativeAgeString}살`);
            let numWordStr = (state.isYearMonthMode === true) ? ((targetAge === 0) ? `태아 ${state.currentMonth}개월` : `${targetAge}살 ${state.currentMonth}개월`) : ((targetAge === 0) ? "태아" : `${targetAge}살`);
            textToRead = textToRead.replace(/\[\s*\d*\s*\]\s*살/g, targetWord); textToRead = textToRead.replace(/\[\s*\d*\s*\]/g, numWordStr);
        }
        
        if (synthesis !== null) {
            synthesis.cancel(); let utterance = new SpeechSynthesisUtterance(textToRead); utterance.rate = state.ttsSpeed;
            let voiceList = synthesis.getVoices(); let selectedVoice = voiceList.find(voice => voice.name === state.selectedVoiceName);
            if (selectedVoice !== undefined) utterance.voice = selectedVoice; synthesis.speak(utterance);
        }
    }
}

// ============================================================================
// 7. 스마트 타이머 및 오토세이브 제어 로직 
// ============================================================================
function startTimer() {
    if (state.isTimerRunning === false) {
        state.isTimerRunning = true; timerInterval = setInterval(timerRunnable, 1000);
        if (!state.autoSaveInterval) {
            state.autoSaveInterval = setInterval(() => { if (state.isTimerRunning) { localStorage.setItem('v1_3_autosave', JSON.stringify({ timeCurrent: state.secondsCurrent, timeTotal: state.secondsTotal, target: getActiveUserNameObj().name, timestamp: Date.now() })); } }, 10000);
        }
        const btnResume = document.getElementById('btn-timer-resume'); const btnPause = document.getElementById('btn-timer-pause');
        if (btnResume) btnResume.classList.add('hidden'); if (btnPause) btnPause.classList.remove('hidden');
    }
}
function pauseTimer() {
    state.isTimerRunning = false; clearInterval(timerInterval);
    if (state.autoSaveInterval) { clearInterval(state.autoSaveInterval); state.autoSaveInterval = null; }
    if (synthesis !== null) synthesis.cancel();
    const btnResume = document.getElementById('btn-timer-resume'); const btnPause = document.getElementById('btn-timer-pause');
    if (btnResume) btnResume.classList.remove('hidden'); if (btnPause) btnPause.classList.add('hidden');
    let btnNext = document.getElementById('btn-next'); if (btnNext) btnNext.innerText = `다음 단계 ▶`;
}
function timerRunnable() {
    if (state.isTimerRunning === true) {
        state.secondsCurrent++; state.secondsTotal++; updateTimerUI();
        if (state.secondsCurrent >= 120) {
            pauseTimer(); showSimpleBottomDialog("타이머 일시정지", "⏳ 2분이 경과하여 통계 오류 방지를 위해 타이머가 자동 일시정지 되었습니다.<br>다시 [다음 단계]를 누르시면 이어집니다.");
            let timerCurrentEl = document.getElementById('text-timer-current'); if (timerCurrentEl !== null) { timerCurrentEl.innerText = "02:00 (정지)"; timerCurrentEl.style.color = "#FF3B30"; }
        }
    }
}
function updateTimerUI() {
    const padFormat = (num) => String(num).padStart(2, '0');
    let currentHours = Math.floor(state.secondsCurrent / 3600); let currentMinutes = Math.floor((state.secondsCurrent % 3600) / 60); let currentSecs = state.secondsCurrent % 60;
    let totalHours = Math.floor(state.secondsTotal / 3600); let totalMinutes = Math.floor((state.secondsTotal % 3600) / 60); let totalSecs = state.secondsTotal % 60;
    let timerCurrentEl = document.getElementById('text-timer-current');
    if (timerCurrentEl !== null) { timerCurrentEl.innerText = `${padFormat(currentHours)}:${padFormat(currentMinutes)}:${padFormat(currentSecs)}`; timerCurrentEl.style.color = "#007AFF"; }
    let timerTotalEl = document.getElementById('text-timer-total'); if (timerTotalEl !== null) timerTotalEl.innerText = `누적 ${padFormat(totalHours)}:${padFormat(totalMinutes)}:${padFormat(totalSecs)}`;
    let btnNext = document.getElementById('btn-next');
    if (btnNext) { if (state.isTimerRunning && state.secondsCurrent > 0) { btnNext.innerText = `다음 단계 ▶ (${state.secondsCurrent}초)`; } else { btnNext.innerText = `다음 단계 ▶`; } }
}
function resetCurrentTimer() { state.secondsCurrent = 0; updateTimerUI(); let btnNext = document.getElementById('btn-next'); if (btnNext) btnNext.innerText = `다음 단계 ▶`; }

// ============================================================================
// 8. 언어 변환 유틸리티 
// ============================================================================
function getNativeKoreanAge(ageNumber) {
    if (ageNumber === 0) return "태아"; if (ageNumber >= 100) return getSinoKoreanNumber(ageNumber) + "살";
    const tensArray = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"]; const unitsArray = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"];
    if (ageNumber === 20) return "스무"; const tensPosition = Math.floor(ageNumber / 10); const unitsPosition = ageNumber % 10;
    if (tensPosition === 0) return unitsArray[unitsPosition]; if (unitsPosition === 0) return tensArray[tensPosition]; return tensArray[tensPosition] + unitsArray[unitsPosition];
}
function getSinoKoreanNumber(num) {
    if (num === 0) return "영"; if (num >= 1000) return num.toString();
    const units = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"]; const tens = ["", "십", "이십", "삼십", "사십", "오십", "육십", "칠십", "팔십", "구십"]; const hundreds = ["", "백", "이백", "삼백", "사백", "오백", "육백", "칠백", "팔백", "구백"];
    const h = Math.floor(num / 100); const t = Math.floor((num % 100) / 10); const u = num % 10;
    let resultString = hundreds[h]; if (t === 1 && h === 0) resultString += "십"; else resultString += tens[t]; resultString += units[u]; return resultString;
}
function hasJongseong(textString) {
    if (!textString || textString.length === 0) return false; const charCode = textString.charCodeAt(textString.length - 1);
    if (charCode < 0xAC00 || charCode > 0xD7A3) return false; return (charCode - 0xAC00) % 28 > 0;
}
function getActiveUserNameObj() {
    let persistentData = getLocalData(); let activeIndex = persistentData.activeNameIndex || 0;
    if (activeIndex === 0 || state.nameList.length === 0) return { uid: 'N_DEFAULT', name: "" };
    let activeItem = state.nameList[activeIndex - 1]; if (activeItem) return activeItem; return { uid: 'N_DEFAULT', name: "" };
}
function getActiveUserName() { return getActiveUserNameObj().name; }

function toggleTts() {
    if (state.isTtsEnabled === true) { state.isTtsEnabled = false; refreshTtsButtonUI(); if (synthesis !== null) synthesis.cancel(); } 
    else {
        const container = createEl('div', 'text-align:center; padding:10px 0; font-size:16px; color:#1A1A1C; line-height:1.5;'); container.innerHTML = "자동으로 기도문을 소리내어<br>읽어드릴까요?";
        showCustomDialogWithFooter("🗣️ 음성 읽기", container, "저장(적용)", function() { state.isTtsEnabled = true; refreshTtsButtonUI(); updateDisplay(); closeModal(); });
    }
}
function speakPreview() {
    if (synthesis === null) return; synthesis.cancel(); let previewUtterance = new SpeechSynthesisUtterance("회개하자, 회개기도문 미리듣기 입니다"); previewUtterance.rate = state.ttsSpeed;
    let voicesArray = synthesis.getVoices(); let voiceToUse = voicesArray.find(v => v.name === state.selectedVoiceName);
    if (voiceToUse !== undefined) previewUtterance.voice = voiceToUse; synthesis.speak(previewUtterance);
}

// ============================================================================
// 9. 안드로이드 머티리얼 모달 엔진 및 실시간 갱신(Real-Time Apply)
// ============================================================================
function showCustomDialog(titleText, contentDomElement, positiveBtnText, onPositiveClickCallback, isLargeModal = false) {
    const overlayElement = document.getElementById('modal-overlay'); const dialogBox = document.querySelector('.dialog-box'); if (!overlayElement || !dialogBox) return;
    if (isLargeModal) dialogBox.classList.add('large-modal'); else dialogBox.classList.remove('large-modal');
    document.getElementById('modal-title').innerText = titleText;
    const bodyElement = document.getElementById('modal-content'); bodyElement.innerHTML = ''; bodyElement.appendChild(contentDomElement);
    
    document.getElementById('modal-header-actions').classList.remove('hidden'); document.getElementById('modal-divider-top').classList.remove('hidden'); 
    document.getElementById('modal-divider-bottom').classList.add('hidden'); document.getElementById('modal-footer-actions').classList.add('hidden');
    
    const positiveBtn = document.getElementById('modal-btn-positive'); const negativeBtn = document.getElementById('modal-btn-negative'); 
    if (negativeBtn) negativeBtn.innerText = "닫기(취소)";
    if (positiveBtnText && onPositiveClickCallback) { positiveBtn.innerText = positiveBtnText; positiveBtn.classList.remove('hidden'); positiveBtn.onclick = onPositiveClickCallback; } else { if (positiveBtn) positiveBtn.classList.add('hidden'); }
    overlayElement.classList.remove('hidden');
}

function showCustomDialogWithFooter(titleText, contentDomElement, positiveBtnText, onPositiveClickCallback) {
    const overlayElement = document.getElementById('modal-overlay'); const dialogBox = document.querySelector('.dialog-box'); if (!overlayElement || !dialogBox) return;
    dialogBox.classList.remove('large-modal'); document.getElementById('modal-title').innerText = titleText;
    const bodyElement = document.getElementById('modal-content'); bodyElement.innerHTML = ''; bodyElement.appendChild(contentDomElement);
    
    document.getElementById('modal-header-actions').classList.add('hidden'); document.getElementById('modal-divider-top').classList.add('hidden'); 
    document.getElementById('modal-divider-bottom').classList.remove('hidden'); document.getElementById('modal-footer-actions').classList.remove('hidden');
    
    const footerNegBtn = document.getElementById('modal-btn-bottom-negative'); const footerPosBtn = document.getElementById('modal-btn-bottom-positive'); 
    if (footerNegBtn) footerNegBtn.innerText = "닫기(취소)";
    if (positiveBtnText && onPositiveClickCallback) { footerPosBtn.innerText = positiveBtnText; footerPosBtn.classList.remove('hidden'); footerPosBtn.onclick = onPositiveClickCallback; } else { if (footerPosBtn) footerPosBtn.classList.add('hidden'); }
    overlayElement.classList.remove('hidden');
}

function showSimpleBottomDialog(titleStr, messageStr) {
    const container = createEl('div', 'text-align:center; padding:10px 0; font-size:15px; color:#1A1A1C; line-height:1.5;'); 
    container.innerHTML = messageStr; 
    showCustomDialogWithFooter(titleStr, container, null, null);
}

function closeModal() {
    const overlayElement = document.getElementById('modal-overlay'); if (overlayElement !== null) overlayElement.classList.add('hidden');
    if (state.wasTimerRunningBeforeMenu) { startTimer(); state.wasTimerRunningBeforeMenu = false; }
}

function closeModalSilently() {
    const overlayElement = document.getElementById('modal-overlay'); if (overlayElement !== null) overlayElement.classList.add('hidden');
}

function createEl(tagName, cssText, innerHTMLText) {
    const element = document.createElement(tagName); if (cssText) element.style.cssText = "box-sizing: border-box; " + cssText; if (innerHTMLText) element.innerHTML = innerHTMLText; return element;
}

// ============================================================================
// 10. 각종 설정 팝업 제어 함수
// ============================================================================
function showFontDialog() {
    const container = document.createElement('div'); container.style.cssText = "width: 100%; box-sizing: border-box;";
    let tempSize = state.outputTextSize || 22; let tempColor = state.outputTextColor || "#1A1A1C"; let tempFont = state.fontFamily || "'Pretendard', 'Noto Sans KR', sans-serif"; let tempBold = state.isBold || false;
    const previewBox = createEl('div', 'height:130px; overflow-y:auto; padding:16px; background:#F8F9FA; border-radius:12px; margin-bottom:20px; display:flex; align-items:center; justify-content:center; border:1px solid #E9ECEF;');
    const previewText = createEl('div', `font-size:${tempSize}px; color:${tempColor}; font-family:${tempFont}; font-weight:${tempBold ? '900' : 'normal'}; line-height:1.4; transition:all 0.2s; word-break:keep-all; text-align:center;`, '주님, 제가 지은 죄를 회개합니다.');
    previewBox.appendChild(previewText); container.appendChild(previewBox);

    const updatePreview = () => { previewText.style.fontSize = tempSize + 'px'; previewText.style.color = tempColor; previewText.style.fontFamily = tempFont; previewText.style.fontWeight = tempBold ? '900' : 'normal'; };
    const sizeBoldRow = createEl('div', 'display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:10px;');
    const sizeCtrl = createEl('div', 'display:flex; align-items:center; background:#F8F9FA; border-radius:12px; padding:4px; flex:1;');
    const btnMinus = createEl('button', 'padding:10px 16px; border:none; background:none; cursor:pointer; font-size:16px;', '➖'); const btnPlus = createEl('button', 'padding:10px 16px; border:none; background:none; cursor:pointer; font-size:16px;', '➕');
    const inputSize = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:18px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;'); inputSize.type = 'number'; inputSize.value = tempSize;
    btnMinus.onclick = () => { if(tempSize > 10) { tempSize--; inputSize.value = tempSize; updatePreview(); } }; btnPlus.onclick = () => { if(tempSize < 100) { tempSize++; inputSize.value = tempSize; updatePreview(); } };
    sizeCtrl.appendChild(btnMinus); sizeCtrl.appendChild(inputSize); sizeCtrl.appendChild(btnPlus);
    const btnBold = createEl('button', `padding:12px 16px; border-radius:12px; border:none; font-weight:bold; font-size:14px; cursor:pointer; flex-shrink:0; transition:all 0.2s; background:${tempBold ? '#007AFF' : '#E8EBEF'}; color:${tempBold ? 'white' : '#495057'};`, '굵게(Bold)');
    btnBold.onclick = () => { tempBold = !tempBold; btnBold.style.background = tempBold ? '#007AFF' : '#E8EBEF'; btnBold.style.color = tempBold ? 'white' : '#495057'; updatePreview(); };
    sizeBoldRow.appendChild(sizeCtrl); sizeBoldRow.appendChild(btnBold); container.appendChild(createEl('div', 'font-weight:bold; font-size:14px; margin-bottom:8px; color:#8E8E93;', '글자 크기 및 굵기')); container.appendChild(sizeBoldRow);

    container.appendChild(createEl('div', 'font-weight:bold; font-size:14px; margin-bottom:8px; color:#8E8E93;', '글꼴 (6종)'));
    const fontGrid = createEl('div', 'display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:20px;');
    const fontOptions = [
        { name: '기본 고딕', val: "'Pretendard', 'Noto Sans KR', sans-serif" }, { name: '나눔 바른고딕', val: "'Nanum Gothic', sans-serif" }, { name: '나눔 명조', val: "'Nanum Myeongjo', serif" },
        { name: '마루 부리', val: "'Gowun Batang', serif" }, { name: '본명조', val: "'Noto Serif KR', serif" }, { name: '주아체', val: "'Jua', sans-serif" }
    ];
    const fontBtns = [];
    fontOptions.forEach(f => {
        const isSelected = tempFont.includes(f.val.split(',')[0].replace(/'/g, ''));
        const fBtn = createEl('button', `padding:12px 8px; border-radius:8px; border:1px solid ${isSelected ? '#007AFF' : '#E9ECEF'}; background:${isSelected ? '#E8F3FF' : '#FFFFFF'}; color:${isSelected ? '#007AFF' : '#1A1A1C'}; font-weight:bold; font-size:15px; font-family:${f.val}; cursor:pointer; transition:all 0.2s;`, f.name);
        fBtn.onclick = () => { tempFont = f.val; fontBtns.forEach(b => { b.style.borderColor='#E9ECEF'; b.style.background='#FFFFFF'; b.style.color='#1A1A1C'; }); fBtn.style.borderColor='#007AFF'; fBtn.style.background='#E8F3FF'; fBtn.style.color='#007AFF'; updatePreview(); };
        fontBtns.push(fBtn); fontGrid.appendChild(fBtn);
    }); container.appendChild(fontGrid);

    container.appendChild(createEl('div', 'font-weight:bold; font-size:14px; margin-bottom:8px; color:#8E8E93;', '글자 색상 테마'));
    const colorRow = createEl('div', 'display:flex; gap:8px; margin-bottom:10px;');
    const colorThemes = [ ["기본", "#1A1A1C"], ["블루", "#007AFF"], ["그린", "#34C759"], ["퍼플", "#5856D6"] ];
    const colorBtns = [];
    colorThemes.forEach(c => {
        const isSelected = tempColor === c[1];
        const cBtn = createEl('button', `flex:1; padding:12px 0; border-radius:8px; border:2px solid ${isSelected ? c[1] : 'transparent'}; background:#F8F9FA; color:${c[1]}; font-weight:900; font-size:14px; cursor:pointer; transition:all 0.2s;`, c[0]);
        cBtn.onclick = () => { tempColor = c[1]; colorBtns.forEach(b => { b.style.borderColor='transparent'; }); cBtn.style.borderColor = c[1]; updatePreview(); };
        colorBtns.push(cBtn); colorRow.appendChild(cBtn);
    }); container.appendChild(colorRow);

    showCustomDialog("🎨 폰트 설정", container, "저장(적용)", function() {
        state.outputTextSize = tempSize; state.outputTextColor = tempColor; state.fontFamily = tempFont; state.isBold = tempBold; state.isManualFontOverride = true;
        saveSettings(); applyReadyStatePrayerUI(); closeModal();
    });
}

function applyAgeSettingSafely() {
    saveSettings();
    if (state.wasTimerRunningBeforeMenu) {
        state.secondsCurrent = 0; updateDisplay(); updateTimerUI(); closeModal(); 
    } else {
        resetCurrentTimer(); state.hasStarted = false; pauseTimer();
        const inputEl = document.getElementById('edit-text-input'); const timerLayout = document.getElementById('layout-timers');
        if (inputEl !== null && !state.isEditMode) inputEl.classList.remove('hidden'); if (timerLayout !== null) timerLayout.classList.add('hidden'); 
        applyReadyStatePrayerUI(); closeModal(); 
    }
}

function showAgeSettingDialog() {
    const container = document.createElement('div'); container.style.cssText = "width: 100%; box-sizing: border-box;";
    const menuOptions = ["🎯 일반 나이 설정", "🗓️ 나이-개월 상세 설정", "🌳 가문·조상 대(代) 설정"];
    menuOptions.forEach(function(menuText, index) {
        const menuBtn = createEl('button', 'width:100%; background:#F8F9FA; border:none; border-radius:12px; padding:18px; margin-bottom:12px; font-weight:bold; font-size:16px; color:#1A1A1C; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.02);', menuText);
        menuBtn.type = "button"; 
        menuBtn.addEventListener('click', function() { 
            if (index === 0) showRegularNumberDialog(); else if (index === 1) showYearMonthDialog(); else showGenerationDialog(); 
        }); 
        container.appendChild(menuBtn);
    });
    showCustomDialog("⚙️ 증감 방식 선택", container, null, null);
}

function showRegularNumberDialog() { 
    const container = document.createElement('div'); container.style.cssText = "width: 100%; box-sizing: border-box;";
    const titleStart = createEl('div', 'font-size:14px; font-weight:bold; margin-bottom:8px; color:#8E8E93;', '시작 나이 지점'); container.appendChild(titleStart);
    const rowStart = createEl('div', 'display:flex; align-items:center; margin-bottom:20px;');
    const boxStart = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusStart = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➖'); btnMinusStart.type = "button";
    const btnPlusStart = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➕'); btnPlusStart.type = "button";
    const inputStart = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:20px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;'); inputStart.type = 'number'; inputStart.value = (state.startNumber !== undefined) ? state.startNumber : 0; 
    btnMinusStart.addEventListener('click', function() { let currentVal = parseInt(inputStart.value, 10); if (isNaN(currentVal)) currentVal = 0; if (currentVal > 0) inputStart.value = currentVal - 1; }); btnPlusStart.addEventListener('click', function() { let currentVal = parseInt(inputStart.value, 10); if (isNaN(currentVal)) currentVal = 0; if (currentVal < 999) inputStart.value = currentVal + 1; });
    boxStart.appendChild(btnMinusStart); boxStart.appendChild(inputStart); boxStart.appendChild(btnPlusStart); rowStart.appendChild(boxStart); rowStart.appendChild(createEl('div', 'padding-left:12px; font-weight:bold; font-size:16px; color:#1A1A1C;', '살')); container.appendChild(rowStart);
    
    const titleLimit = createEl('div', 'font-size:14px; font-weight:bold; margin-bottom:8px; color:#8E8E93;', '목표 나이 지점'); container.appendChild(titleLimit);
    const rowLimit = createEl('div', 'display:flex; align-items:center; margin-bottom:24px;');
    const boxLimit = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusLimit = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➖'); btnMinusLimit.type = "button";
    const btnPlusLimit = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➕'); btnPlusLimit.type = "button";
    const inputLimit = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:20px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;'); inputLimit.type = 'number'; inputLimit.value = (state.limitNumber !== undefined) ? state.limitNumber : 100;
    btnMinusLimit.addEventListener('click', function() { let currentVal = parseInt(inputLimit.value, 10); if (isNaN(currentVal)) currentVal = 0; if (currentVal > 0) inputLimit.value = currentVal - 1; }); btnPlusLimit.addEventListener('click', function() { let currentVal = parseInt(inputLimit.value, 10); if (isNaN(currentVal)) currentVal = 0; if (currentVal < 999) inputLimit.value = currentVal + 1; });
    boxLimit.appendChild(btnMinusLimit); boxLimit.appendChild(inputLimit); boxLimit.appendChild(btnPlusLimit); rowLimit.appendChild(boxLimit); rowLimit.appendChild(createEl('div', 'padding-left:12px; font-weight:bold; font-size:16px; color:#1A1A1C;', '살')); container.appendChild(rowLimit);
    
    showCustomDialog("🎯 일반 나이 설정", container, "저장(적용)", function() {
        state.isYearMonthMode = false; state.isGenerationMode = false;
        let startVal = parseInt(inputStart.value, 10); state.startNumber = isNaN(startVal) ? 0 : startVal;
        let limitVal = parseInt(inputLimit.value, 10); state.limitNumber = isNaN(limitVal) ? 100 : limitVal;
        state.currentNumber = state.startNumber; 
        applyAgeSettingSafely();
    });
}

function showYearMonthDialog() { 
    const container = document.createElement('div'); container.style.cssText = "width: 100%; box-sizing: border-box;";
    const titleStartRow = createEl('div', 'display:flex; text-align:center; font-weight:bold; font-size:14px; margin-bottom:8px; color:#8E8E93;'); titleStartRow.innerHTML = `<div style="flex:1;">시작 나이</div><div style="flex:1;">시작 개월</div>`; container.appendChild(titleStartRow);
    const rowStartBoxes = createEl('div', 'display:flex; gap:12px; margin-bottom:24px;');
    const boxStartYear = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusStartYear = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➖'); btnMinusStartYear.type = "button";
    const btnPlusStartYear = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➕'); btnPlusStartYear.type = "button";
    const inputStartYear = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:16px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;'); inputStartYear.type = 'number'; inputStartYear.value = (state.startYear !== undefined) ? state.startYear : 0;
    btnMinusStartYear.addEventListener('click', function() { let v = parseInt(inputStartYear.value, 10); if(isNaN(v)) v=0; if(v>0) inputStartYear.value = v-1; }); btnPlusStartYear.addEventListener('click', function() { let v = parseInt(inputStartYear.value, 10); if(isNaN(v)) v=0; if(v<99) inputStartYear.value = v+1; });
    boxStartYear.appendChild(btnMinusStartYear); boxStartYear.appendChild(inputStartYear); boxStartYear.appendChild(btnPlusStartYear);
    const boxStartMonth = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusStartMonth = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➖'); btnMinusStartMonth.type = "button";
    const btnPlusStartMonth = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➕'); btnPlusStartMonth.type = "button";
    const inputStartMonth = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:16px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;'); inputStartMonth.type = 'number'; inputStartMonth.value = (state.startMonth !== undefined) ? state.startMonth : 1;
    btnMinusStartMonth.addEventListener('click', function() { let v = parseInt(inputStartMonth.value, 10); if(isNaN(v)) v=1; if(v>1) inputStartMonth.value = v-1; }); btnPlusStartMonth.addEventListener('click', function() { let v = parseInt(inputStartMonth.value, 10); if(isNaN(v)) v=1; if(v<12) inputStartMonth.value = v+1; });
    boxStartMonth.appendChild(btnMinusStartMonth); boxStartMonth.appendChild(inputStartMonth); boxStartMonth.appendChild(btnPlusStartMonth);
    rowStartBoxes.appendChild(boxStartYear); rowStartBoxes.appendChild(boxStartMonth); container.appendChild(rowStartBoxes);
    
    const titleLimitRow = createEl('div', 'display:flex; text-align:center; font-weight:bold; font-size:14px; margin-bottom:8px; color:#8E8E93;'); titleLimitRow.innerHTML = `<div style="flex:1;">목표 나이</div><div style="flex:1;">목표 개월</div>`; container.appendChild(titleLimitRow);
    const rowLimitBoxes = createEl('div', 'display:flex; gap:12px; margin-bottom:12px;');
    const boxLimitYear = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusLimitYear = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➖'); btnMinusLimitYear.type = "button";
    const btnPlusLimitYear = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➕'); btnPlusLimitYear.type = "button";
    const inputLimitYear = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:16px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;'); inputLimitYear.type = 'number'; inputLimitYear.value = (state.limitYear !== undefined) ? state.limitYear : 99;
    btnMinusLimitYear.addEventListener('click', function() { let v = parseInt(inputLimitYear.value, 10); if(isNaN(v)) v=99; if(v>0) inputLimitYear.value = v-1; }); btnPlusLimitYear.addEventListener('click', function() { let v = parseInt(inputLimitYear.value, 10); if(isNaN(v)) v=99; if(v<99) inputLimitYear.value = v+1; });
    boxLimitYear.appendChild(btnMinusLimitYear); boxLimitYear.appendChild(inputLimitYear); boxLimitYear.appendChild(btnPlusLimitYear);
    const boxLimitMonth = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusLimitMonth = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➖'); btnMinusLimitMonth.type = "button";
    const btnPlusLimitMonth = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➕'); btnPlusLimitMonth.type = "button";
    const inputLimitMonth = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:16px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;'); inputLimitMonth.type = 'number'; inputLimitMonth.value = (state.limitMonth !== undefined) ? state.limitMonth : 12;
    btnMinusLimitMonth.addEventListener('click', function() { let v = parseInt(inputLimitMonth.value, 10); if(isNaN(v)) v=12; if(v>1) inputLimitMonth.value = v-1; }); btnPlusLimitMonth.addEventListener('click', function() { let v = parseInt(inputLimitMonth.value, 10); if(isNaN(v)) v=12; if(v<12) inputLimitMonth.value = v+1; });
    boxLimitMonth.appendChild(btnMinusLimitMonth); boxLimitMonth.appendChild(inputLimitMonth); boxLimitMonth.appendChild(btnPlusLimitMonth);
    rowLimitBoxes.appendChild(boxLimitYear); rowLimitBoxes.appendChild(boxLimitMonth); container.appendChild(rowLimitBoxes);
    
    showCustomDialog("🗓️ 나이-개월 설정", container, "저장(적용)", function() {
        state.isYearMonthMode = true; state.isGenerationMode = false;
        let yStart = parseInt(inputStartYear.value, 10); state.startYear = isNaN(yStart) ? 0 : yStart;
        let mStart = parseInt(inputStartMonth.value, 10); state.startMonth = isNaN(mStart) ? 1 : mStart;
        let yLimit = parseInt(inputLimitYear.value, 10); state.limitYear = isNaN(yLimit) ? 99 : yLimit;
        let mLimit = parseInt(inputLimitMonth.value, 10); state.limitMonth = isNaN(mLimit) ? 12 : mLimit;
        state.currentYear = state.startYear; state.currentMonth = state.startMonth;
        applyAgeSettingSafely();
    });
}

function showGenerationDialog() { 
    const container = document.createElement('div'); container.style.cssText = "width: 100%; box-sizing: border-box;";
    const titleStart = createEl('div', 'font-size:14px; font-weight:bold; margin-bottom:8px; color:#8E8E93;', '시작 가문/조상 대(代) 지점'); container.appendChild(titleStart);
    const rowStart = createEl('div', 'display:flex; align-items:center; margin-bottom:20px;');
    const boxStart = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusStart = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➖'); btnMinusStart.type = "button";
    const btnPlusStart = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➕'); btnPlusStart.type = "button";
    const inputStart = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:20px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;'); inputStart.type = 'number'; inputStart.value = (state.startGen !== undefined) ? state.startGen : 1;
    btnMinusStart.addEventListener('click', function() { let currentVal = parseInt(inputStart.value, 10); if (isNaN(currentVal)) currentVal = 1; if (currentVal > 1) inputStart.value = currentVal - 1; }); btnPlusStart.addEventListener('click', function() { let currentVal = parseInt(inputStart.value, 10); if (isNaN(currentVal)) currentVal = 1; if (currentVal < 999) inputStart.value = currentVal + 1; });
    boxStart.appendChild(btnMinusStart); boxStart.appendChild(inputStart); boxStart.appendChild(btnPlusStart); rowStart.appendChild(boxStart); rowStart.appendChild(createEl('div', 'padding-left:12px; font-weight:bold; font-size:16px; color:#1A1A1C;', '대')); container.appendChild(rowStart);
    
    const titleLimit = createEl('div', 'font-size:14px; font-weight:bold; margin-bottom:8px; color:#8E8E93;', '목표 가문/조상 대(代) 지점'); container.appendChild(titleLimit);
    const rowLimit = createEl('div', 'display:flex; align-items:center; margin-bottom:12px;');
    const boxLimit = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusLimit = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➖'); btnMinusLimit.type = "button";
    const btnPlusLimit = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➕'); btnPlusLimit.type = "button";
    const inputLimit = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:20px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;'); inputLimit.type = 'number'; inputLimit.value = (state.limitGen !== undefined) ? state.limitGen : 30;
    btnMinusLimit.addEventListener('click', function() { let currentVal = parseInt(inputLimit.value, 10); if (isNaN(currentVal)) currentVal = 30; if (currentVal > 1) inputLimit.value = currentVal - 1; }); btnPlusLimit.addEventListener('click', function() { let currentVal = parseInt(inputLimit.value, 10); if (isNaN(currentVal)) currentVal = 30; if (currentVal < 999) inputLimit.value = currentVal + 1; });
    boxLimit.appendChild(btnMinusLimit); boxLimit.appendChild(inputLimit); boxLimit.appendChild(btnPlusLimit); rowLimit.appendChild(boxLimit); rowLimit.appendChild(createEl('div', 'padding-left:12px; font-weight:bold; font-size:16px; color:#1A1A1C;', '대')); container.appendChild(rowLimit);
    
    showCustomDialog("🌳 가문·조상 대(代) 설정", container, "저장(적용)", function() {
        state.isGenerationMode = true; state.isYearMonthMode = false;
        let startVal = parseInt(inputStart.value, 10); state.startGen = isNaN(startVal) ? 1 : startVal;
        let limitVal = parseInt(inputLimit.value, 10); state.limitGen = isNaN(limitVal) ? 30 : limitVal;
        state.currentGen = state.startGen; 
        applyAgeSettingSafely();
    });
}

function showNameSettingDialog() {
    const container = document.createElement('div');
    container.style.cssText = "width: 100%; box-sizing: border-box; display:flex; flex-direction:column; height:100%;"; 
    
    const descriptionTitle = createEl('div', 'font-weight:bold; color:#8E8E93; font-size:12px; margin-bottom:8px; text-align:center;', '기도 대상(이름)을 무제한으로 관리하세요.');
    container.appendChild(descriptionTitle);

    const addBox = createEl('div', 'display:flex; gap:6px; margin-bottom:10px; flex-shrink:0;');
    const addInput = createEl('input', 'flex:1; padding:8px 10px; border:1px solid #E9ECEF; border-radius:8px; font-size:14px; outline:none;');
    addInput.placeholder = "새로운 이름 입력...";
    const addBtn = createEl('button', 'background:#007AFF; color:white; border:none; border-radius:8px; font-weight:bold; font-size:13px; cursor:pointer; flex: 0 0 65px;', '➕ 추가');
    addBox.appendChild(addInput); addBox.appendChild(addBtn); container.appendChild(addBox);

    const listScrollContainer = createEl('div', 'flex:1; overflow-y:auto; display:flex; flex-direction:column; border-top:1px solid #F1F3F5; padding-top:4px;');
    container.appendChild(listScrollContainer);

    let persistentData = getLocalData();
    let activeIndex = persistentData.activeNameIndex || 0; 

    function renderList() {
        listScrollContainer.innerHTML = "";
        
        const rowOrg = createEl('div', 'display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid #F1F3F5; background:#F8F9FA; border-radius:8px; margin-bottom:4px;');
        const nameOrg = createEl('div', 'font-weight:bold; font-size:14px; color:#007AFF;', '&lt;설정 안함 (원본)&gt;');
        const btnOrg = createEl('button', 'padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer; border:none;');
        if (activeIndex === 0) { btnOrg.style.background = "#34C759"; btnOrg.style.color = "white"; btnOrg.innerText = "✓ 적용중"; } 
        else { btnOrg.style.background = "#E8EBEF"; btnOrg.style.color = "#495057"; btnOrg.innerText = "선택"; btnOrg.onclick = () => { activeIndex = 0; applySelection(); }; }
        rowOrg.appendChild(nameOrg); rowOrg.appendChild(btnOrg); listScrollContainer.appendChild(rowOrg);

        let displayIndex = 1;
        state.nameList.forEach((item, arrIndex) => {
            if (item.isDeleted) return; 
            const currentItemIndex = displayIndex; displayIndex++;
            
            const itemBox = createEl('div', 'padding:6px 0; border-bottom:1px solid #F1F3F5; display:flex; flex-direction:column; gap:4px;');
            const topRow = createEl('div', 'display:flex; justify-content:space-between; align-items:center;');
            const nameSpan = createEl('div', 'font-size:15px; font-weight:bold; color:#1A1A1C; flex:1; padding-left:4px;', item.name);
            const btnGroup = createEl('div', 'display:flex; gap:4px;');
            
            const btnSel = createEl('button', 'padding:6px 10px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer; border:none;');
            if (activeIndex === currentItemIndex) { btnSel.style.background = "#34C759"; btnSel.style.color = "white"; btnSel.innerText = "✓ 적용중"; } 
            else { btnSel.style.background = "#E8F3FF"; btnSel.style.color = "#007AFF"; btnSel.innerText = "선택"; btnSel.onclick = () => { activeIndex = currentItemIndex; applySelection(); }; }
            
            const btnEdit = createEl('button', 'padding:6px 8px; border-radius:6px; font-size:12px; background:#F8F9FA; color:#495057; border:1px solid #E9ECEF; cursor:pointer;', '수정');
            btnEdit.onclick = () => {
                let newName = prompt(`'${item.name}' 님의 이름을 수정하세요:`, item.name);
                if (newName !== null && newName.trim() !== "") {
                    item.name = newName.trim(); saveSettings(); renderList();
                    if (activeIndex === currentItemIndex) { applyReadyStatePrayerUI(); updateDisplay(); }
                }
            };

            const btnDel = createEl('button', 'padding:6px 8px; border-radius:6px; font-size:12px; background:#FFF0F0; color:#FF3B30; border:none; cursor:pointer;', '삭제');
            btnDel.onclick = () => {
                if(confirm(`'${item.name}'님을 목록에서 삭제하시겠습니까?\n(과거 누적된 통계 시간은 안전하게 영구 보존됩니다)`)) {
                    item.isDeleted = true; if (activeIndex === currentItemIndex) activeIndex = 0; saveSettings(); renderList();
                }
            };
            btnGroup.appendChild(btnSel); btnGroup.appendChild(btnEdit); btnGroup.appendChild(btnDel); 
            topRow.appendChild(nameSpan); topRow.appendChild(btnGroup);
            
            const statsRow = createEl('div', 'font-size:11px; color:#8E8E93; padding-left:4px; font-weight:700;');
            let statsData = getNameStats(item.name);
            statsRow.innerHTML = `📊 누적 기도: ${statsData.count}회 (${formatTimeMinSec(statsData.seconds)})`;
            
            itemBox.appendChild(topRow); itemBox.appendChild(statsRow);
            listScrollContainer.appendChild(itemBox);
        });
    }

    addBtn.onclick = () => {
        const newName = addInput.value.trim(); if (newName === "") return;
        state.nameList.push({ uid: 'N_' + Date.now() + '_' + Math.floor(Math.random() * 1000), name: newName, isDeleted: false });
        addInput.value = ""; saveSettings(); renderList(); setTimeout(() => { listScrollContainer.scrollTop = listScrollContainer.scrollHeight; }, 50);
    };

    function applySelection() {
        let currentData = getLocalData(); currentData.activeNameIndex = activeIndex; saveLocalData(currentData);
        const topInputEl = document.getElementById('edit-text-input');
        if (topInputEl !== null && topInputEl.classList.contains('hidden') && !state.isEditMode) updateDisplay(); else applyReadyStatePrayerUI();
        renderList(); 
    }
    renderList(); 
    showCustomDialog("👤 이름 무제한 관리", container, null, null, true);
}

function showTtsSettingsDialog() { 
    const container = document.createElement('div'); container.style.cssText = "width: 100%; box-sizing: border-box;";
    const speedTitle = createEl('div', 'font-weight:bold; font-size:14px; color:#8E8E93; margin-bottom:12px;', '읽기 속도 설정'); container.appendChild(speedTitle);
    const speedRowBox = createEl('div', 'display:flex; flex-wrap:wrap; margin-bottom:20px; gap:8px;');
    const allowedSpeeds = [0.5, 0.75, 1.0, 1.3, 1.6];
    allowedSpeeds.forEach(function(speedValue) {
        const labelBox = createEl('label', 'flex:1 1 45%; background:#F8F9FA; padding:10px; border-radius:8px; display:flex; align-items:center; cursor:pointer;');
        const radioBtn = createEl('input', 'margin-right:8px; transform:scale(1.2);'); radioBtn.type = 'radio'; radioBtn.name = 'ttsSpeedSelection'; radioBtn.value = speedValue;
        if (Math.abs(state.ttsSpeed - speedValue) < 0.05) radioBtn.checked = true;
        radioBtn.addEventListener('change', function() { state.ttsSpeed = speedValue; saveSettings(); speakPreview(); });
        const speedText = createEl('span', 'font-size:14px; font-weight:bold; color:#1A1A1C;', `${speedValue}배속`); labelBox.appendChild(radioBtn); labelBox.appendChild(speedText); speedRowBox.appendChild(labelBox);
    });
    container.appendChild(speedRowBox);
    const voiceTitle = createEl('div', 'font-weight:bold; font-size:14px; color:#8E8E93; margin-bottom:12px;', '목소리 종류 선택'); container.appendChild(voiceTitle);
    const voiceRowBox = createEl('div', 'display:flex; flex-direction:column; gap:8px;');
    if (synthesis !== null) {
        let availableVoices = synthesis.getVoices().filter(voice => voice.lang.includes('ko')).slice(0, 4);
        if (availableVoices.length === 0) { voiceRowBox.innerHTML = "<div style='color:#8E8E93; font-size:13px;'>지원하는 한국어 음성이 없습니다.</div>"; } else {
            availableVoices.forEach(function(voice, index) {
                const labelBox = createEl('label', 'background:#F8F9FA; padding:12px; border-radius:8px; display:flex; align-items:center; cursor:pointer;');
                const radioBtn = createEl('input', 'margin-right:10px; transform:scale(1.2);'); radioBtn.type = 'radio'; radioBtn.name = 'ttsVoiceSelection'; radioBtn.value = voice.name;
                if (state.selectedVoiceName === voice.name || (state.selectedVoiceName === null && index === 0)) radioBtn.checked = true;
                radioBtn.addEventListener('change', function() { state.selectedVoiceName = voice.name; saveSettings(); speakPreview(); });
                const voiceText = createEl('span', 'font-size:14px; font-weight:bold; color:#1A1A1C;', `목소리 ${index + 1}`); labelBox.appendChild(radioBtn); labelBox.appendChild(voiceText); voiceRowBox.appendChild(labelBox);
            });
        }
    }
    container.appendChild(voiceRowBox); showCustomDialog("🔊 음성 상세 설정", container, "저장(적용)", function() { closeModal(); }, false);
}

// ============================================================================
// 11. 기도문 히스토리 관리 및 수정 저장 로직 
// ============================================================================
function getPrayerList() {
    let persistentData = getLocalData(); let parsedArray = [];
    try { parsedArray = JSON.parse(persistentData.savedList || '[]'); } catch(error) { parsedArray = []; }
    let resultList = []; let currentTimestamp = Date.now();
    for (let i = 0; i < parsedArray.length; i++) {
        let itemObj = parsedArray[i];
        if (typeof itemObj === 'object') { resultList.push({ uid: itemObj.uid || ('P_' + currentTimestamp + '_' + i), text: itemObj.text || "", addedAt: itemObj.addedAt || (currentTimestamp - i), lastUsed: itemObj.lastUsed || 0, useCount: itemObj.useCount || 0 }); } 
        else { resultList.push({ uid: 'P_' + currentTimestamp + '_' + i, text: itemObj, addedAt: currentTimestamp - i, lastUsed: 0, useCount: 0 }); }
    }
    return resultList;
}

function savePrayerList(newListArray) {
    let persistentData = getLocalData(); persistentData.savedList = JSON.stringify(newListArray); saveLocalData(persistentData);
}

function saveToHistory(textContent) {
    if (textContent === null || textContent.trim() === "") return;
    let currentList = getPrayerList(); currentList = currentList.filter(item => item.text !== textContent);
    currentList.unshift({ uid: 'P_' + Date.now(), text: textContent, addedAt: Date.now(), lastUsed: 0, useCount: 0 });
    if (currentList.length > 200) currentList.pop(); savePrayerList(currentList);
}

function updateHistoryItem(oldText, newText) {
    if (!newText || newText.trim() === "") return;
    let currentList = getPrayerList();
    if (!oldText || oldText.trim() === "") { saveToHistory(newText); return; }
    let foundIndex = currentList.findIndex(item => item.text === oldText);
    if (foundIndex !== -1) { currentList[foundIndex].text = newText; currentList[foundIndex].addedAt = Date.now(); } 
    else { currentList.unshift({ uid: 'P_' + Date.now(), text: newText, addedAt: Date.now(), lastUsed: 0, useCount: 0 }); }
    if (currentList.length > 200) currentList.pop(); savePrayerList(currentList);
}

function showHistoryListDialog() { 
    let allPrayerItems = getPrayerList();
    if (allPrayerItems.length === 0) { showSimpleBottomDialog("📭 목록 없음", "저장된 기도문이 없습니다.<br>기도문관리 메뉴에서 복원해주세요."); return; }

    const mainContainer = createEl('div', 'display:flex; flex-direction:column; height:100%; width:100%; box-sizing: border-box;');
    const sortRowBox = createEl('div', 'display:flex; align-items:center; padding-bottom:12px; padding-top:8px;'); sortRowBox.innerHTML = '<span style="font-size:14px; font-weight:bold; margin-right:8px; color:#1A1A1C;">정렬 방식:</span>';
    const sortSelectBox = createEl('select', 'flex:1; padding:8px; border-radius:8px; border:1px solid #E9ECEF; font-size:13px; outline:none;');
    const sortOptions = ['최근입력순', '많이사용순', '최근사용순', '가나다순', '가나다역순'];
    sortOptions.forEach(function(optionText, index) { const optionNode = document.createElement('option'); optionNode.value = index; optionNode.text = optionText; sortSelectBox.appendChild(optionNode); });
    sortSelectBox.value = state.historySortIndex; sortRowBox.appendChild(sortSelectBox);
    const listScrollContainer = createEl('div', 'flex:1; overflow-y:auto; display:flex; flex-direction:column;');
    mainContainer.appendChild(sortRowBox); mainContainer.appendChild(createEl('div', 'height:1px; background:#F1F3F5; width:100%; margin-bottom:10px;')); mainContainer.appendChild(listScrollContainer);

    function renderPrayerList() {
        listScrollContainer.innerHTML = ""; let sortedArray = [...allPrayerItems];
        switch (parseInt(sortSelectBox.value, 10)) {
            case 1: sortedArray.sort((a,b) => b.useCount - a.useCount || b.lastUsed - a.lastUsed); break;
            case 2: sortedArray.sort((a,b) => b.lastUsed - a.lastUsed); break;
            case 3: sortedArray.sort((a,b) => a.text.localeCompare(b.text)); break;
            case 4: sortedArray.sort((a,b) => b.text.localeCompare(a.text)); break;
            default: sortedArray.sort((a,b) => b.addedAt - a.addedAt); break;
        }

        sortedArray.forEach(function(prayerItem, index) {
            const itemBox = createEl('div', 'padding:12px 0; border-bottom:1px solid #F1F3F5; display:flex; flex-direction:column; gap:8px;');
            
            const textContentRow = createEl('div', 'display:flex; align-items:flex-start;');
            textContentRow.innerHTML = `<div style="width:28px; color:#007AFF; font-weight:800; font-size:14px; padding-top:2px;">${index + 1}.</div><div style="flex:1; color:#1A1A1C; font-size:14px; line-height:1.4; word-break:keep-all; user-select:text; overflow-wrap:break-word;">${prayerItem.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>`;
            
            const statsRow = createEl('div', 'font-size:11px; color:#8E8E93; font-weight:700; padding-left:28px;');
            statsRow.innerHTML = `📊 총 ${prayerItem.useCount || 0}회 기도 / 최근 사용: ${formatSimpleDate(prayerItem.lastUsed)}`;

            const buttonRowBox = createEl('div', 'display:flex; gap:6px; padding-left:28px; justify-content:flex-end;');
            const btnSelect = document.createElement('button'); btnSelect.style.cssText = "box-sizing: border-box; flex:2; background:#007AFF; color:white; border:none; cursor:pointer;"; btnSelect.className = "history-action-btn"; btnSelect.innerHTML = "선택";
            btnSelect.addEventListener('click', function(event) {
                event.preventDefault(); event.stopPropagation();
                prayerItem.lastUsed = Date.now(); prayerItem.useCount = (prayerItem.useCount || 0) + 1; savePrayerList(allPrayerItems);
                state.currentPrayerUID = prayerItem.uid || ('P_' + Date.now()); 
                const inputElement = document.getElementById('edit-text-input');
                if (inputElement !== null) inputElement.value = prayerItem.text;
                state.hasStarted = false; pauseTimer(); resetCurrentTimer(); exitEditMode(false); 
                autoDetectModeFromText(prayerItem.text); applyReadyStatePrayerUI(); 
                state.wasTimerRunningBeforeMenu = false; 
                closeModal();
            });

            const btnEdit = document.createElement('button'); btnEdit.style.cssText = "box-sizing: border-box; flex:1; background:#F8F9FA; color:#495057; border:1px solid #E9ECEF; cursor:pointer;"; btnEdit.className = "history-action-btn"; btnEdit.innerHTML = "수정";
            btnEdit.addEventListener('click', function(event) { event.preventDefault(); event.stopPropagation(); closeModalSilently(); enterEditMode(prayerItem.text); });
            
            const btnDelete = document.createElement('button'); btnDelete.style.cssText = "box-sizing: border-box; flex:1; background:#FFF0F0; color:#FF3B30; border:none; cursor:pointer;"; btnDelete.className = "history-action-btn"; btnDelete.innerHTML = "삭제";
            btnDelete.addEventListener('click', function(event) {
                event.preventDefault(); event.stopPropagation();
                const msgBox = createEl('div', 'text-align:center; padding:10px 0; font-size:15px; color:#1A1A1C; line-height:1.5;'); msgBox.innerHTML = "이 기도문을 삭제하시겠습니까?";
                showCustomDialogWithFooter("삭제 확인", msgBox, "삭제", function() {
                    allPrayerItems = allPrayerItems.filter(item => item.addedAt !== prayerItem.addedAt); savePrayerList(allPrayerItems); renderPrayerList(); closeModal(); setTimeout(showHistoryListDialog, 100); 
                });
            });
            buttonRowBox.appendChild(btnSelect); buttonRowBox.appendChild(btnEdit); buttonRowBox.appendChild(btnDelete); 
            
            itemBox.appendChild(textContentRow); itemBox.appendChild(statsRow); itemBox.appendChild(buttonRowBox); 
            listScrollContainer.appendChild(itemBox);
        });
    }
    sortSelectBox.addEventListener('change', function() { state.historySortIndex = parseInt(sortSelectBox.value, 10); saveSettings(); renderPrayerList(); });
    renderPrayerList(); showCustomDialog("📜 기도문 목록", mainContainer, null, null, true);
}

function showManagementDialog() {
    const container = document.createElement('div'); container.style.cssText = "width: 100%; box-sizing: border-box;";
    const menuOptions = [
        { text: "📤 파일로 저장하기", action: exportHistoryToFile },
        { text: "📥 파일에서 가져오기", action: function() { const fileInput = document.getElementById('hidden-import-file'); if(fileInput) fileInput.click(); }},
        { text: "📄 기본 기도문 복원", action: showDefaultTemplatesRestoreDialog },
        { text: "🗑️ 기도문 목록 초기화", action: function() {
            const msgBox = createEl('div', 'text-align:center; padding:10px 0; font-size:15px; color:#1A1A1C; line-height:1.5;');
            let alertMsg = "저장된 모든 기도문 목록을<br>";
            alertMsg += "정말로 초기화(삭제)하시겠습니까?";
            msgBox.innerHTML = alertMsg;
            showCustomDialogWithFooter("초기화 확인", msgBox, "🗑️ 초기화", function() { clearHistory(); closeModal(); });
        }}
    ];
    menuOptions.forEach(function(opt) {
        const menuBtn = createEl('button', 'width:100%; background:#F8F9FA; border:none; border-radius:12px; padding:16px; margin-bottom:12px; font-weight:bold; font-size:15px; color:#1A1A1C; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.02);', opt.text);
        menuBtn.type = "button"; 
        menuBtn.addEventListener('click', function() { opt.action(); }); 
        container.appendChild(menuBtn);
    });
    const hiddenFileInput = createEl('input', 'display:none;'); hiddenFileInput.type = 'file'; hiddenFileInput.accept = '.txt'; hiddenFileInput.id = "hidden-import-file";
    hiddenFileInput.addEventListener('change', function(event) { if (event.target.files[0]) { processImport(event.target.files[0]); } }); container.appendChild(hiddenFileInput);
    
    showCustomDialog("📂 기도문 관리", container, null, null, false);
}

function showTimerMenuDialog() {
    state.wasTimerRunningBeforeMenu = false; 
    pauseTimer();
    const container = document.createElement('div'); container.style.cssText = "width: 100%; box-sizing: border-box;";
    const controlItems = ["▶️ 계속 진행", "⏸️ 일시정지", "📝 직접 수정으로 복귀"];
    controlItems.forEach(function(buttonText, index) {
        const ctrlBtn = createEl('button', 'width:100%; background:#F8F9FA; border:none; border-radius:12px; padding:16px; margin-bottom:12px; font-weight:bold; font-size:15px; color:#1A1A1C; cursor:pointer; box-sizing: border-box;', buttonText);
        ctrlBtn.type = "button";
        ctrlBtn.addEventListener('click', function() {
            state.wasTimerRunningBeforeMenu = false; 
            closeModal();
            if (index === 0) startTimer(); 
            else if (index === 1) pauseTimer(); 
            else if (index === 2) { const inputElement = document.getElementById('edit-text-input'); let currentText = inputElement ? inputElement.value : ""; enterEditMode(currentText); }
        });
        container.appendChild(ctrlBtn);
    });
    showCustomDialog("⏱️ 타이머 제어", container, null, null, false);
}

function showEmptyHistoryDialog() {}

async function showDefaultTemplatesRestoreDialog() {
    let templatesArray = [];
    try { const fetchResponse = await fetch('prayer_templates.txt'); if (fetchResponse.ok) { const rawText = await fetchResponse.text(); templatesArray = rawText.split("%%").map(text => text.trim()).filter(text => text !== ""); } } catch(error) { templatesArray = ["기본 기도문 파일(prayer_templates.txt)을 찾을 수 없습니다."]; }
    const container = createEl('div', 'display:flex; flex-direction:column; height:100%; width:100%; box-sizing: border-box;');
    const actionButtonsRow = createEl('div', 'display:flex; gap:12px; margin-bottom:16px; flex-shrink:0;');
    const btnRestoreAll = createEl('button', 'flex:1; background:#007AFF; color:white; border:none; padding:14px; border-radius:12px; font-weight:bold; font-size:15px; cursor:pointer;', '전체 복원'); btnRestoreAll.type = "button";
    const btnRestoreSelected = createEl('button', 'flex:1; background:#34C759; color:white; border:none; padding:14px; border-radius:12px; font-weight:bold; font-size:15px; cursor:pointer;', '선택 복원'); btnRestoreSelected.type = "button";
    actionButtonsRow.appendChild(btnRestoreAll); actionButtonsRow.appendChild(btnRestoreSelected);
    const listScrollBox = createEl('div', 'flex:1; overflow-y:auto; display:flex; flex-direction:column;');
    const checkboxNodes = [];
    templatesArray.forEach(function(templateText) {
        const itemRow = createEl('div', 'display:flex; padding:14px 0; border-bottom:1px solid #F1F3F5; cursor:pointer; align-items:flex-start;');
        const checkboxEl = createEl('input', 'margin-right:6px; margin-top:4px; transform:scale(1.0); cursor:pointer; flex-shrink:0;'); checkboxEl.type = 'checkbox';
        const textEl = createEl('div', 'flex:1; font-size:15px; line-height:1.4; color:#1A1A1C; overflow-wrap:break-word;', templateText.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        itemRow.addEventListener('click', function(event) { if (event.target !== checkboxEl) checkboxEl.checked = !checkboxEl.checked; });
        itemRow.appendChild(checkboxEl); itemRow.appendChild(textEl); listScrollBox.appendChild(itemRow);
        checkboxNodes.push({ node: checkboxEl, textContent: templateText });
    });
    btnRestoreAll.addEventListener('click', function() {
        let currentItems = getPrayerList(); let timestamp = Date.now(); let reversedTemplates = [...templatesArray].reverse();
        reversedTemplates.forEach(function(templateStr, index) { currentItems = currentItems.filter(item => item.text !== templateStr); currentItems.unshift({ uid: 'P_'+(timestamp+index), text: templateStr, addedAt: timestamp + index, lastUsed: 0, useCount: 0 }); });
        savePrayerList(currentItems); closeModal(); showHistoryListDialog(); 
    });
    btnRestoreSelected.addEventListener('click', function() {
        let currentItems = getPrayerList(); let timestamp = Date.now(); let restoreCount = 0; let reversedNodes = [...checkboxNodes].reverse();
        reversedNodes.forEach(function(itemData, index) {
            if (itemData.node.checked === true) { currentItems = currentItems.filter(item => item.text !== itemData.textContent); currentItems.unshift({ uid: 'P_'+(timestamp+index), text: itemData.textContent, addedAt: timestamp + index, lastUsed: 0, useCount: 0 }); restoreCount++; }
        });
        if (restoreCount > 0) { savePrayerList(currentItems); closeModal(); showHistoryListDialog(); } 
    });
    container.appendChild(actionButtonsRow); container.appendChild(listScrollBox); showCustomDialog("📄 기본 기도문 복원", container, null, null, true);
}

function showGracefulExitScreen() {
    document.body.innerHTML = ""; 
    document.body.style.cssText = "display:flex; height:100vh; width:100vw; justify-content:center; align-items:center; background-color:#F4F6F9; color:#8E8E93; font-weight:bold; font-size:16px; text-align:center; flex-direction:column; box-sizing:border-box; padding:20px; margin:0;";

    const iconDiv = document.createElement('div');
    iconDiv.style.cssText = "font-size:45px; margin-bottom:16px;";
    iconDiv.innerText = "🙏";

    const textDiv = document.createElement('div');
    textDiv.style.cssText = "line-height:1.6;";
    let exitStr = "앱이 안전하게 종료되었습니다.<br>";
    exitStr += "이 창을 닫아주세요.";
    textDiv.innerHTML = exitStr;

    document.body.appendChild(iconDiv);
    document.body.appendChild(textDiv);
}

function showExitConfirmDialog() {
    const container = createEl('div', 'text-align:center; padding:10px 0; font-size:16px; color:#1A1A1C; line-height:1.5;');
    let confirmStr = "정말로 앱을 종료하시겠습니까?<br>";
    confirmStr += "모든 설정값은 영구 저장됩니다.";
    container.innerHTML = confirmStr;
    
    showCustomDialogWithFooter("앱 종료 확인", container, "종료", function() {
        saveSettings();
        
        try { 
            if (typeof window.Android !== 'undefined' && window.Android !== null && typeof window.Android.exitApp === 'function') {
                window.Android.exitApp();
            } else {
                window.open('','_self').close(); 
                window.close(); 
                if (!window.closed) { 
                    showGracefulExitScreen();
                }
            }
        } catch(error) { 
            showGracefulExitScreen();
        }
    });
}

function exportHistoryToFile() {
    let allItems = getPrayerList(); if (allItems.length === 0) return;
    let fileContent = allItems.map(item => "%%" + item.text).join("\n\n");
    let fileBlob = new Blob([fileContent], { type: "text/plain" }); let downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(fileBlob); downloadLink.download = "나의_회개_기도문.txt"; downloadLink.click();
}

function processImport(targetFile) {
    let fileReader = new FileReader();
    fileReader.onload = function(event) {
        let loadedContent = event.target.result; let existingItems = getPrayerList(); let timestamp = Date.now();
        let splitItems = loadedContent.split("%%").filter(text => text.trim() !== "");
        splitItems.forEach(function(itemText, i) { existingItems.unshift({ uid: 'P_'+(timestamp-i), text: itemText.trim(), addedAt: timestamp-i, lastUsed: 0, useCount: 0 }); });
        savePrayerList(existingItems); showHistoryListDialog();
    };
    fileReader.readAsText(targetFile);
}

function clearHistory() {
    let persistentData = getLocalData(); delete persistentData.savedList; saveLocalData(persistentData);
    closeModal();
}
/* ================= APP.JS 끝 (이 줄이 없으면 복사가 덜 된 것입니다!) ================= */