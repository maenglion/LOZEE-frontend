// js/gpt-vision-api.js

/**
 * 이미지를 업로드하고, Cloudflare나 이미지 저장 서버로부터 URL을 반환하는 함수
 * (이 버전은 Firebase Storage를 사용하는 방식이 아님)
 */
export async function uploadImageAndGetUrl(file) {
    const formData = new FormData();
    formData.append('image', file);

    // TODO: 실제 이미지 업로드 서버로 바꿔야 함 (현재는 임시 사용)
    const uploadEndpoint = 'https://api.imgbb.com/1/upload';
    const apiKey = 'YOUR_IMGBB_API_KEY'; // 🔐 반드시 환경변수나 서버에 숨겨야 함

    const res = await fetch(`${uploadEndpoint}?key=${apiKey}`, {
        method: 'POST',
        body: formData
    });

    if (!res.ok) {
        throw new Error("이미지 업로드 실패");
    }

    const data = await res.json();
    return data.data.url;
}

/**
 * GPT에게 이미지 설명을 요청하는 함수 (Vision 모델 호출)
 * @param {string} imageUrl - 설명을 요청할 이미지의 URL
 * @returns {string} GPT가 생성한 설명 텍스트
 */
export async function getImageAnalysisFromGptVision(imageUrl) {
    const prompt = `이 이미지에 대해 설명해줘: ${imageUrl}`;

    const response = await fetch('https://lozee-backend-838397276113.asia-northeast3.run.app/api/gpt-vision', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageUrl, prompt })
    });

    if (!response.ok) {
        throw new Error('GPT Vision 응답 오류');
    }

    const result = await response.json();
    return result.text || '이미지에 대한 설명을 생성하지 못했어요.';
}
