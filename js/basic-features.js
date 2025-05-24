// js/basic-features.js
// 15세 미만 사용자 기본 분석 기능 모듈

// 전역 LOZEE_ANALYSIS 객체 생성 또는 사용 (literacy와 공유 가능)
window.LOZEE_ANALYSIS = window.LOZEE_ANALYSIS || {};

// trackTime 관련 상태 변수
window.LOZEE_ANALYSIS.timeTracking = {
  start: null,
  wordCount: 0,
  intervalId: null // setInterval ID를 저장하여 나중에 중지할 수 있도록 함
};

/**
 * 대화 누적 시간별 언어·나이 분석
 * - 30분: 단어 수/구문 패턴
 * - 2시간: 감정 표현/논리 구조
 * - 6시간: 주제별 표현 편차
 */
window.LOZEE_ANALYSIS.trackTime = function() {
  console.log("[LOZEE_ANALYSIS.basic-features] trackTime 함수 호출됨.");
  const trackingState = window.LOZEE_ANALYSIS.timeTracking;

  if (trackingState.intervalId) {
    console.log("[LOZEE_ANALYSIS.basic-features] trackTime 타이머가 이미 실행 중입니다.");
    return;
  }

  trackingState.start = Date.now();
  trackingState.wordCount = 0; // 함수 호출 시 초기화

  trackingState.intervalId = setInterval(() => {
    const elapsed = (Date.now() - trackingState.start) / 1000; // 초 단위
    
    const chatContainer = document.getElementById('chat-container'); 
    if (chatContainer) {
        const userEls = chatContainer.querySelectorAll('.bubble.user');
        trackingState.wordCount = Array.from(userEls).reduce((sum, el) => {
            const textContent = el.textContent || "";
            return sum + textContent.split(/\s+/).filter(Boolean).length;
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

window.LOZEE_ANALYSIS.stopTrackTime = function() {
  if (window.LOZEE_ANALYSIS.timeTracking.intervalId) {
    clearInterval(window.LOZEE_ANALYSIS.timeTracking.intervalId);
    window.LOZEE_ANALYSIS.timeTracking.intervalId = null;
    console.log("[LOZEE_ANALYSIS.basic-features] trackTime 타이머 중지됨.");
  }
};

/**
 * 실시간 감정 어조 분석 트래킹
 */
window.LOZEE_ANALYSIS.trackEmotionTone = function(analysisData) {
  console.log('[LOZEE_ANALYSIS.basic-features] 감정 어조 분석 기능 활성화됨. 데이터:', analysisData);
  // TODO: 차트 초기화, 태그 클라우드 설정 등
};

/**
 * 상황 분석 (인지왜곡 패턴 탐지)
 */
window.LOZEE_ANALYSIS.trackSituation = function(analysisData) {
  console.log('[LOZEE_ANALYSIS.basic-features] 상황 분석 기능 활성화됨. 데이터:', analysisData);
  // TODO: 대화 내용에서 상황 문장 패턴 추출 및 매칭
};
