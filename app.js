// [회개하자!_Web_V 1.0_app.js_전체_마스터본 | 작성일: 2026-07-03 20:46 KST]
/**
 * [V 1.0 업데이트 상세 내역]
 * 1. 기본 기도문 복원 창의 체크박스가 긴 텍스트에 밀려 찌그러지는 현상 방어 (flex-shrink: 0 적용).
 * 2. 웰컴 메시지 상태에서 "기도문 신규입력" 버튼 노출 (공백/줄바꿈 무시).
 * 3. 중앙 메뉴 6버튼 1줄 배치 UI에 맞춘 "기도문관리" 통합 팝업창 연동 유지.
 * 4. 이전 V4.6의 하단 팝업 엔진, 타이머 숨김, TTS 상태 연동 로직 100% 완전 유지.
 * 5. 어떠한 코드 압축이나 생략 없이 처음부터 끝까지 완전한 풀버전 코딩.
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
    ttsSpeed: 1.0, selectedVoiceName: null, isTtsEnabled: false,
    
    secondsCurrent: 0, secondsTotal: 0, isTimerRunning: false,
    
    welcomeList: ["기도를 시작하려면 [다음단계]를 누르세요."],
    guideList: [
        "📝 [수정 모드 안내]\n<이름> 입력 시 이름이 자동 변환됩니다.\n[ ]살, [ ]대 입력 시 자동 증감됩니다.",
        "💡 [수정 모드 팁]\n하단 입력창에서 기도문을 자유롭게 수정하세요.\n수정 완료 후 우측의 '저장'을 꼭 눌러주세요."
    ],
    firstWelcomeMsg: "",
    currentRollIndex: 0,
    hintsList: [
        "💡 [ ]살 ➔ '한살, 두살' 자동 변환",
        "💡 [ ] ➔ 숫자만 강조 표기",
        "💡 배포자: 생명의 빛 교회"
    ],
    hintIndex: 0
};

let timerInterval = null;
let rollInterval = null;
let hintInterval = null;
let originalTextBeforeEdit = "";
let synthesis = (typeof window !== 'undefined' && window.speechSynthesis) ? window.speechSynthesis : null;

// ============================================================================
// 2. 로컬 스토리지 데이터 관리
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
    try {
        localStorage.setItem('AppHistory', JSON.stringify(dataObj));
    } catch (error) {
        console.error("데이터 저장 실패:", error);
    }
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
    state.selectedVoiceName = data.selectedVoiceName || null;
    state.isYearMonthMode = (data.isYearMonthMode === true);
    state.isGenerationMode = (data.isGenerationMode === true);
    state.isManualFontOverride = (data.isManualFontOverride === true);
    
    state.currentNumber = state.startNumber;
    state.currentYear = state.startYear;
    state.currentMonth = state.startMonth;
    state.currentGen = state.startGen;
}

function saveSettings() {
    let persistentData = getLocalData();
    persistentData.startNumber = state.startNumber;
    persistentData.limitNumber = state.limitNumber;
    persistentData.startYear = state.startYear;
    persistentData.startMonth = state.startMonth;
    persistentData.limitYear = state.limitYear;
    persistentData.limitMonth = state.limitMonth;
    persistentData.startGen = state.startGen;
    persistentData.limitGen = state.limitGen;
    persistentData.outputTextSize = state.outputTextSize;
    persistentData.outputTextColor = state.outputTextColor;
    persistentData.ttsSpeed = state.ttsSpeed;
    persistentData.selectedVoiceName = state.selectedVoiceName;
    persistentData.isYearMonthMode = state.isYearMonthMode;
    persistentData.isGenerationMode = state.isGenerationMode;
    persistentData.isManualFontOverride = state.isManualFontOverride;
    persistentData.historySortIndex = state.historySortIndex;
    saveLocalData(persistentData);
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
        
        // 상단 기본 팝업 닫기 버튼 이벤트 연결
        const closeModalBtn = document.getElementById('modal-btn-negative');
        if (closeModalBtn !== null) closeModalBtn.addEventListener('click', closeModal);
        // 하단 기능형 팝업 닫기 버튼 이벤트 연결
        const closeBottomBtn = document.getElementById('modal-btn-bottom-negative');
        if (closeBottomBtn !== null) closeBottomBtn.addEventListener('click', closeModal);
    } catch(e) {
        console.error("화면 세팅 오류:", e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}

async function loadAssetMessages() {
    try {
        const welcomeResponse = await fetch('welcome.txt');
        if (welcomeResponse.ok) {
            const welcomeText = await welcomeResponse.text();
            state.welcomeList = welcomeText.split("###").map(t => t.trim()).filter(t => t !== "");
            state.firstWelcomeMsg = state.welcomeList[0] || "";
        } else { throw new Error(); }
    } catch (error) {
        state.firstWelcomeMsg = "🙏 회개하자! V 1.0\n환영합니다.";
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
    try {
        if (persistentData.savedList) existingList = JSON.parse(persistentData.savedList);
    } catch (error) { existingList = []; }
    
    if (persistentData.isFirstRun === undefined || persistentData.isFirstRun === true || existingList.length === 0) {
        let templatesArray = [];
        try {
            const res = await fetch('prayer_templates.txt');
            if (res.ok) {
                const txt = await res.text();
                templatesArray = txt.split("%%").map(t => t.trim()).filter(t => t !== "");
            } else { throw new Error(); }
        } catch (error) {
            templatesArray = [
                "주님! <홍길동>이 [ ]살때 제사 음식 만들고 차린 죄를 회개합니다.",
                "주님! <외가> [ ]대가 무당 찾아가 점을 본 죄를 회개합니다."
            ];
        }
        
        let currentTime = Date.now();
        let formattedItems = templatesArray.map((text, index) => {
            return { text: text, addedAt: currentTime - index, lastUsed: 0, useCount: 0 };
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
    if (targetElement !== null) {
        targetElement.addEventListener(eventType, callbackFunction);
    } else {
        console.warn(`이벤트 바인딩 실패: ${elementId}`);
    }
}

function updateTtsToolbarVisibility() {
    const ttsWrapper = document.getElementById('tts-tools-wrapper');
    if (ttsWrapper) {
        if (state.hasStarted === true) {
            ttsWrapper.classList.remove('hidden');
        } else {
            ttsWrapper.classList.add('hidden');
        }
    }
}

// 웰컴 메시지 공백 완벽 제거 비교로 "신규입력" 정확도 향상
function updateEditButtonUI() {
    const btnGoEdit = document.getElementById('btn-go-edit');
    const topInput = document.getElementById('edit-text-input');
    
    if (btnGoEdit !== null) {
        let currentText = topInput ? topInput.value : "";
        let cleanedCurrent = currentText.replace(/\s+/g, "");
        let cleanedWelcome = state.firstWelcomeMsg.replace(/\s+/g, "");
        
        let isWelcomeMsg = (cleanedCurrent === cleanedWelcome || cleanedCurrent === "");
        
        if (state.hasStarted === true || isWelcomeMsg === false) {
            btnGoEdit.innerText = "📝 기도문 수정";
        } else {
            btnGoEdit.innerText = "📝 기도문 신규입력";
        }
    }
}

function enterEditMode(initialText) {
    state.isEditMode = true;
    originalTextBeforeEdit = initialText || "";
    
    state.hasStarted = false; 
    pauseTimer();
    updateTtsToolbarVisibility(); 
    
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

    if (saveTextToTop && topInput && bottomEditInput) {
        topInput.value = bottomEditInput.value;
    }

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
}

function setupMainUI() {
    const topInputEl = document.getElementById('edit-text-input');
    const bottomInputEl = document.getElementById('bottom-edit-input');

    // 상단 입력창 터치 시 수정 모드
    if (topInputEl !== null) {
        topInputEl.addEventListener('focus', function() {
            enterEditMode(topInputEl.value);
            topInputEl.blur(); 
        });
    }

    // 불러온 텍스트가 있으면 수정, 비어있거나 웰컴 메시지면 신규입력 빈 창 진입
    safeBind('btn-go-edit', 'click', function() {
        if (topInputEl !== null) {
            let currentText = topInputEl.value;
            let cleanedCurrent = currentText.replace(/\s+/g, "");
            let cleanedWelcome = state.firstWelcomeMsg.replace(/\s+/g, "");
            let isWelcomeMsg = (cleanedCurrent === cleanedWelcome || cleanedCurrent === "");
            
            if (state.hasStarted === true || isWelcomeMsg === false) {
                enterEditMode(topInputEl.value);
            } else {
                enterEditMode(""); // 신규 입력 모드(빈 창 지우기)
            }
        }
    });

    // 수정 모드 4개 버튼 제어
    safeBind('btn-edit-clear-text', 'click', function() {
        if (bottomInputEl) {
            bottomInputEl.value = "";
            bottomInputEl.focus();
        }
    });

    safeBind('btn-edit-save-new', 'click', function() {
        if (bottomInputEl && bottomInputEl.value.trim() !== "") {
            saveToHistory(bottomInputEl.value);
            showSimpleBottomDialog("안내", "✅ 새 기도문으로 기도창고에 추가되었습니다.");
            exitEditMode(true);
        } else {
            showSimpleBottomDialog("경고", "⚠️ 저장할 내용이 없습니다.");
        }
    });

    safeBind('btn-edit-save-update', 'click', function() {
        if (bottomInputEl && bottomInputEl.value.trim() !== "") {
            updateHistoryItem(originalTextBeforeEdit, bottomInputEl.value);
            showSimpleBottomDialog("안내", "✅ 기존 기도문이 덮어쓰기 저장되었습니다.");
            exitEditMode(true);
        } else {
            showSimpleBottomDialog("경고", "⚠️ 저장할 내용이 없습니다.");
        }
    });

    safeBind('btn-edit-close', 'click', function() {
        exitEditMode(true); 
    });

    // 상단 TTS 기능 버튼들
    safeBind('btn-tts-toggle', 'click', toggleTts);
    safeBind('btn-tts-settings', 'click', showTtsSettingsDialog);
    
    // 음성 정지 시 취소뿐 아니라 TTS 토글(OFF 모드)로 완벽하게 끄기
    safeBind('btn-tts-stop', 'click', function() {
        if (synthesis !== null) synthesis.cancel();
        if (state.isTtsEnabled === true) {
            state.isTtsEnabled = false; 
            refreshTtsButtonUI();       
        }
    });
    
    // 중앙 메뉴 6개 개편 연동
    safeBind('btn-history', 'click', function() {
        let list = getPrayerList();
        if (list.length === 0) showEmptyHistoryDialog();
        else showHistoryListDialog();
    });
    // 기도문 관리 버튼
    safeBind('btn-management', 'click', showManagementDialog);
    
    safeBind('btn-setting-name', 'click', showNameSettingDialog);
    safeBind('btn-setting-number', 'click', showAgeSettingDialog);
    safeBind('btn-setting-font', 'click', showFontDialog);
    safeBind('btn-exit', 'click', showExitConfirmDialog);

    // 하단 3버튼
    safeBind('btn-next', 'click', onNextStepClicked);
    safeBind('btn-once-more', 'click', handleRestartAction);
    safeBind('btn-previous', 'click', handlePreviousAction);
    
    // 타이머 영역 컨트롤 4버튼 제어 로직
    safeBind('btn-timer-resume', 'click', function(e) {
        e.stopPropagation();
        startTimer();
    });
    
    safeBind('btn-timer-pause', 'click', function(e) {
        e.stopPropagation();
        pauseTimer();
    });
    
    safeBind('btn-timer-stop', 'click', function(e) {
        e.stopPropagation();
        pauseTimer();
        state.hasStarted = false; 
        
        const timerLayout = document.getElementById('layout-timers');
        const topInput = document.getElementById('edit-text-input');
        
        if (timerLayout) timerLayout.classList.add('hidden'); 
        if (topInput && !state.isEditMode) topInput.classList.remove('hidden');
        
        applyReadyStatePrayerUI();
        updateTtsToolbarVisibility(); 
    });
    
    safeBind('btn-timer-reset', 'click', function(e) {
        e.stopPropagation();
        resetCurrentTimer();
    });

    safeBind('layout-timers', 'click', showTimerMenuDialog);
}

function refreshTtsButtonUI() {
    const ttsBtn = document.getElementById('btn-tts-toggle');
    const ttsStopBtn = document.getElementById('btn-tts-stop');
    
    if (ttsBtn === null) return;
    
    if (state.isTtsEnabled === true) {
        ttsBtn.innerText = "🔊 TTS 음성읽기 : ON";
        ttsBtn.classList.remove('bg-gray'); ttsBtn.classList.add('bg-green');
        ttsBtn.style.color = "#FFFFFF";
        if (ttsStopBtn) ttsStopBtn.classList.remove('hidden'); 
    } else {
        ttsBtn.innerText = "🔇 TTS 음성읽기 : OFF";
        ttsBtn.classList.remove('bg-green'); ttsBtn.classList.add('bg-gray');
        ttsBtn.style.color = "#495057";
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
        state.isGenerationMode = true; state.isYearMonthMode = false;
        state.currentGen = state.startGen;
    } else if (containsAgeFormat === true) {
        state.isGenerationMode = false;
        state.currentNumber = state.startNumber;
        state.currentYear = state.startYear;
        state.currentMonth = state.startMonth;
    }
    saveSettings();
}

function onNextStepClicked() {
    if (state.isEditMode) {
        exitEditMode(true);
    }

    const inputElement = document.getElementById('edit-text-input');
    const timerLayoutElement = document.getElementById('layout-timers');

    if (inputElement === null) return;
    const cleanedContent = inputElement.value.replace(/\s+/g, "");
    const cleanedWelcome = state.firstWelcomeMsg.replace(/\s+/g, "");
    
    if (cleanedContent === "" || cleanedContent === cleanedWelcome) {
        showSimpleBottomDialog("경고", "⚠️ 먼저 기도문을 입력하시거나, 기도문목록에서 기도를 불러와주세요."); 
        return;
    }
    
    // 다음 단계를 눌러 타이머가 시작될 때 비로소 숨겨놨던 타이머창을 보여줌
    if (timerLayoutElement !== null && timerLayoutElement.classList.contains('hidden') === true) {
        timerLayoutElement.classList.remove('hidden');
        inputElement.classList.add('hidden'); 
        autoDetectModeFromText(inputElement.value);
    }

    if (state.hasStarted === true) {
        if (increaseCounter() === false) return; 
    } else {
        state.hasStarted = true;
    }

    startTimer();
    updateDisplay();
}

function handlePreviousAction() {
    if (state.hasStarted === true) {
        if (decreaseCounter() === true) updateDisplay();
    }
}

function handleRestartAction() {
    if (state.isGenerationMode === true) {
        state.currentGen = state.startGen;
    } else {
        state.currentNumber = state.startNumber;
        state.currentYear = state.startYear;
        state.currentMonth = state.startMonth;
    }
    resetCurrentTimer(); startTimer(); updateDisplay();
    showSimpleBottomDialog("안내", "🔄 시작 지점으로 다시 돌아갔습니다.");
}

function increaseCounter() {
    if (state.isGenerationMode === true) {
        if (state.currentGen >= state.limitGen) { showSimpleBottomDialog("안내", "🏁 목표 조상 대(代)에 도달했습니다."); return false; }
        state.currentGen++;
    } else if (state.isYearMonthMode === true) {
        if (state.currentYear > state.limitYear || (state.currentYear === state.limitYear && state.currentMonth >= state.limitMonth)) {
            showSimpleBottomDialog("안내", "🏁 목표 나이에 도달했습니다."); return false;
        }
        state.currentMonth++;
        if (state.currentYear === 0 && state.currentMonth > 10) { state.currentMonth = 1; state.currentYear++; } 
        else if (state.currentMonth > 12) { state.currentMonth = 1; state.currentYear++; }
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
        if (state.currentYear <= state.startYear && state.currentMonth <= state.startMonth) {
            showSimpleBottomDialog("안내", "🏁 시작 지점입니다."); return false;
        }
        state.currentMonth--;
        if (state.currentMonth < 1) {
            if (state.currentYear > 0) { state.currentYear--; state.currentMonth = 12; } else { state.currentMonth = 1; }
        }
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
        const topInput = document.getElementById('edit-text-input');
        const bottomInput = document.getElementById('bottom-edit-input');
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
        if (topGuideText) {
            let rollingMessage = state.guideList[state.currentRollIndex % state.guideList.length] || "";
            topGuideText.innerHTML = rollingMessage.replace(/\n/g, "<br>");
        }
    } else {
        applyReadyStatePrayerUI();
    }
}

function applyReadyStatePrayerUI() {
    if (state.isEditMode) return;
    
    updateEditButtonUI(); 
    updateTtsToolbarVisibility(); 

    const outputElement = document.getElementById('text-output');
    const scrollBox = document.querySelector('.output-scroll-box');
    const inputElement = document.getElementById('edit-text-input');
    
    if (outputElement === null || inputElement === null) return;

    const rawContent = inputElement.value;
    const cleanedContent = rawContent.replace(/\s+/g, "");
    const cleanedWelcomeMsg = state.firstWelcomeMsg.replace(/\s+/g, "");

    // 대기 상태일 때는 타이머 창을 무조건 숨긴다
    const timerLayout = document.getElementById('layout-timers');
    if (state.hasStarted === false && timerLayout !== null) {
        timerLayout.classList.add('hidden');
    }

    if (cleanedContent === "" || cleanedContent === cleanedWelcomeMsg || rawContent.includes("다음단계]를 누르세요")) {
        if (scrollBox !== null) {
            scrollBox.style.justifyContent = "center";
            scrollBox.style.alignItems = "center";
        }
        let welcomeText = state.welcomeList.length > 0 ? state.welcomeList[state.currentRollIndex % state.welcomeList.length] : "환영합니다.";
        welcomeText = welcomeText.replace(/\[다음단계\]/g, `<span style="color:#34C759; font-weight:800; font-size:1.2em;">[다음단계]</span>`);
        outputElement.innerHTML = `<div style="text-align:center; color:#495057; font-size:16px;">${welcomeText.replace(/\n/g, "<br>")}</div>`;
        return;
    }

    if (scrollBox !== null) {
        scrollBox.style.justifyContent = "flex-start";
        scrollBox.style.alignItems = "stretch";
    }
    
    let activeUserName = getActiveUserName();
    let parsedText = rawContent;
    let isEditing = false; 

    parsedText = parsedText.replace(/<([^>]+)>\s*([이가])?/g, function(match, namePlaceholder, particle) {
        let nameToUse = (activeUserName.trim() !== "") ? activeUserName : (namePlaceholder || "");
        let hasJong = hasJongseong(nameToUse);
        let correctParticle = particle ? (hasJong ? "이" : "가") : "";
        let finalString = nameToUse + correctParticle;
        
        if (isEditing === false) return `<span style="color:#007AFF; font-weight:800;">${finalString}</span>`;
        return finalString;
    });

    if (state.isGenerationMode === true) {
        let targetGenWord = `${getSinoKoreanNumber(state.currentGen)}대`;
        let numberGenWord = `${state.currentGen}대`;
        let spanTpl1 = (isEditing === false) ? `<span style="color:#FF3B30; font-weight:800;">${targetGenWord}</span>` : targetGenWord;
        let spanTpl2 = (isEditing === false) ? `<span style="color:#FF3B30; font-weight:800;">${numberGenWord}</span>` : numberGenWord;
        
        parsedText = parsedText.replace(/\[\s*\d*\s*\]\s*대/g, spanTpl1);
        parsedText = parsedText.replace(/\[\s*\d*\s*\]/g, spanTpl2);
    } else {
        let targetAge = (state.isYearMonthMode === true) ? state.currentYear : state.currentNumber;
        let nativeAgeString = getNativeKoreanAge(targetAge);
        let targetWord = ""; let numWordStr = "";
        
        if (state.isYearMonthMode === true) {
            targetWord = (targetAge === 0) ? `태아 ${state.currentMonth}개월` : `${nativeAgeString}살 ${state.currentMonth}개월`;
            numWordStr = (targetAge === 0) ? `태아 ${state.currentMonth}개월` : `${targetAge}살 ${state.currentMonth}개월`;
        } else {
            targetWord = (targetAge === 0) ? "태아" : `${nativeAgeString}살`;
            numWordStr = (targetAge === 0) ? "태아" : `${targetAge}살`;
        }
        
        let spanTpl1 = (isEditing === false) ? `<span style="color:#FF3B30; font-weight:800;">${targetWord}</span>` : targetWord;
        let spanTpl2 = (isEditing === false) ? `<span style="color:#FF3B30; font-weight:800;">${numWordStr}</span>` : numWordStr;
        
        parsedText = parsedText.replace(/\[\s*\d*\s*\]\s*살/g, spanTpl1);
        parsedText = parsedText.replace(/\[\s*\d*\s*\]/g, spanTpl2);
    }

    let guidePrefix = "";
    if (state.hasStarted === false && rawContent !== state.firstWelcomeMsg) {
        guidePrefix = `<span style="color:#FF3B30; font-weight:bold; display:block; margin-bottom:10px;">[다음단계] 버튼을 눌러주세요</span>`;
    }
    
    outputElement.innerHTML = guidePrefix + parsedText.replace(/\n/g, "<br>");
    
    outputElement.style.color = state.outputTextColor;
    outputElement.style.fontSize = state.outputTextSize + "px";
}

function updateDisplay() {
    updateEditButtonUI(); 
    updateTtsToolbarVisibility(); 
    
    const inputElement = document.getElementById('edit-text-input');
    if (inputElement === null) return;
    
    applyReadyStatePrayerUI();

    if (state.isTtsEnabled === true) {
        let activeUserName = getActiveUserName();
        let textToRead = inputElement.value;
        
        textToRead = textToRead.replace(/<([^>]+)>\s*([이가])?/g, function(match, namePlaceholder, particle) {
            let nameToUse = (activeUserName.trim() !== "") ? activeUserName : (namePlaceholder || "");
            let hasJong = hasJongseong(nameToUse);
            return nameToUse + (particle ? (hasJong ? "이" : "가") : "");
        });

        if (state.isGenerationMode === true) {
            textToRead = textToRead.replace(/\[\s*\d*\s*\]\s*대/g, `${getSinoKoreanNumber(state.currentGen)}대`);
            textToRead = textToRead.replace(/\[\s*\d*\s*\]/g, `${state.currentGen}대`);
        } else {
            let targetAge = (state.isYearMonthMode === true) ? state.currentYear : state.currentNumber;
            let nativeAgeString = getNativeKoreanAge(targetAge);
            
            let targetWord = (state.isYearMonthMode === true) ? 
                ((targetAge === 0) ? `태아 ${state.currentMonth}개월` : `${nativeAgeString}살 ${state.currentMonth}개월`) : 
                ((targetAge === 0) ? "태아" : `${nativeAgeString}살`);
                
            let numWordStr = (state.isYearMonthMode === true) ? 
                ((targetAge === 0) ? `태아 ${state.currentMonth}개월` : `${targetAge}살 ${state.currentMonth}개월`) : 
                ((targetAge === 0) ? "태아" : `${targetAge}살`);
                
            textToRead = textToRead.replace(/\[\s*\d*\s*\]\s*살/g, targetWord);
            textToRead = textToRead.replace(/\[\s*\d*\s*\]/g, numWordStr);
        }
        
        if (synthesis !== null) {
            synthesis.cancel();
            let utterance = new SpeechSynthesisUtterance(textToRead);
            utterance.rate = state.ttsSpeed;
            
            let voiceList = synthesis.getVoices();
            let selectedVoice = voiceList.find(voice => voice.name === state.selectedVoiceName);
            if (selectedVoice !== undefined) utterance.voice = selectedVoice;
            
            synthesis.speak(utterance);
        }
    }
}

function restoreOutputDisplay() {
    if (state.hasStarted === true) updateDisplay();
    else applyReadyStatePrayerUI();
}

// ============================================================================
// 7. 타이머 제어 로직
// ============================================================================
function startTimer() {
    if (state.isTimerRunning === false) {
        state.isTimerRunning = true;
        timerInterval = setInterval(timerRunnable, 1000);
        
        const btnResume = document.getElementById('btn-timer-resume');
        const btnPause = document.getElementById('btn-timer-pause');
        if (btnResume) btnResume.classList.add('hidden');
        if (btnPause) btnPause.classList.remove('hidden');
    }
}

function pauseTimer() {
    state.isTimerRunning = false;
    clearInterval(timerInterval);
    if (synthesis !== null) synthesis.cancel();
    
    const btnResume = document.getElementById('btn-timer-resume');
    const btnPause = document.getElementById('btn-timer-pause');
    if (btnResume) btnResume.classList.remove('hidden');
    if (btnPause) btnPause.classList.add('hidden');
}

function timerRunnable() {
    if (state.isTimerRunning === true) {
        state.secondsCurrent++;
        state.secondsTotal++;
        updateTimerUI();
    }
}

function updateTimerUI() {
    const padFormat = (num) => String(num).padStart(2, '0');
    let currentHours = Math.floor(state.secondsCurrent / 3600);
    let currentMinutes = Math.floor((state.secondsCurrent % 3600) / 60);
    let currentSecs = state.secondsCurrent % 60;
    
    let totalHours = Math.floor(state.secondsTotal / 3600);
    let totalMinutes = Math.floor((state.secondsTotal % 3600) / 60);
    let totalSecs = state.secondsTotal % 60;
    
    let timerCurrentEl = document.getElementById('text-timer-current');
    if (timerCurrentEl !== null) timerCurrentEl.innerText = `${padFormat(currentHours)}:${padFormat(currentMinutes)}:${padFormat(currentSecs)}`;
    
    let timerTotalEl = document.getElementById('text-timer-total');
    if (timerTotalEl !== null) timerTotalEl.innerText = `누적 ${padFormat(totalHours)}:${padFormat(totalMinutes)}:${padFormat(totalSecs)}`;
}

function resetCurrentTimer() {
    state.secondsCurrent = 0; updateTimerUI();
}

// ============================================================================
// 8. 언어 변환 유틸리티
// ============================================================================
function getNativeKoreanAge(ageNumber) {
    if (ageNumber === 0) return "태아";
    if (ageNumber >= 100) return getSinoKoreanNumber(ageNumber) + "살";
    
    const tensArray = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"];
    const unitsArray = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"];
    if (ageNumber === 20) return "스무";
    
    const tensPosition = Math.floor(ageNumber / 10);
    const unitsPosition = ageNumber % 10;
    
    if (tensPosition === 0) return unitsArray[unitsPosition];
    if (unitsPosition === 0) return tensArray[tensPosition];
    return tensArray[tensPosition] + unitsArray[unitsPosition];
}

function getSinoKoreanNumber(num) {
    if (num === 0) return "영";
    if (num >= 1000) return num.toString();
    const units = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    const tens = ["", "십", "이십", "삼십", "사십", "오십", "육십", "칠십", "팔십", "구십"];
    const hundreds = ["", "백", "이백", "삼백", "사백", "오백", "육백", "칠백", "팔백", "구백"];
    
    const h = Math.floor(num / 100); const t = Math.floor((num % 100) / 10); const u = num % 10;
    let resultString = hundreds[h];
    if (t === 1 && h === 0) resultString += "십";
    else resultString += tens[t];
    resultString += units[u];
    return resultString;
}

function hasJongseong(textString) {
    if (!textString || textString.length === 0) return false;
    const charCode = textString.charCodeAt(textString.length - 1);
    if (charCode < 0xAC00 || charCode > 0xD7A3) return false; 
    return (charCode - 0xAC00) % 28 > 0;
}

function getActiveUserName() {
    let persistentData = getLocalData();
    let activeIndex = persistentData.activeNameIndex || 0;
    if (activeIndex === 0) return "";
    let nameListArray = [];
    try { nameListArray = JSON.parse(persistentData.userNamesList || '[]'); } catch(error) {}
    if (activeIndex - 1 < nameListArray.length) return nameListArray[activeIndex - 1];
    return "";
}

function toggleTts() {
    if (state.isTtsEnabled === true) {
        state.isTtsEnabled = false;
        refreshTtsButtonUI();
        if (synthesis !== null) synthesis.cancel();
    } else {
        const container = createEl('div', 'text-align:center; padding:10px 0; font-size:16px; color:#1A1A1C; line-height:1.5;');
        container.innerHTML = "자동으로 기도문을 소리내어<br>읽어드릴까요?";
        
        showCustomDialogWithFooter("🗣️ 음성 읽기", container, "저장(적용)", function() {
            state.isTtsEnabled = true;
            refreshTtsButtonUI();
            updateDisplay();
            closeModal();
        });
    }
}

function speakPreview() {
    if (synthesis === null) return;
    synthesis.cancel();
    let previewUtterance = new SpeechSynthesisUtterance("회개하자, 회개기도문 미리듣기 입니다");
    previewUtterance.rate = state.ttsSpeed;
    let voicesArray = synthesis.getVoices();
    let voiceToUse = voicesArray.find(v => v.name === state.selectedVoiceName);
    if (voiceToUse !== undefined) previewUtterance.voice = voiceToUse;
    synthesis.speak(previewUtterance);
}

// ============================================================================
// 9. 안드로이드 머티리얼 모달 엔진
// ============================================================================
function showCustomDialog(titleText, contentDomElement, positiveBtnText, onPositiveClickCallback, isLargeModal = false) {
    const overlayElement = document.getElementById('modal-overlay');
    const dialogBox = document.querySelector('.dialog-box');
    if (!overlayElement || !dialogBox) return;
    
    if (isLargeModal) {
        dialogBox.classList.add('large-modal');
    } else {
        dialogBox.classList.remove('large-modal');
    }
    
    document.getElementById('modal-title').innerText = titleText;
    
    const bodyElement = document.getElementById('modal-content');
    bodyElement.innerHTML = ''; 
    bodyElement.appendChild(contentDomElement);
    
    document.getElementById('modal-header-actions').classList.remove('hidden');
    document.getElementById('modal-divider-top').classList.remove('hidden');
    document.getElementById('modal-divider-bottom').classList.add('hidden');
    document.getElementById('modal-footer-actions').classList.add('hidden');
    
    const positiveBtn = document.getElementById('modal-btn-positive');
    const negativeBtn = document.getElementById('modal-btn-negative');
    
    if (negativeBtn) negativeBtn.innerText = "닫기(취소)";
    
    if (positiveBtnText && onPositiveClickCallback) {
        positiveBtn.innerText = positiveBtnText; 
        positiveBtn.classList.remove('hidden');
        positiveBtn.onclick = onPositiveClickCallback;
    } else {
        if (positiveBtn) positiveBtn.classList.add('hidden');
    }
    
    overlayElement.classList.remove('hidden');
}

function showCustomDialogWithFooter(titleText, contentDomElement, positiveBtnText, onPositiveClickCallback) {
    const overlayElement = document.getElementById('modal-overlay');
    const dialogBox = document.querySelector('.dialog-box');
    if (!overlayElement || !dialogBox) return;
    
    dialogBox.classList.remove('large-modal'); 
    document.getElementById('modal-title').innerText = titleText;
    
    const bodyElement = document.getElementById('modal-content');
    bodyElement.innerHTML = ''; 
    bodyElement.appendChild(contentDomElement);
    
    document.getElementById('modal-header-actions').classList.add('hidden');
    document.getElementById('modal-divider-top').classList.add('hidden');
    document.getElementById('modal-divider-bottom').classList.remove('hidden');
    document.getElementById('modal-footer-actions').classList.remove('hidden');
    
    const footerNegBtn = document.getElementById('modal-btn-bottom-negative');
    const footerPosBtn = document.getElementById('modal-btn-bottom-positive');
    
    if (footerNegBtn) footerNegBtn.innerText = "닫기(취소)";
    
    if (positiveBtnText && onPositiveClickCallback) {
        footerPosBtn.innerText = positiveBtnText; 
        footerPosBtn.classList.remove('hidden');
        footerPosBtn.onclick = onPositiveClickCallback;
    } else {
        if (footerPosBtn) footerPosBtn.classList.add('hidden');
    }
    
    overlayElement.classList.remove('hidden');
}

function showSimpleBottomDialog(titleStr, messageStr) {
    const container = createEl('div', 'text-align:center; padding:10px 0; font-size:15px; color:#1A1A1C; line-height:1.5;');
    container.innerHTML = messageStr;
    showCustomDialogWithFooter(titleStr, container, null, null);
}

function closeModal() {
    const overlayElement = document.getElementById('modal-overlay');
    if (overlayElement !== null) overlayElement.classList.add('hidden');
}

function createEl(tagName, cssText, innerHTMLText) {
    const element = document.createElement(tagName);
    if (cssText) element.style.cssText = "box-sizing: border-box; " + cssText;
    if (innerHTMLText) element.innerHTML = innerHTMLText;
    return element;
}

// ============================================================================
// 10. 각종 설정 팝업 제어 함수
// ============================================================================

function showFontDialog() {
    const container = document.createElement('div');
    container.style.cssText = "width: 100%; box-sizing: border-box;";
    
    const titleFontSize = createEl('div', 'font-weight:bold; font-size:16px; margin-bottom:12px; color:#1A1A1C;', '글자 크기 (px)');
    container.appendChild(titleFontSize);
    
    const stepperBox = createEl('div', 'display:flex; align-items:center; margin-bottom:24px; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinus = createEl('button', 'padding:16px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➖');
    btnMinus.type = "button";
    const btnPlus = createEl('button', 'padding:16px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➕');
    btnPlus.type = "button";
    
    const inputSize = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:20px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;');
    inputSize.type = 'number';
    inputSize.value = (state.outputTextSize !== undefined) ? state.outputTextSize : 22; 
    
    btnMinus.addEventListener('click', function() {
        let currentVal = parseInt(inputSize.value, 10);
        if (isNaN(currentVal)) currentVal = 22;
        if (currentVal > 10) inputSize.value = currentVal - 1;
    });
    
    btnPlus.addEventListener('click', function() {
        let currentVal = parseInt(inputSize.value, 10);
        if (isNaN(currentVal)) currentVal = 22;
        if (currentVal < 100) inputSize.value = currentVal + 1;
    });
    
    stepperBox.appendChild(btnMinus);
    stepperBox.appendChild(inputSize);
    stepperBox.appendChild(btnPlus);
    container.appendChild(stepperBox);
    
    const titleFontColor = createEl('div', 'font-weight:bold; font-size:16px; margin-bottom:12px; color:#1A1A1C;', '폰트 색상 테마');
    container.appendChild(titleFontColor);
    
    const colorRowBox = createEl('div', 'display:flex; flex-direction:column; gap:10px;');
    const colorThemes = [
        ["기본 다크", "#1A1A1C"], ["프리미엄 블루", "#007AFF"], ["포레스트 그린", "#34C759"], ["로열 퍼플", "#5856D6"]
    ];
    let selectedColor = state.outputTextColor || "#1A1A1C"; 
    
    colorThemes.forEach(function(themeData) {
        const labelEl = createEl('label', 'display:flex; align-items:center; background:#F8F9FA; padding:14px; border-radius:12px; cursor:pointer;');
        const radioBtn = createEl('input', 'margin-right:12px; transform:scale(1.3); cursor:pointer;');
        radioBtn.type = 'radio'; radioBtn.name = 'fontColorOption'; radioBtn.value = themeData[1];
        if (selectedColor === themeData[1]) radioBtn.checked = true;
        
        radioBtn.addEventListener('change', function() { selectedColor = themeData[1]; });
        const colorNameSpan = createEl('span', `color:${themeData[1]}; font-size:16px; font-weight:bold;`, themeData[0]);
        
        labelEl.appendChild(radioBtn); labelEl.appendChild(colorNameSpan);
        colorRowBox.appendChild(labelEl);
    });
    container.appendChild(colorRowBox);
    
    showCustomDialog("🎨 폰트 스타일", container, "저장(적용)", function() {
        let parsedSize = parseInt(inputSize.value, 10);
        state.outputTextSize = isNaN(parsedSize) ? 22 : parsedSize;
        state.outputTextColor = selectedColor;
        state.isManualFontOverride = true;
        
        saveSettings();
        applyReadyStatePrayerUI();
        closeModal();
    });
}

function showAgeSettingDialog() {
    const container = document.createElement('div');
    container.style.cssText = "width: 100%; box-sizing: border-box;";
    const menuOptions = ["🎯 일반 나이 설정", "🗓️ 나이-개월 상세 설정", "🌳 가문·조상 대(代) 설정"];
    
    menuOptions.forEach(function(menuText, index) {
        const menuBtn = createEl('button', 'width:100%; background:#F8F9FA; border:none; border-radius:12px; padding:18px; margin-bottom:12px; font-weight:bold; font-size:16px; color:#1A1A1C; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.02);', menuText);
        menuBtn.type = "button";
        menuBtn.addEventListener('click', function() {
            closeModal();
            if (index === 0) showRegularNumberDialog();
            else if (index === 1) showYearMonthDialog();
            else showGenerationDialog();
        });
        container.appendChild(menuBtn);
    });
    showCustomDialog("⚙️ 증감 방식 선택", container, null, null);
}

function showRegularNumberDialog() {
    const container = document.createElement('div');
    container.style.cssText = "width: 100%; box-sizing: border-box;";
    
    const titleStart = createEl('div', 'font-size:14px; font-weight:bold; margin-bottom:8px; color:#8E8E93;', '시작 나이 지점');
    container.appendChild(titleStart);
    
    const rowStart = createEl('div', 'display:flex; align-items:center; margin-bottom:20px;');
    const boxStart = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    
    const btnMinusStart = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➖');
    btnMinusStart.type = "button";
    const btnPlusStart = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➕');
    btnPlusStart.type = "button";
    
    const inputStart = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:20px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;');
    inputStart.type = 'number';
    inputStart.value = (state.startNumber !== undefined) ? state.startNumber : 0; 
    
    btnMinusStart.addEventListener('click', function() { 
        let currentVal = parseInt(inputStart.value, 10); if (isNaN(currentVal)) currentVal = 0; 
        if (currentVal > 0) inputStart.value = currentVal - 1; 
    });
    btnPlusStart.addEventListener('click', function() { 
        let currentVal = parseInt(inputStart.value, 10); if (isNaN(currentVal)) currentVal = 0; 
        if (currentVal < 999) inputStart.value = currentVal + 1; 
    });
    
    boxStart.appendChild(btnMinusStart); boxStart.appendChild(inputStart); boxStart.appendChild(btnPlusStart);
    rowStart.appendChild(boxStart); rowStart.appendChild(createEl('div', 'padding-left:12px; font-weight:bold; font-size:16px; color:#1A1A1C;', '살'));
    container.appendChild(rowStart);
    
    const titleLimit = createEl('div', 'font-size:14px; font-weight:bold; margin-bottom:8px; color:#8E8E93;', '목표 나이 지점');
    container.appendChild(titleLimit);
    
    const rowLimit = createEl('div', 'display:flex; align-items:center; margin-bottom:24px;');
    const boxLimit = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    
    const btnMinusLimit = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➖');
    btnMinusLimit.type = "button";
    const btnPlusLimit = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➕');
    btnPlusLimit.type = "button";
    
    const inputLimit = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:20px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;');
    inputLimit.type = 'number';
    inputLimit.value = (state.limitNumber !== undefined) ? state.limitNumber : 100;
    
    btnMinusLimit.addEventListener('click', function() { 
        let currentVal = parseInt(inputLimit.value, 10); if (isNaN(currentVal)) currentVal = 0; 
        if (currentVal > 0) inputLimit.value = currentVal - 1; 
    });
    btnPlusLimit.addEventListener('click', function() { 
        let currentVal = parseInt(inputLimit.value, 10); if (isNaN(currentVal)) currentVal = 0; 
        if (currentVal < 999) inputLimit.value = currentVal + 1; 
    });
    
    boxLimit.appendChild(btnMinusLimit); boxLimit.appendChild(inputLimit); boxLimit.appendChild(btnPlusLimit);
    rowLimit.appendChild(boxLimit); rowLimit.appendChild(createEl('div', 'padding-left:12px; font-weight:bold; font-size:16px; color:#1A1A1C;', '살'));
    container.appendChild(rowLimit);
    
    showCustomDialog("🎯 일반 나이 설정", container, "저장(적용)", function() {
        state.isYearMonthMode = false; state.isGenerationMode = false;
        
        let startVal = parseInt(inputStart.value, 10); state.startNumber = isNaN(startVal) ? 0 : startVal;
        let limitVal = parseInt(inputLimit.value, 10); state.limitNumber = isNaN(limitVal) ? 100 : limitVal;
        state.currentNumber = state.startNumber;
        
        saveSettings(); resetCurrentTimer(); state.hasStarted = false; pauseTimer();
        
        const inputEl = document.getElementById('edit-text-input');
        const timerLayout = document.getElementById('layout-timers');
        if (inputEl !== null && !state.isEditMode) inputEl.classList.remove('hidden');
        if (timerLayout !== null) timerLayout.classList.add('hidden'); 
        
        applyReadyStatePrayerUI();
        closeModal();
        showSimpleBottomDialog("안내", "⚙️ 설정이 저장되었습니다.");
    });
}

function showYearMonthDialog() {
    const container = document.createElement('div');
    container.style.cssText = "width: 100%; box-sizing: border-box;";
    
    const titleStartRow = createEl('div', 'display:flex; text-align:center; font-weight:bold; font-size:14px; margin-bottom:8px; color:#8E8E93;');
    titleStartRow.innerHTML = `<div style="flex:1;">시작 나이</div><div style="flex:1;">시작 개월</div>`;
    container.appendChild(titleStartRow);
    const rowStartBoxes = createEl('div', 'display:flex; gap:12px; margin-bottom:24px;');
    
    const boxStartYear = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusStartYear = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➖');
    btnMinusStartYear.type = "button";
    const btnPlusStartYear = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➕');
    btnPlusStartYear.type = "button";
    const inputStartYear = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:16px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;');
    inputStartYear.type = 'number'; inputStartYear.value = (state.startYear !== undefined) ? state.startYear : 0;
    
    btnMinusStartYear.addEventListener('click', function() { let v = parseInt(inputStartYear.value, 10); if(isNaN(v)) v=0; if(v>0) inputStartYear.value = v-1; });
    btnPlusStartYear.addEventListener('click', function() { let v = parseInt(inputStartYear.value, 10); if(isNaN(v)) v=0; if(v<99) inputStartYear.value = v+1; });
    boxStartYear.appendChild(btnMinusStartYear); boxStartYear.appendChild(inputStartYear); boxStartYear.appendChild(btnPlusStartYear);
    
    const boxStartMonth = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusStartMonth = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➖');
    btnMinusStartMonth.type = "button";
    const btnPlusStartMonth = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➕');
    btnPlusStartMonth.type = "button";
    const inputStartMonth = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:16px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;');
    inputStartMonth.type = 'number'; inputStartMonth.value = (state.startMonth !== undefined) ? state.startMonth : 1;
    
    btnMinusStartMonth.addEventListener('click', function() { let v = parseInt(inputStartMonth.value, 10); if(isNaN(v)) v=1; if(v>1) inputStartMonth.value = v-1; });
    btnPlusStartMonth.addEventListener('click', function() { let v = parseInt(inputStartMonth.value, 10); if(isNaN(v)) v=1; if(v<12) inputStartMonth.value = v+1; });
    boxStartMonth.appendChild(btnMinusStartMonth); boxStartMonth.appendChild(inputStartMonth); boxStartMonth.appendChild(btnPlusStartMonth);
    
    rowStartBoxes.appendChild(boxStartYear); rowStartBoxes.appendChild(boxStartMonth);
    container.appendChild(rowStartBoxes);
    
    const titleLimitRow = createEl('div', 'display:flex; text-align:center; font-weight:bold; font-size:14px; margin-bottom:8px; color:#8E8E93;');
    titleLimitRow.innerHTML = `<div style="flex:1;">목표 나이</div><div style="flex:1;">목표 개월</div>`;
    container.appendChild(titleLimitRow);
    const rowLimitBoxes = createEl('div', 'display:flex; gap:12px; margin-bottom:12px;');
    
    const boxLimitYear = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusLimitYear = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➖');
    btnMinusLimitYear.type = "button";
    const btnPlusLimitYear = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➕');
    btnPlusLimitYear.type = "button";
    const inputLimitYear = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:16px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;');
    inputLimitYear.type = 'number'; inputLimitYear.value = (state.limitYear !== undefined) ? state.limitYear : 99;
    
    btnMinusLimitYear.addEventListener('click', function() { let v = parseInt(inputLimitYear.value, 10); if(isNaN(v)) v=99; if(v>0) inputLimitYear.value = v-1; });
    btnPlusLimitYear.addEventListener('click', function() { let v = parseInt(inputLimitYear.value, 10); if(isNaN(v)) v=99; if(v<99) inputLimitYear.value = v+1; });
    boxLimitYear.appendChild(btnMinusLimitYear); boxLimitYear.appendChild(inputLimitYear); boxLimitYear.appendChild(btnPlusLimitYear);
    
    const boxLimitMonth = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusLimitMonth = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➖');
    btnMinusLimitMonth.type = "button";
    const btnPlusLimitMonth = createEl('button', 'padding:12px; border:none; background:none; cursor:pointer;', '➕');
    btnPlusLimitMonth.type = "button";
    const inputLimitMonth = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:16px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;');
    inputLimitMonth.type = 'number'; inputLimitMonth.value = (state.limitMonth !== undefined) ? state.limitMonth : 12;
    
    btnMinusLimitMonth.addEventListener('click', function() { let v = parseInt(inputLimitMonth.value, 10); if(isNaN(v)) v=12; if(v>1) inputLimitMonth.value = v-1; });
    btnPlusLimitMonth.addEventListener('click', function() { let v = parseInt(inputLimitMonth.value, 10); if(isNaN(v)) v=12; if(v<12) inputLimitMonth.value = v+1; });
    boxLimitMonth.appendChild(btnMinusLimitMonth); boxLimitMonth.appendChild(inputLimitMonth); boxLimitMonth.appendChild(btnPlusLimitMonth);
    
    rowLimitBoxes.appendChild(boxLimitYear); rowLimitBoxes.appendChild(boxLimitMonth);
    container.appendChild(rowLimitBoxes);
    
    showCustomDialog("🗓️ 나이-개월 설정", container, "저장(적용)", function() {
        state.isYearMonthMode = true; state.isGenerationMode = false;
        let yStart = parseInt(inputStartYear.value, 10); state.startYear = isNaN(yStart) ? 0 : yStart;
        let mStart = parseInt(inputStartMonth.value, 10); state.startMonth = isNaN(mStart) ? 1 : mStart;
        let yLimit = parseInt(inputLimitYear.value, 10); state.limitYear = isNaN(yLimit) ? 99 : yLimit;
        let mLimit = parseInt(inputLimitMonth.value, 10); state.limitMonth = isNaN(mLimit) ? 12 : mLimit;
        state.currentYear = state.startYear; state.currentMonth = state.startMonth;
        
        saveSettings(); resetCurrentTimer(); state.hasStarted = false; pauseTimer();
        const inputEl = document.getElementById('edit-text-input');
        const timerLayout = document.getElementById('layout-timers');
        if (inputEl !== null && !state.isEditMode) inputEl.classList.remove('hidden');
        if (timerLayout !== null) timerLayout.classList.add('hidden'); 
        
        applyReadyStatePrayerUI(); closeModal(); 
        showSimpleBottomDialog("안내", "🗓️ 상세 설정이 저장되었습니다.");
    });
}

function showGenerationDialog() {
    const container = document.createElement('div');
    container.style.cssText = "width: 100%; box-sizing: border-box;";
    
    const titleStart = createEl('div', 'font-size:14px; font-weight:bold; margin-bottom:8px; color:#8E8E93;', '시작 가문/조상 대(代) 지점');
    container.appendChild(titleStart);
    const rowStart = createEl('div', 'display:flex; align-items:center; margin-bottom:20px;');
    const boxStart = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusStart = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➖');
    btnMinusStart.type = "button";
    const btnPlusStart = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➕');
    btnPlusStart.type = "button";
    const inputStart = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:20px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;');
    inputStart.type = 'number'; inputStart.value = (state.startGen !== undefined) ? state.startGen : 1;
    
    btnMinusStart.addEventListener('click', function() { let currentVal = parseInt(inputStart.value, 10); if (isNaN(currentVal)) currentVal = 1; if (currentVal > 1) inputStart.value = currentVal - 1; });
    btnPlusStart.addEventListener('click', function() { let currentVal = parseInt(inputStart.value, 10); if (isNaN(currentVal)) currentVal = 1; if (currentVal < 999) inputStart.value = currentVal + 1; });
    
    boxStart.appendChild(btnMinusStart); boxStart.appendChild(inputStart); boxStart.appendChild(btnPlusStart);
    rowStart.appendChild(boxStart); rowStart.appendChild(createEl('div', 'padding-left:12px; font-weight:bold; font-size:16px; color:#1A1A1C;', '대'));
    container.appendChild(rowStart);
    
    const titleLimit = createEl('div', 'font-size:14px; font-weight:bold; margin-bottom:8px; color:#8E8E93;', '목표 가문/조상 대(代) 지점');
    container.appendChild(titleLimit);
    const rowLimit = createEl('div', 'display:flex; align-items:center; margin-bottom:12px;');
    const boxLimit = createEl('div', 'display:flex; flex:1; background:#F8F9FA; border-radius:12px; padding:4px;');
    const btnMinusLimit = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➖');
    btnMinusLimit.type = "button";
    const btnPlusLimit = createEl('button', 'padding:14px 20px; border:none; background:none; cursor:pointer; font-size:18px;', '➕');
    btnPlusLimit.type = "button";
    const inputLimit = createEl('input', 'flex:1; text-align:center; border:none; background:transparent; font-size:20px; font-weight:bold; outline:none; width:100%; color:#1A1A1C;');
    inputLimit.type = 'number'; inputLimit.value = (state.limitGen !== undefined) ? state.limitGen : 30;
    
    btnMinusLimit.addEventListener('click', function() { let currentVal = parseInt(inputLimit.value, 10); if (isNaN(currentVal)) currentVal = 30; if (currentVal > 1) inputLimit.value = currentVal - 1; });
    btnPlusLimit.addEventListener('click', function() { let currentVal = parseInt(inputLimit.value, 10); if (isNaN(currentVal)) currentVal = 30; if (currentVal < 999) inputLimit.value = currentVal + 1; });
    
    boxLimit.appendChild(btnMinusLimit); boxLimit.appendChild(inputLimit); boxLimit.appendChild(btnPlusLimit);
    rowLimit.appendChild(boxLimit); rowLimit.appendChild(createEl('div', 'padding-left:12px; font-weight:bold; font-size:16px; color:#1A1A1C;', '대'));
    container.appendChild(rowLimit);
    
    showCustomDialog("🌳 가문·조상 대(代) 설정", container, "저장(적용)", function() {
        state.isGenerationMode = true; state.isYearMonthMode = false;
        let startVal = parseInt(inputStart.value, 10); state.startGen = isNaN(startVal) ? 1 : startVal;
        let limitVal = parseInt(inputLimit.value, 10); state.limitGen = isNaN(limitVal) ? 30 : limitVal;
        state.currentGen = state.startGen;
        
        saveSettings(); resetCurrentTimer(); state.hasStarted = false; pauseTimer();
        const inputEl = document.getElementById('edit-text-input');
        const timerLayout = document.getElementById('layout-timers');
        if (inputEl !== null && !state.isEditMode) inputEl.classList.remove('hidden');
        if (timerLayout !== null) timerLayout.classList.add('hidden'); 
        
        applyReadyStatePrayerUI(); closeModal(); 
        showSimpleBottomDialog("안내", "🌳 대(代) 설정이 저장되었습니다.");
    });
}

function showNameSettingDialog() {
    let persistentData = getLocalData();
    let activeIndex = persistentData.activeNameIndex || 0;
    let nameListArray = [];
    try { nameListArray = JSON.parse(persistentData.userNamesList || '[]'); } catch(error) { nameListArray = []; }
    while(nameListArray.length < 9) nameListArray.push("");

    const container = document.createElement('div');
    container.style.cssText = "width: 100%; box-sizing: border-box;";
    const descriptionTitle = createEl('div', 'font-weight:bold; color:#1A1A1C; font-size:15px; margin-bottom:16px; text-align:center;', '사용하실 성함을 선택하거나 입력하세요.');
    container.appendChild(descriptionTitle);
    
    const textInputNodes = []; const radioBtnNodes = [];
    for (let index = 0; index < 9; index++) {
        const rowBox = createEl('div', 'display:flex; align-items:center; margin-bottom:10px; background:#F8F9FA; padding:8px 12px; border-radius:10px;');
        const radioBtn = createEl('input', 'margin-right:12px; transform:scale(1.2); cursor:pointer;');
        radioBtn.type = 'radio'; radioBtn.name = 'nameSelection'; radioBtn.value = index;
        if (activeIndex === index) radioBtn.checked = true;
        radioBtnNodes.push(radioBtn);
        
        let labelOrInput;
        if (index === 0) {
            labelOrInput = createEl('label', 'flex:1; color:#007AFF; font-weight:bold; font-size:15px; cursor:pointer;', '&lt;원본이름&gt;');
        } else {
            labelOrInput = createEl('input', 'flex:1; padding:6px; border:none; background:transparent; font-size:15px; outline:none; width:100%; color:#1A1A1C;');
            labelOrInput.type = 'text'; labelOrInput.value = nameListArray[index - 1]; labelOrInput.placeholder = `이름 ${index}`;
            labelOrInput.addEventListener('focus', function() { radioBtn.checked = true; });
            textInputNodes.push(labelOrInput);
        }
        
        rowBox.addEventListener('click', function(event) {
            if (event.target !== radioBtn && event.target !== labelOrInput) radioBtn.checked = true;
        });
        rowBox.appendChild(radioBtn); rowBox.appendChild(labelOrInput); container.appendChild(rowBox);
    }
    
    showCustomDialog("👤 이름 설정", container, "저장(적용)", function() {
        let selectedIndex = 0;
        radioBtnNodes.forEach(function(radio) { if (radio.checked === true) selectedIndex = parseInt(radio.value, 10); });
        let newNameList = [];
        textInputNodes.forEach(function(inputNode) { newNameList.push(inputNode.value.trim()); });
        
        let currentData = getLocalData();
        currentData.activeNameIndex = selectedIndex; currentData.userNamesList = JSON.stringify(newNameList);
        saveLocalData(currentData);
        
        const topInputEl = document.getElementById('edit-text-input');
        if (topInputEl !== null && topInputEl.classList.contains('hidden') && !state.isEditMode) {
            updateDisplay();
        } else {
            applyReadyStatePrayerUI();
        }
        
        closeModal(); 
        showSimpleBottomDialog("안내", "👤 이름 설정이 저장되었습니다.");
    });
}

function showTtsSettingsDialog() {
    const container = document.createElement('div');
    container.style.cssText = "width: 100%; box-sizing: border-box;";
    const speedTitle = createEl('div', 'font-weight:bold; font-size:14px; color:#8E8E93; margin-bottom:12px;', '읽기 속도 설정');
    container.appendChild(speedTitle);
    
    const speedRowBox = createEl('div', 'display:flex; flex-wrap:wrap; margin-bottom:20px; gap:8px;');
    const allowedSpeeds = [0.5, 0.75, 1.0, 1.3, 1.6];
    
    allowedSpeeds.forEach(function(speedValue) {
        const labelBox = createEl('label', 'flex:1 1 45%; background:#F8F9FA; padding:10px; border-radius:8px; display:flex; align-items:center; cursor:pointer;');
        const radioBtn = createEl('input', 'margin-right:8px; transform:scale(1.2);');
        radioBtn.type = 'radio'; radioBtn.name = 'ttsSpeedSelection'; radioBtn.value = speedValue;
        if (Math.abs(state.ttsSpeed - speedValue) < 0.05) radioBtn.checked = true;
        
        radioBtn.addEventListener('change', function() { state.ttsSpeed = speedValue; saveSettings(); speakPreview(); });
        const speedText = createEl('span', 'font-size:14px; font-weight:bold; color:#1A1A1C;', `${speedValue}배속`);
        labelBox.appendChild(radioBtn); labelBox.appendChild(speedText); speedRowBox.appendChild(labelBox);
    });
    container.appendChild(speedRowBox);
    
    const voiceTitle = createEl('div', 'font-weight:bold; font-size:14px; color:#8E8E93; margin-bottom:12px;', '목소리 종류 선택');
    container.appendChild(voiceTitle);
    const voiceRowBox = createEl('div', 'display:flex; flex-direction:column; gap:8px;');
    
    if (synthesis !== null) {
        let availableVoices = synthesis.getVoices().filter(voice => voice.lang.includes('ko')).slice(0, 4);
        if (availableVoices.length === 0) {
            voiceRowBox.innerHTML = "<div style='color:#8E8E93; font-size:13px;'>지원하는 한국어 음성이 없습니다.</div>";
        } else {
            availableVoices.forEach(function(voice, index) {
                const labelBox = createEl('label', 'background:#F8F9FA; padding:12px; border-radius:8px; display:flex; align-items:center; cursor:pointer;');
                const radioBtn = createEl('input', 'margin-right:10px; transform:scale(1.2);');
                radioBtn.type = 'radio'; radioBtn.name = 'ttsVoiceSelection'; radioBtn.value = voice.name;
                if (state.selectedVoiceName === voice.name || (state.selectedVoiceName === null && index === 0)) radioBtn.checked = true;
                
                radioBtn.addEventListener('change', function() { state.selectedVoiceName = voice.name; saveSettings(); speakPreview(); });
                const voiceText = createEl('span', 'font-size:14px; font-weight:bold; color:#1A1A1C;', `목소리 ${index + 1}`);
                labelBox.appendChild(radioBtn); labelBox.appendChild(voiceText); voiceRowBox.appendChild(labelBox);
            });
        }
    }
    container.appendChild(voiceRowBox);
    showCustomDialog("🔊 음성 상세 설정", container, "저장(적용)", function() { closeModal(); }, false);
}

// ============================================================================
// 11. 기도문 히스토리 관리 및 수정 저장 로직
// ============================================================================
function getPrayerList() {
    let persistentData = getLocalData();
    let parsedArray = [];
    try { parsedArray = JSON.parse(persistentData.savedList || '[]'); } catch(error) { parsedArray = []; }
    let resultList = []; let currentTimestamp = Date.now();
    for (let i = 0; i < parsedArray.length; i++) {
        let itemObj = parsedArray[i];
        if (typeof itemObj === 'object') {
            resultList.push({ text: itemObj.text || "", addedAt: itemObj.addedAt || (currentTimestamp - i), lastUsed: itemObj.lastUsed || 0, useCount: itemObj.useCount || 0 });
        } else {
            resultList.push({ text: itemObj, addedAt: currentTimestamp - i, lastUsed: 0, useCount: 0 });
        }
    }
    return resultList;
}

function savePrayerList(newListArray) {
    let persistentData = getLocalData();
    persistentData.savedList = JSON.stringify(newListArray);
    saveLocalData(persistentData);
}

function saveToHistory(textContent) {
    if (textContent === null || textContent.trim() === "") return;
    let currentList = getPrayerList();
    currentList = currentList.filter(item => item.text !== textContent);
    currentList.unshift({ text: textContent, addedAt: Date.now(), lastUsed: 0, useCount: 0 });
    if (currentList.length > 200) currentList.pop();
    savePrayerList(currentList);
}

function updateHistoryItem(oldText, newText) {
    if (!newText || newText.trim() === "") return;
    let currentList = getPrayerList();
    if (!oldText || oldText.trim() === "") {
        saveToHistory(newText);
        return;
    }
    let foundIndex = currentList.findIndex(item => item.text === oldText);
    if (foundIndex !== -1) {
        currentList[foundIndex].text = newText;
        currentList[foundIndex].addedAt = Date.now(); 
    } else {
        currentList.unshift({ text: newText, addedAt: Date.now(), lastUsed: 0, useCount: 0 });
    }
    if (currentList.length > 200) currentList.pop();
    savePrayerList(currentList);
}

function showHistoryListDialog() {
    let allPrayerItems = getPrayerList();
    if (allPrayerItems.length === 0) { 
        showSimpleBottomDialog("📭 목록 없음", "저장된 기도문이 없습니다.<br>기도문관리 메뉴에서 복원해주세요."); 
        return; 
    }

    const mainContainer = createEl('div', 'display:flex; flex-direction:column; height:100%; width:100%; box-sizing: border-box;');
    const sortRowBox = createEl('div', 'display:flex; align-items:center; padding-bottom:12px; padding-top:8px;');
    sortRowBox.innerHTML = '<span style="font-size:14px; font-weight:bold; margin-right:8px; color:#1A1A1C;">정렬 방식:</span>';
    const sortSelectBox = createEl('select', 'flex:1; padding:8px; border-radius:8px; border:1px solid #E9ECEF; font-size:13px; outline:none;');
    const sortOptions = ['최근입력순', '많이사용순', '최근사용순', '가나다순', '가나다역순'];
    
    sortOptions.forEach(function(optionText, index) {
        const optionNode = document.createElement('option');
        optionNode.value = index; optionNode.text = optionText;
        sortSelectBox.appendChild(optionNode);
    });
    
    sortSelectBox.value = state.historySortIndex;
    sortRowBox.appendChild(sortSelectBox);
    const listScrollContainer = createEl('div', 'flex:1; overflow-y:auto; display:flex; flex-direction:column;');
    
    mainContainer.appendChild(sortRowBox);
    mainContainer.appendChild(createEl('div', 'height:1px; background:#F1F3F5; width:100%; margin-bottom:10px;'));
    mainContainer.appendChild(listScrollContainer);

    function renderPrayerList() {
        listScrollContainer.innerHTML = "";
        let sortedArray = [...allPrayerItems];
        switch (parseInt(sortSelectBox.value, 10)) {
            case 1: sortedArray.sort((a,b) => b.useCount - a.useCount || b.lastUsed - a.lastUsed); break;
            case 2: sortedArray.sort((a,b) => b.lastUsed - a.lastUsed); break;
            case 3: sortedArray.sort((a,b) => a.text.localeCompare(b.text)); break;
            case 4: sortedArray.sort((a,b) => b.text.localeCompare(a.text)); break;
            default: sortedArray.sort((a,b) => b.addedAt - a.addedAt); break;
        }

        sortedArray.forEach(function(prayerItem, index) {
            const itemBox = createEl('div', 'padding:12px 0; border-bottom:1px solid #F1F3F5; display:flex; flex-direction:column; gap:10px;');
            const textContentRow = createEl('div', 'display:flex; align-items:flex-start;');
            textContentRow.innerHTML = `
                <div style="width:28px; color:#007AFF; font-weight:800; font-size:14px; padding-top:2px;">${index + 1}.</div>
                <div style="flex:1; color:#1A1A1C; font-size:14px; line-height:1.4; word-break:keep-all; user-select:text; overflow-wrap:break-word;">
                    ${prayerItem.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}
                </div>
            `;
            const buttonRowBox = createEl('div', 'display:flex; gap:6px; padding-left:28px; justify-content:flex-end;');
            
            const btnSelect = document.createElement('button');
            btnSelect.style.cssText = "box-sizing: border-box; flex:2; background:#007AFF; color:white; border:none; cursor:pointer;";
            btnSelect.className = "history-action-btn";
            btnSelect.innerHTML = "👆 선택";
            btnSelect.addEventListener('click', function(event) {
                event.preventDefault(); event.stopPropagation();
                prayerItem.lastUsed = Date.now(); prayerItem.useCount = (prayerItem.useCount || 0) + 1;
                savePrayerList(allPrayerItems);
                
                const inputElement = document.getElementById('edit-text-input');
                if (inputElement !== null) {
                    inputElement.value = prayerItem.text;
                }
                
                state.hasStarted = false; pauseTimer(); resetCurrentTimer();
                exitEditMode(false); 
                autoDetectModeFromText(prayerItem.text); applyReadyStatePrayerUI(); closeModal();
            });

            const btnEdit = document.createElement('button');
            btnEdit.style.cssText = "box-sizing: border-box; flex:1; background:#F8F9FA; color:#495057; border:1px solid #E9ECEF; cursor:pointer;";
            btnEdit.className = "history-action-btn";
            btnEdit.innerHTML = "📝 수정";
            btnEdit.addEventListener('click', function(event) {
                event.preventDefault(); event.stopPropagation();
                closeModal();
                enterEditMode(prayerItem.text); 
            });

            const btnDelete = document.createElement('button');
            btnDelete.style.cssText = "box-sizing: border-box; flex:1; background:#FFF0F0; color:#FF3B30; border:none; cursor:pointer;";
            btnDelete.className = "history-action-btn";
            btnDelete.innerHTML = "🗑️ 삭제";
            btnDelete.addEventListener('click', function(event) {
                event.preventDefault(); event.stopPropagation();
                
                const msgBox = createEl('div', 'text-align:center; padding:10px 0; font-size:15px; color:#1A1A1C; line-height:1.5;');
                msgBox.innerHTML = "이 기도문을 삭제하시겠습니까?";
                showCustomDialogWithFooter("삭제 확인", msgBox, "🗑️ 삭제", function() {
                    allPrayerItems = allPrayerItems.filter(item => item.addedAt !== prayerItem.addedAt);
                    savePrayerList(allPrayerItems); 
                    renderPrayerList();
                    closeModal();
                    setTimeout(showHistoryListDialog, 100); 
                });
            });
            
            buttonRowBox.appendChild(btnSelect); buttonRowBox.appendChild(btnEdit); buttonRowBox.appendChild(btnDelete);
            itemBox.appendChild(textContentRow); itemBox.appendChild(buttonRowBox);
            listScrollContainer.appendChild(itemBox);
        });
    }
    
    sortSelectBox.addEventListener('change', function() {
        state.historySortIndex = parseInt(sortSelectBox.value, 10);
        saveSettings(); renderPrayerList();
    });
    
    renderPrayerList();
    showCustomDialog("📜 기도문 목록", mainContainer, null, null, true);
}

function showManagementDialog() {
    const container = document.createElement('div');
    container.style.cssText = "width: 100%; box-sizing: border-box;";
    
    const menuOptions = [
        { text: "📤 파일로 저장하기", action: exportHistoryToFile },
        { text: "📥 파일에서 가져오기", action: function() {
            const fileInput = document.getElementById('hidden-import-file');
            if(fileInput) fileInput.click();
        }},
        { text: "📄 기본 기도문 복원", action: showDefaultTemplatesRestoreDialog },
        { text: "🗑️ 기도문 목록 초기화", action: function() {
            const msgBox = createEl('div', 'text-align:center; padding:10px 0; font-size:15px; color:#1A1A1C; line-height:1.5;');
            msgBox.innerHTML = "저장된 모든 기도문 목록을<br>정말로 초기화(삭제)하시겠습니까?";
            showCustomDialogWithFooter("초기화 확인", msgBox, "🗑️ 초기화", function() {
                clearHistory();
                closeModal();
            });
        }}
    ];
    
    menuOptions.forEach(function(opt) {
        const menuBtn = createEl('button', 'width:100%; background:#F8F9FA; border:none; border-radius:12px; padding:16px; margin-bottom:12px; font-weight:bold; font-size:15px; color:#1A1A1C; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.02);', opt.text);
        menuBtn.type = "button";
        menuBtn.addEventListener('click', function() {
            closeModal();
            opt.action();
        });
        container.appendChild(menuBtn);
    });
    
    const hiddenFileInput = createEl('input', 'display:none;');
    hiddenFileInput.type = 'file'; hiddenFileInput.accept = '.txt';
    hiddenFileInput.id = "hidden-import-file";
    hiddenFileInput.addEventListener('change', function(event) {
        if (event.target.files[0]) { processImport(event.target.files[0]); }
    });
    container.appendChild(hiddenFileInput);

    showCustomDialog("📂 기도문 관리", container, null, null, false);
}

function showTimerMenuDialog() {
    pauseTimer();
    const container = document.createElement('div');
    container.style.cssText = "width: 100%; box-sizing: border-box;";
    const controlItems = ["▶️ 계속 진행", "⏸️ 일시정지", "🔄 타이머 초기화", "📝 직접 수정으로 복귀"];
    
    controlItems.forEach(function(buttonText, index) {
        const ctrlBtn = createEl('button', 'width:100%; background:#F8F9FA; border:none; border-radius:12px; padding:16px; margin-bottom:12px; font-weight:bold; font-size:15px; color:#1A1A1C; cursor:pointer; box-sizing: border-box;', buttonText);
        ctrlBtn.type = "button";
        ctrlBtn.addEventListener('click', function() {
            closeModal();
            if (index === 0) startTimer();
            else if (index === 1) pauseTimer();
            else if (index === 2) { resetCurrentTimer(); startTimer(); }
            else if (index === 3) {
                const inputElement = document.getElementById('edit-text-input');
                let currentText = inputElement ? inputElement.value : "";
                enterEditMode(currentText); 
            }
        });
        container.appendChild(ctrlBtn);
    });
    showCustomDialog("⏱️ 타이머 제어", container, null, null, false);
}

function showEmptyHistoryDialog() {}

async function showDefaultTemplatesRestoreDialog() {
    let templatesArray = [];
    try {
        const fetchResponse = await fetch('prayer_templates.txt');
        if (fetchResponse.ok) {
            const rawText = await fetchResponse.text();
            templatesArray = rawText.split("%%").map(text => text.trim()).filter(text => text !== "");
        }
    } catch(error) { templatesArray = ["기본 기도문 파일(prayer_templates.txt)을 찾을 수 없습니다."]; }

    const container = createEl('div', 'display:flex; flex-direction:column; height:100%; width:100%; box-sizing: border-box;');
    const actionButtonsRow = createEl('div', 'display:flex; gap:12px; margin-bottom:16px; flex-shrink:0;');
    
    const btnRestoreAll = createEl('button', 'flex:1; background:#007AFF; color:white; border:none; padding:14px; border-radius:12px; font-weight:bold; font-size:15px; cursor:pointer;', '전체 복원');
    btnRestoreAll.type = "button";
    const btnRestoreSelected = createEl('button', 'flex:1; background:#34C759; color:white; border:none; padding:14px; border-radius:12px; font-weight:bold; font-size:15px; cursor:pointer;', '선택 복원');
    btnRestoreSelected.type = "button";
    
    actionButtonsRow.appendChild(btnRestoreAll); actionButtonsRow.appendChild(btnRestoreSelected);
    const listScrollBox = createEl('div', 'flex:1; overflow-y:auto; display:flex; flex-direction:column;');
    const checkboxNodes = [];
    
    templatesArray.forEach(function(templateText) {
        const itemRow = createEl('div', 'display:flex; padding:14px 0; border-bottom:1px solid #F1F3F5; cursor:pointer; align-items:flex-start;');
        
        // ★ [V 1.0 핵심 수정] 체크박스가 텍스트 길이에 밀려 찌그러지지 않도록 flex-shrink: 0 속성 강제 주입
        const checkboxEl = createEl('input', 'margin-right:6px; margin-top:4px; transform:scale(1.0); cursor:pointer; flex-shrink:0;');
        checkboxEl.type = 'checkbox';
        const textEl = createEl('div', 'flex:1; font-size:15px; line-height:1.4; color:#1A1A1C; overflow-wrap:break-word;', templateText.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        
        itemRow.addEventListener('click', function(event) { if (event.target !== checkboxEl) checkboxEl.checked = !checkboxEl.checked; });
        itemRow.appendChild(checkboxEl); itemRow.appendChild(textEl); listScrollBox.appendChild(itemRow);
        checkboxNodes.push({ node: checkboxEl, textContent: templateText });
    });
    
    btnRestoreAll.addEventListener('click', function() {
        let currentItems = getPrayerList(); let timestamp = Date.now();
        let reversedTemplates = [...templatesArray].reverse();
        reversedTemplates.forEach(function(templateStr, index) {
            currentItems = currentItems.filter(item => item.text !== templateStr);
            currentItems.unshift({ text: templateStr, addedAt: timestamp + index, lastUsed: 0, useCount: 0 });
        });
        savePrayerList(currentItems); closeModal(); showHistoryListDialog(); 
        showSimpleBottomDialog("안내", "🔄 전체 기도문이 복원되었습니다.");
    });
    
    btnRestoreSelected.addEventListener('click', function() {
        let currentItems = getPrayerList(); let timestamp = Date.now(); let restoreCount = 0;
        let reversedNodes = [...checkboxNodes].reverse();
        reversedNodes.forEach(function(itemData, index) {
            if (itemData.node.checked === true) {
                currentItems = currentItems.filter(item => item.text !== itemData.textContent);
                currentItems.unshift({ text: itemData.textContent, addedAt: timestamp + index, lastUsed: 0, useCount: 0 });
                restoreCount++;
            }
        });
        
        if (restoreCount > 0) { 
            savePrayerList(currentItems); closeModal(); showHistoryListDialog(); 
            showSimpleBottomDialog("안내", `💾 ${restoreCount}개의 기도문이 복원되었습니다.`);
        } else { 
            showSimpleBottomDialog("안내", "선택된 항목이 없습니다."); 
        }
    });
    
    container.appendChild(actionButtonsRow); container.appendChild(listScrollBox);
    showCustomDialog("📄 기본 기도문 복원", container, null, null, true);
}

function showExitConfirmDialog() {
    const container = createEl('div', 'text-align:center; padding:10px 0; font-size:16px; color:#1A1A1C; line-height:1.5;');
    container.innerHTML = "정말로 앱을 종료하시겠습니까?<br>모든 설정값은 영구 저장됩니다.";
    
    showCustomDialogWithFooter("앱 종료 확인", container, "❌ 종료", function() {
        saveSettings(); closeModal(); 
        showSimpleBottomDialog("안내", "설정이 안전하게 저장되었습니다.<br>앱 창을 닫아주세요.");
        try { window.close(); } catch(error) { }
    });
}

function exportHistoryToFile() {
    let allItems = getPrayerList();
    if (allItems.length === 0) { 
        showSimpleBottomDialog("경고", "내보낼 기도문이 없습니다."); 
        return; 
    }
    let fileContent = allItems.map(item => "%%" + item.text).join("\n\n");
    let fileBlob = new Blob([fileContent], { type: "text/plain" });
    let downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(fileBlob); downloadLink.download = "나의_회개_기도문.txt"; downloadLink.click();
    showSimpleBottomDialog("안내", "📤 파일이 성공적으로 다운로드 되었습니다.");
}

function processImport(targetFile) {
    let fileReader = new FileReader();
    fileReader.onload = function(event) {
        let loadedContent = event.target.result; let existingItems = getPrayerList(); let timestamp = Date.now();
        let splitItems = loadedContent.split("%%").filter(text => text.trim() !== "");
        splitItems.forEach(function(itemText) { existingItems.unshift({ text: itemText.trim(), addedAt: timestamp, lastUsed: 0, useCount: 0 }); });
        savePrayerList(existingItems); showHistoryListDialog(); 
        showSimpleBottomDialog("안내", "📂 파일을 성공적으로 가져왔습니다.");
    };
    fileReader.readAsText(targetFile);
}

function clearHistory() {
    let persistentData = getLocalData();
    delete persistentData.savedList; saveLocalData(persistentData);
    showSimpleBottomDialog("안내", "🗑️ 모든 기도문 목록이 완전히 초기화되었습니다.");
}

// [회개하자!_Web_V 1.0_app.js_끝]