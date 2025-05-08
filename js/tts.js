// js/tts.js

// 사용자의 Railway 백엔드 TTS 서비스 URL
// 중요: '/api/tts' 부분은 실제 백엔드 API 엔드포인트 경로로 수정해야 할 수 있습니다.
const TTS_BACKEND_URL = 'https://ggg-production.up.railway.app/api/tts';

/**
 * 백엔드 TTS 서비스에 텍스트와 목소리 ID를 전달하여 음성 합성을 요청하고,
 * 반환된 오디오 데이터를 재생합니다.
 * @param {string} text - 음성으로 변환할 텍스트.
 * @param {string} voiceId - Google Cloud TTS 목소리 ID (예: "ko-KR-Chirp3-HD-Zephyr").
 * @returns {Promise<void>} 오디오 재생이 완료되면 resolve하고, 오류 발생 시 reject하는 Promise.
 */
export async function playTTSFromText(text, voiceId) {
  // 텍스트가 비어있으면 아무 작업도 하지 않고 즉시 resolve
  if (!text || String(text).trim() === "") {
    // console.log("TTS: 말할 내용이 없습니다.");
    return Promise.resolve();
  }

  // 아래 console.log 라인은 ${text} 변수 내용에 따라 오류를 유발할 수 있으므로, 필요시 안전한 형태로 사용하거나 주석 처리합니다.
  // console.log(`TTS: 백엔드 요청 - 텍스트: ${text}, 목소리: ${voiceId}`);

  try {
    // 백엔드에 POST 요청 전송
    const response = await fetch(TTS_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 필요에 따라 다른 헤더 (예: 인증 토큰)를 추가할 수 있습니다.
      },
      body: JSON.stringify({
        text: text,     // 백엔드에서 받을 텍스트 필드 이름 (예: 'text')
        voice: voiceId, // 백엔드에서 받을 목소리 ID 필드 이름 (예: 'voice')
      }),
    });

    // HTTP 응답 상태 확인
    if (!response.ok) {
      let errorDetails = `HTTP status ${response.status}`;
      try {
        // 오류 응답 본문이 있다면 포함
        const errorBody = await response.text();
        errorDetails += ` - ${errorBody}`;
      } catch (e) {
        // 오류 본문 읽기 실패 (이 부분은 특별히 추가 조치 필요 없음)
      }
      console.error(`TTS: 백엔드 요청 실패. ${errorDetails}`);
      throw new Error(`TTS 백엔드 요청 실패: ${errorDetails}`); // 여기서 에러를 throw하면 바깥 catch로 넘어감
    }

    // 백엔드가 오디오 데이터를 직접 반환한다고 가정 (예: MP3, OGG, WAV 파일의 Blob)
    const audioBlob = await response.blob();

    // 오디오 재생을 위한 Promise 생성
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const audioUrl = URL.createObjectURL(audioBlob);
      audio.src = audioUrl;

      audio.onloadedmetadata = () => {
        audio.play()
          .catch(playError => {
            console.error("TTS: 오디오 재생 중 오류 발생:", playError);
            URL.revokeObjectURL(audioUrl);
            reject(playError);
          });
      };

      audio.onended = () => {
        // console.log("TTS: 오디오 재생 완료.");
        URL.revokeObjectURL(audioUrl);
        resolve();
      };

      audio.onerror = (errorEvent) => {
        const mediaError = errorEvent.target.error;
        console.error("TTS: 오디오 요소 오류 발생.", mediaError ? `코드: ${mediaError.code}, 메시지: ${mediaError.message}` : errorEvent);
        URL.revokeObjectURL(audioUrl);
        reject(mediaError || new Error("오디오 재생 중 알 수 없는 오류"));
      };
    }); // try 블록 내 new Promise의 닫는 괄호

  } catch (error) { // 여기가 바깥 try...catch의 catch 블록 시작
    // fetch 또는 기타 예외 처리
    console.error("TTS: 음성 합성 또는 처리 중 오류:", error); // 이 라인이 89번째 줄 또는 그 근처
    return Promise.reject(error); // <--- catch 블록에서 Promise를 reject 하도록 수정
  } // <--- 여기가 catch (error) 블록의 닫는 중괄호 '}' 입니다. (이것이 누락되었을 가능성)

} // <--- 여기가 export async function playTTSFromText 함수의 닫는 중괄호 '}' 입니다. (이것이 누락되었을 가능성)