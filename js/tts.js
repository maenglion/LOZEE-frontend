// js/tts.js
// 1) 백엔드 URL
const TTS_BACKEND_URL = 'https://ggg-production.up.railway.app/api/tts';

// 2) 사용할 수 있는 음성 리스트 및 기본값
export const AVAILABLE_VOICES = [
  "ko-KR-Chirp3-HD-Vindemiatrix",
  "ko-KR-Chirp3-HD-Rasalgethi",
  "ko-KR-Chirp3-HD-Leda",
  "ko-KR-Chirp3-HD-Sadachbia",
  "ko-KR-Chirp3-HD-Kore",
  "ko-KR-Chirp3-HD-Schedar"
];
export const DEFAULT_VOICE = AVAILABLE_VOICES[0];

// 3) TTS 재생 함수 (단 하나만 남깁니다)
export async function playTTSFromText(text, voiceId = DEFAULT_VOICE) {
  // 빈 문자열 무시
  if (!text || !String(text).trim()) {
    console.log("TTS: 말할 내용 없음.");
    return;
  }
  // 잘못된 voiceId 교정
  if (!AVAILABLE_VOICES.includes(voiceId)) {
    console.warn(`[tts.js] 제공되지 않는 음성: ${voiceId}. 기본 음성 사용.`);
    voiceId = DEFAULT_VOICE;
  }
  console.log(`TTS 요청 - 텍스트: "${text}", 음성: "${voiceId}"`);

  // 백엔드 호출
  const response = await fetch(TTS_BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: voiceId })
  });
  if (!response.ok) {
    const errText = await response.text().catch(()=>"");
    throw new Error(`TTS API 오류 ${response.status}: ${errText}`);
  }

  // Blob → Audio 재생
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("TTS: 수신된 오디오 데이터가 비어있음");
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = e => {
      URL.revokeObjectURL(url);
      reject(new Error("오디오 재생 중 오류"));
    };
    audio.play().catch(reject);
  });
}
