// js/tts.js



// 1) 백엔드 URL
const TTS_BACKEND_URL_TTS_MODULE = 'https://server-production-3e8f.up.railway.app/api/tts'; // 변수명 중복 피하기 위해 _MODULE 추가

// 2) 사용할 수 있는 음성 리스트 및 기본값
export const AVAILABLE_VOICES = [
  "ko-KR-Chirp3-HD-Rasalgethi",
  "ko-KR-Chirp3-HD-Leda",
  "ko-KR-Chirp3-HD-Sadachbia",
  "ko-KR-Chirp3-HD-Kore",
  "ko-KR-Chirp3-HD-Schedar"
];
export let DEFAULT_VOICE = "ko-KR-Chirp3-HD-Leda";

 if (!AVAILABLE_VOICES.includes(DEFAULT_VOICE)) {
  DEFAULT_VOICE = "ko-KR-Chirp3-HD-Leda"; // 기본값이 목록에 없으면 안전한 값으로 재설정
}

// 3) TTS 재생 함수
export async function playTTSFromText(text, voiceId) {
  const effectiveVoiceId = voiceId || DEFAULT_VOICE;

  if (!text || !String(text).trim()) {
    console.log("TTS: 말할 내용 없음.");
    return;
  }
  
  let finalVoiceId = effectiveVoiceId;
  if (!AVAILABLE_VOICES.includes(effectiveVoiceId)) {
      finalVoiceId = DEFAULT_VOICE;
  }
  console.log(`TTS 요청 - 텍스트: "${text}", 음성: "${finalVoiceId}"`);

  try {
    const response = await fetch(TTS_BACKEND_URL_TTS_MODULE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: finalVoiceId })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP error ${response.status}`);
      console.error(`TTS API 오류 ${response.status}: ${errText}`);
      throw new Error(`TTS API 오류 ${response.status}: ${errText}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      console.error("TTS: 수신된 오디오 데이터가 비어있음");
      throw new Error("TTS: 수신된 오디오 데이터가 비어있음");
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    // 현재 재생 중인 오디오를 추적하기 위한 변수 (stopCurrentTTS 위함)
    // 이 변수는 모듈 스코프에 있어야 stopCurrentTTS 함수가 접근 가능
    // 하지만 여러 오디오가 동시에 play될 수 없다는 가정 하에 간단히 구현
    currentPlayingAudio = audio; 

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        console.log("TTS 재생 완료.");
        currentPlayingAudio = null; // 재생 완료 후 참조 제거
        resolve();
      };
      audio.onerror = e => {
        URL.revokeObjectURL(url);
        console.error("오디오 재생 중 오류:", e);
        currentPlayingAudio = null; // 오류 발생 시 참조 제거
        reject(new Error("오디오 재생 중 오류"));
      };
      audio.play().catch(playError => {
        console.error("오디오 재생 시작 오류:", playError);
        URL.revokeObjectURL(url); 
        currentPlayingAudio = null; // 재생 시작 오류 시 참조 제거
        reject(playError);
      });
    });
  } catch (error) {
    console.error("TTS playTTSFromText 함수 내 오류:", error);
    throw error; 
  }
}

// 현재 재생 중인 오디오를 저장하기 위한 변수
let currentPlayingAudio = null;

// 4) 현재 TTS 중지 함수 (talk.html 에서 import 필요)
export function stopCurrentTTS() {
  if (currentPlayingAudio) {
    currentPlayingAudio.pause(); // 현재 오디오 정지
    currentPlayingAudio.currentTime = 0; // 오디오 위치 처음으로 (선택 사항)
    if (currentPlayingAudio.src.startsWith('blob:')) { // blob URL인 경우
        URL.revokeObjectURL(currentPlayingAudio.src); // 메모리 해제
    }
    console.log("TTS 중지됨.");
    currentPlayingAudio = null;
  }
}

// 파일 끝에 있는 불필요한 '}' 는 없는지 확인합니다.
// (제공해주신 tts.js 파일 내용 끝에 '}'가 있었습니다)
