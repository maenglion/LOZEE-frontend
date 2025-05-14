// ./js/tts.js (백엔드 API 호출 방식)

const TTS_BACKEND_URL = 'https://ggg-production.up.railway.app/api/tts'; // 실제 백엔드 엔드포인트

export function playTTSFromText(text, voiceId) {
  return new Promise(async (resolve, reject) => { // async 추가
    if (!text || String(text).trim() === "") {
      console.log("TTS: 말할 내용 없음.");
      return resolve();
    }
    console.log(`TTS: API 요청 - Text: "${text}", Voice ID: ${voiceId}`);

    try {
      const response = await fetch(TTS_BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice: voiceId // 백엔드 /api/tts 가 이 'voice' 키를 사용하도록 수정됨
        }),
      });

      console.log(`TTS: API 응답 상태: ${response.status}`);

      if (!response.ok) {
        let errorDetails = `HTTP status ${response.status}`;
        try {
          const errorBody = await response.json(); // 오류 응답이 JSON 형태일 수 있음
          errorDetails += ` - ${JSON.stringify(errorBody)}`;
        } catch (e) {
          // JSON 파싱 실패 시 텍스트로 읽기
          try { errorDetails += ` - ${await response.text()}`; } catch (e2) {}
        }
        console.error(`TTS: 백엔드 요청 실패. ${errorDetails}`);
        return reject(new Error(`TTS 백엔드 요청 실패: ${errorDetails}`));
      }

      const audioBlob = await response.blob();
      console.log(`TTS: 오디오 Blob 수신 완료, 타입: ${audioBlob.type}, 크기: ${audioBlob.size}`);

      if (audioBlob.size === 0) {
          console.warn("TTS: 수신된 오디오 데이터 크기가 0입니다.");
          return reject(new Error("수신된 오디오 데이터가 비어있습니다."));
      }

      const audio = new Audio();
      const audioUrl = URL.createObjectURL(audioBlob);
      audio.src = audioUrl;

      // 재생 관련 이벤트 핸들러
      audio.onloadedmetadata = () => console.log("TTS: 오디오 메타데이터 로드됨.");
      audio.oncanplaythrough = () => {
        console.log("TTS: 오디오 재생 가능, 재생 시작...");
        audio.play().catch(reject); // 재생 오류 시 reject
      };
      audio.onended = () => {
        console.log("TTS: 오디오 재생 완료.");
        URL.revokeObjectURL(audioUrl);
        resolve(); // 재생 완료 시 resolve
      };
      audio.onerror = (e) => {
        console.error("TTS: 오디오 요소 오류 발생.", e.target.error);
        URL.revokeObjectURL(audioUrl);
        reject(e.target.error || new Error("오디오 재생 중 오류 발생"));
      };
      audio.onstalled = () => console.warn("TTS: 오디오 로딩 지연됨."); // 네트워크 문제 등

    } catch (error) {
      console.error("TTS: 음성 합성 또는 처리 중 오류:", error);
      reject(error); // 전체 프로세스 오류 시 reject
    }
  });
  // 기존 AVAILABLE_VOICES, DEFAULT_VOICE 정의 유지
export const AVAILABLE_VOICES = [
  "ko-KR-Chirp3-HD-Vindemiatrix",
  "ko-KR-Chirp3-HD-Rasalgethi",
  "ko-KR-Chirp3-HD-Leda",
  "ko-KR-Chirp3-HD-Sadachbia",
  "ko-KR-Chirp3-HD-Kore",
  "ko-KR-Chirp3-HD-Schedar"
];
export const DEFAULT_VOICE = AVAILABLE_VOICES[0];

/**
 * playTTSFromText(text, voiceId)
 * - voiceId: string, 반드시 AVAILABLE_VOICES 중 하나여야 함
 */
export async function playTTSFromText(text, voiceId = DEFAULT_VOICE) {
  if (!AVAILABLE_VOICES.includes(voiceId)) {
    console.warn(`[tts.js] 제공되지 않는 음성입니다: ${voiceId}, 기본 음성 사용합니다.`);
    voiceId = DEFAULT_VOICE;
  }
  console.log(`TTS 요청 - 텍스트: "${text}", 음성: "${voiceId}"`);
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: voiceId })
  });
  if (!response.ok) {
    throw new Error(`TTS API 오류: ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  return new Promise(resolve => {
    audio.onended = resolve;
    audio.play();
  });
