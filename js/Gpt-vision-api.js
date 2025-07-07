// js/gpt-vision-api.js

import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";
import { app } from './firebase-config.js'; // Firebase 앱 초기화

/**
 * Firebase Storage에 이미지를 업로드하고 다운로드 URL을 반환하는 함수
 * @param {File} file - 사용자가 선택한 이미지 파일
 * @returns {Promise<string>} - 업로드된 이미지의 URL
 */
export async function uploadImageAndGetUrl(file) {
    const storage = getStorage(app);
    const fileName = `vision-uploads/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, fileName);

    try {
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        return url;
    } catch (error) {
        console.error('🔥 이미지 업로드 실패:', error);
        throw new Error('이미지를 업로드하지 못했습니다.');
    }
}

/**
 * GPT Vision 프록시 API를 호출하여 이미지 분석 결과를 받는 함수
 * @param {string} imageUrl - Firebase Storage에서 받은 이미지 URL
 * @returns {string} GPT가 생성한 설명 텍스트
 */
export async function getImageAnalysisFromGptVision(imageUrl) {
    const prompt = `이 이미지에 대해 설명해줘: ${imageUrl}`;

    const response = await fetch('/api/gpt-vision', {
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
