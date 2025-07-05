// ./js/stt.js (Base64 인코딩하여 JSON으로 백엔드 /api/stt 호출)
// 실제 STT 구현 부분은 프로젝트에 맞게 채워주세요.

export async function startSTT() {
  // 1) 마이크 스트림 얻기
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // 2) SpeechRecognition 등으로 시작
  const recognition = new window.SpeechRecognition();
  recognition.lang = 'ko-KR';
  recognition.interimResults = false;
  recognition.start();
  // 내부에 recognition 인스턴스를 보관해 두세요.
  window.__lozeeRecognition = recognition;
}

export function stopSTT() {
  return new Promise((resolve, reject) => {
    const recognition = window.__lozeeRecognition;
    if (!recognition) return reject(new Error('인식기 없음'));

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };
    recognition.onerror = reject;
    recognition.stop();
  });
}

// 실제 백엔드 STT 엔드포인트
const STT_BACKEND_URL = 'https://google-tts-new-server-production.up.railway.app/api/stt'; // Railway 백엔드 주소 확인!

/**
 * 오디오 Blob을 Base64 문자열로 변환하는 Helper 함수
 * @param {Blob} blob - 변환할 오디오 Blob.
 * @returns {Promise<string>} Base64로 인코딩된 문자열 (데이터 URI 헤더 제외).
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      // reader.result는 "data:audio/webm;codecs=opus;base64,xxxx..." 형태
      // 헤더 부분("data:...;base64,")을 제거하고 순수 Base64 데이터만 추출
      const resultStr = reader.result;
      if (typeof resultStr === 'string' && resultStr.includes(',')) {
        const base64String = resultStr.split(',')[1];
        resolve(base64String);
      } else {
        console.error("Base64 문자열 추출 실패: reader.result 형식이 예상과 다름", reader.result);
        reject(new Error("오디오 데이터를 Base64로 변환하는데 실패했습니다."));
      }
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * 오디오 Blob을 Base64로 인코딩하여 백엔드 STT 서비스로 전송하고 텍스트로 변환합니다.
 * @param {Blob} audioBlob - 변환할 오디오 데이터 (audio/webm 등).
 * @returns {Promise<string>} 변환된 텍스트를 반환하는 Promise.
 */
export async function getSTTFromAudio(audioBlob) {
  if (!audioBlob || audioBlob.size === 0) {
    console.warn("[stt.js] 변환할 오디오 데이터가 없습니다.");
    return ""; // 빈 문자열 반환
  }
  console.log(`[stt.js] 오디오 Blob 정보 - 크기: ${audioBlob.size}, 타입: ${audioBlob.type}`);

  try {
    const audioBuffer = await audioBlob.arrayBuffer();

const response = await fetch(STT_BACKEND_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'audio/wav',
    'Authorization': `Bearer ${token}` // 🔒 Firebase 토큰 필요 시 추가
  },
  body: audioBuffer
});

    console.log(`[stt.js] STT API 응답 상태: ${response.status}`);

    if (!response.ok) {
      let errorText = `HTTP 상태 ${response.status}`;
      try {
        const responseBody = await response.text();
        errorText += ` - ${responseBody}`;
      } catch (e) { /* 응답 본문 읽기 실패 무시 */ }
      console.error(`[stt.js] STT API 요청 실패: ${errorText}`);
      throw new Error(`STT API 요청 실패: ${errorText}`); // 오류를 throw하여 talk.html에서 catch하도록 변경
    }

    const data = await response.json();
    console.log("[stt.js] STT API 응답 데이터:", data); // STT API 응답 전체를 보여주는 로그
const receivedText = data.transcript || data.text || ""; //✅ 정확한 키명으로 수정

    console.log("[stt.js] 반환될 텍스트:", `"${receivedText}"`); // 빈 문자열일 경우 명확히
    return receivedText;

  } catch (error) {
    console.error("[stt.js] STT 서비스 호출 중 오류:", error);
    // talk.html에서 이 오류를 catch하여 사용자에게 적절한 메시지를 보여줄 수 있도록 throw
    throw error; 
  }
}
