// js/gpt-vision-api.js

import { storage } from './firebase-config.js'; // firebase-config.js에서 storage 객체를 import
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js';

/**
 * 파일을 Firebase Storage에 업로드하고 공개 URL을 반환합니다.
 * @param {File} file - 업로드할 이미지 파일 객체
 * @returns {Promise<string>} 업로드된 이미지의 공개 URL
 */
export async function uploadImageAndGetUrl(file) {
    if (!storage) {
        console.error("Firebase Storage가 초기화되지 않았습니다.");
        throw new Error("이미지 업로드 서비스를 사용할 수 없습니다.");
    }

    const userId = localStorage.getItem('lozee_userId') || 'anonymous';
    const storageRef = ref(storage, `images/${userId}/${Date.now()}_${file.name}`);

    try {
        const uploadResult = await uploadBytes(storageRef, file);
        console.log("Firebase Storage 업로드 완료:", uploadResult);
        const downloadURL = await getDownloadURL(uploadResult.ref);
        console.log("Firebase Storage 다운로드 URL:", downloadURL);
        return downloadURL;

    } catch (error) {
        console.error("Firebase Storage 이미지 업로드 중 오류:", error);
        throw new Error("이미지 업로드 중 문제가 발생했습니다: " + error.message);
    }
}

/**
 * 이미지 URL을 기반으로 GPT Vision API를 호출하고 텍스트 분석 결과를 반환합니다.
 * @param {string} imageUrl - 분석할 이미지의 URL
 * @returns {Promise<string>} 이미지 분석 결과 텍스트
 */
export async function getImageAnalysisFromGptVision(imageUrl) {
    try {
        // ⭐⭐ 여기에 실제 백엔드 GPT Vision API 엔드포인트 URL 입력 ⭐⭐
        // 이 엔드포인트는 imageUrl을 받아서 GPT Vision API를 호출하고, 그 결과를 반환하는 역할을 해야 합니다.
        // 예시: https://your-backend-vision-cloud-function.run.app/analyzeImage
        const response = await fetch('YOUR_BACKEND_GPT_VISION_API_ENDPOINT', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl: imageUrl }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GPT Vision API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.description || "이미지 내용을 분석할 수 없습니다.";

    } catch (error) {
        console.error("Error calling GPT Vision API:", error);
        throw new Error("이미지 분석 서비스에 문제가 발생했습니다: " + error.message);
    }
}