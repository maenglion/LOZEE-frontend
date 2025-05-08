// ./js/stt.js (Base64 인코딩하여 JSON으로 전송하도록 수정)

// 실제 백엔드 STT 엔드포인트 (이전과 동일)
const STT_BACKEND_URL = 'https://ggg-production.up.railway.app/api/stt';

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
      // reader.result는 "data:audio/webm;codecs=opus;base64,xxxx..." 형태이므로
      // 헤더 부분("data:...;base64,")을 제거하고 순수 Base64 데이터만 추출합니다.
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
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
    console.warn("STT: 변환할 오디오 데이터가 없습니다.");
    return Promise.resolve("");
  }

  try {
    // Blob을 Base64 문자열로 변환
    const base64Audio = await blobToBase64(audioBlob);

    // Base64 문자열을 JSON 본문에 담아 fetch 요청
    const response = await fetch(STT_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Content-Type을 JSON으로 명시
      },
      body: JSON.stringify({ audioContent: base64Audio }), // 백엔드가 기대하는 JSON 형식
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`STT API 요청 실패: ${response.status}`, errorText);
      throw new Error(`STT API 요청 실패: ${response.status} - ${errorText}`);
    }

    const data = await response.json(); // 백엔드가 { "text": "..." } 형태로 반환한다고 가정
    return data.text || "";
  } catch (error) {
    console.error("STT 서비스 호출 중 오류:", error);
    // 오류 발생 시 빈 문자열 반환 또는 오류 throw 선택
    return ""; // 또는 throw error;
  }
}