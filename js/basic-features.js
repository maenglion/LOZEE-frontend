// js/basic-features.js
window.LOZEE_ANALYSIS = window.LOZEE_ANALYSIS || {};

// trackTime 관련 상태 변수
window.LOZEE_ANALYSIS.timeTracking = {
  start: null,
  wordCount: 0,
  intervalId: null // setInterval ID를 저장하여 나중에 중지할 수 있도록 함
};

window.LOZEE_ANALYSIS.trackTime = function() {
  console.log("[LOZEE_ANALYSIS.basic-features] trackTime 함수 호출됨.");
  const trackingState = window.LOZEE_ANALYSIS.timeTracking; // 편의상 변수 사용

  if (trackingState.intervalId) { // 이미 실행 중인 타이머가 있다면 중복 실행 방지
    console.log("[LOZEE_ANALYSIS.basic-features] trackTime 타이머가 이미 실행 중입니다.");
    return;
  }

  trackingState.start = Date.now();
  trackingState.wordCount = 0; // 함수 호출 시 초기화

  trackingState.intervalId = setInterval(() => {
    const elapsed = (Date.now() - trackingState.start) / 1000; // 초 단위
    
    // 대화창에서 모든 사용자의 발화를 합산 (talk.html의 실제 ID 사용 필요)
    // #chatInterface 대신 #chat-container를 사용한다고 가정 (talk.html 코드 기준)
    const chatContainer = document.getElementById('chat-container'); 
    if (chatContainer) {
        const userEls = chatContainer.querySelectorAll('.bubble.user'); // .user 클래스 가정
        trackingState.wordCount = Array.from(userEls).reduce((sum, el) => {
            const textContent = el.textContent || ""; // null 방지
            return sum + textContent.split(/\s+/).filter(Boolean).length; // 빈 문자열 제거 후 계산
        }, 0);
    }


    if (elapsed >= 30 * 60 && elapsed < 2 * 60 * 60) {
      console.log('[basic-features.js] 30분 분석:', trackingState.wordCount, '단어');
      // TODO: 초기 언어연령 예측 로직 호출
    } else if (elapsed >= 2 * 60 * 60 && elapsed < 6 * 60 * 60) {
      console.log('[basic-features.js] 2시간 분석: 감정 표현/논리 구조 레벨링');
      // TODO: 상세 레벨링 로직 호출
    } else if (elapsed >= 6 * 60 * 60) {
      console.log('[basic-features.js] 6시간 분석: 주제별 표현 편차');
      // TODO: 편차 분석 로직 호출
      // 예: clearInterval(trackingState.intervalId); // 6시간 후 타이머 중지
    }
  }, 5 * 60 * 1000); // 5분마다
};

// 필요하다면 trackTime 타이머를 중지하는 함수도 추가할 수 있습니다.
window.LOZEE_ANALYSIS.stopTrackTime = function() {
  if (window.LOZEE_ANALYSIS.timeTracking.intervalId) {
    clearInterval(window.LOZEE_ANALYSIS.timeTracking.intervalId);
    window.LOZEE_ANALYSIS.timeTracking.intervalId = null;
    console.log("[LOZEE_ANALYSIS.basic-features] trackTime 타이머 중지됨.");
  }
};

/**
 * 실시간 감정 어조 분석 트래킹
 * 차트, 태그 클라우드, 패턴 추적 등을 실행
 */
window.LOZEE_ANALYSIS.trackEmotionTone = function(analysisData) {
  console.log('[LOZEE_ANALYSIS.basic-features] 감정 어조 분석 기능 활성화됨. 데이터:', analysisData);
  // getGptResponse에서 반환되는 감정 정보와 연계
  // TODO: 차트 초기화, 태그 클라우드 설정
};

/**
 * 상황 분석 (인지왜곡 패턴 탐지)
 * 유사 플롯 반복, 인지왜곡 언급 시 알림
 */
window.LOZEE_ANALYSIS.trackSituation = function(analysisData) {
  console.log('[LOZEE_ANALYSIS.basic-features] 상황 분석 기능 활성화됨. 데이터:', analysisData);
  // TODO: 대화 내용에서 상황 문장 패턴 추출 및 매칭
};