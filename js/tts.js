// js/tts.js

// 전역 LOZEE_TTS 객체 생성 또는 사용
window.LOZEE_TTS = window.LOZEE_TTS || {};

// 1) 백엔드 URL
const TTS_BACKEND_URL_TTS = 'https://ggg-production.up.railway.app/api/tts'; // 변수명 명확화

// 2) 사용할 수 있는 음성 리스트 및 기본값
window.LOZEE_TTS.AVAILABLE_VOICES = [
  "ko-KR-Chirp3-HD-Vindemiatrix",
  "ko-KR-Chirp3-HD-Rasalgethi",
  "ko-KR-Chirp3-HD-Leda",
  "ko-KR-Chirp3-HD-Sadachbia",
  "ko-KR-Chirp3-HD-Kore",
  "ko-KR-Chirp3-HD-Schedar"
];
window.LOZEE_TTS.DEFAULT_VOICE = window.LOZEE_TTS.AVAILABLE_VOICES[0];

// 3) TTS 재생 함수
window.LOZEE_TTS.playTTSFromText = async function(text, voiceId = window.LOZEE_TTS.DEFAULT_VOICE) {
  // 빈 문자열 무시
  if (!text || !String(text).trim()) {
    console.log("TTS: 말할 내용 없음.");
    return;
  }
  // 잘못된 voiceId 교정
  if (!window.LOZEE_TTS.AVAILABLE_VOICES.includes(voiceId)) {
    console.warn(`[tts.js] 제공되지 않는 음성: ${voiceId}. 기본 음성 사용.`);
    voiceId = window.LOZEE_TTS.DEFAULT_VOICE;
  }
  console.log(`TTS 요청 - 텍스트: "${text}", 음성: "${voiceId}"`);

  try {
    // 백엔드 호출
    const response = await fetch(TTS_BACKEND_URL_TTS, { // 수정된 URL 변수 사용
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceId })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP error ${response.status}`);
      console.error(`TTS API 오류 ${response.status}: ${errText}`);
      throw new Error(`TTS API 오류 ${response.status}: ${errText}`);
    }

    // Blob → Audio 재생
    const blob = await response.blob();
    if (blob.size === 0) {
      console.error("TTS: 수신된 오디오 데이터가 비어있음");
      throw new Error("TTS: 수신된 오디오 데이터가 비어있음");
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        console.log("TTS 재생 완료.");
        resolve();
      };
      audio.onerror = e => {
        URL.revokeObjectURL(url);
        console.error("오디오 재생 중 오류:", e);
        reject(new Error("오디오 재생 중 오류"));
      };
      audio.play().catch(playError => {
        console.error("오디오 재생 시작 오류:", playError);
        URL.revokeObjectURL(url); // play() 실패 시에도 revokeObjectURL 호출
        reject(playError);
      });
    });
  } catch (error) {
    console.error("TTS playTTSFromText 함수 내 오류:", error);
    // 사용자에게 TTS 실패를 알리는 다른 방법을 고려할 수 있음 (예: UI 피드백)
    throw error; // 오류를 다시 throw하여 호출한 곳에서 처리할 수 있도록 함
  }
};
//전역객체방식으로 수정