// js/tts.js

import { auth } from './firebase-config.js';

const TTS_BACKEND_URL = 'https://server-production-3e8f.up.railway.app/api/google-tts'; // ✅ 엔드포인트를 Google TTS용으로 변경
let audioContext = null; // AudioContext는 이제 getAudioContext 함수 내에서 생성 및 관리
let currentAudioSource = null;
// ⭐ FIX: Add a function to resume the AudioContext on the first user gesture.
// This is required by modern browsers to play any audio.
// AudioContext를 싱글톤 패턴으로 가져오고, suspended 상태일 경우 resume 시도

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext resumed successfully by user gesture.');
        }).catch(e => console.error('Error resuming AudioContext:', e));
    }
    return audioContext;
 }

/**
 * Stops any currently playing TTS audio.
 */
/**
 * 현재 재생 중인 TTS 오디오를 중지합니다.
 */
export function stopCurrentTTS() {
    if (currentAudioSource) {
        try {
            currentAudioSource.stop(); // 오디오 정지
            if (currentAudioSource.buffer) { // 버퍼가 있다면 연결 해제
                currentAudioSource.disconnect();
            }
        } catch (e) {
            console.warn("Could not stop audio source, it might have already finished or disconnected.", e);
        }
        currentAudioSource = null;
        console.log("TTS 재생 중지됨."); // 로그 추가
    }
}


/**
 * 텍스트를 백엔드 TTS API를 통해 음성으로 변환하고 재생합니다.
 * @param {string} text 재생할 텍스트.
 * @param {string} requestedVoice - 요청된 음성 이름 (localStorage에서 올 수도 있음). 'Leda'를 위한 실제 Google TTS 음성 이름으로 매핑됩니다.
 * @returns {Promise<void>}
 */
export async function playTTSFromText(text, requestedVoice) {
    stopCurrentTTS(); // 재생 시작 전 현재 오디오 중지

    // Firebase 인증 토큰 가져오기
    const currentUser = auth.currentUser; // ✅ firebase-config에서 import한 auth 인스턴스 사용
    if (!currentUser) {
        console.error("TTS Error: User not authenticated.");
        // 사용자에게 메시지를 보여주거나, 로그인 페이지로 리다이렉트하는 등의 추가 처리 필요
        throw new Error("User not authenticated for TTS.");
    }

    const token = await currentUser.getIdToken();

    // 'Leda' 음성 설정을 위한 매핑
    // 'Leda'는 실제 Google Cloud TTS 음성 이름이 아니므로, 매핑이 필요합니다.
    // 사용자가 'shimmer'를 선택했으면 'ko-KR-Neural2-C'를, 아니면 requestedVoice를 사용.
    // 필요한 경우 다른 음성 ID도 여기에 매핑 로직 추가.
    const voiceToUse = requestedVoice === 'shimmer' ? 'ko-KR-Neural2-C' : (requestedVoice || 'ko-KR-Neural2-C'); // ✅ 'Leda' 기본값 'ko-KR-Neural2-C'

    console.log(`TTS 요청 - 텍스트: "${text}", 음성: "${voiceToUse}"`); // ✅ 로그 메시지 수정

    const context = getAudioContext(); // AudioContext 가져오기

    try {
        const response = await fetch(TTS_BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // 인증 헤더 포함
            },
            body: JSON.stringify({ text: text, voiceName: voiceToUse }) // ✅ 백엔드에서 'voiceName'으로 받도록 수정
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`TTS API 응답 오류: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`TTS API failed with status: ${response.status}. Body: ${errorBody}`);
        }

        const audioData = await response.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(audioData); // AudioContext 사용

        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        source.start(0);

        currentAudioSource = source; // 현재 재생 중인 소스로 저장

        return new Promise((resolve) => {
            source.onended = () => {
                currentAudioSource = null;
                resolve();
            };
        });

    } catch (error) {
        console.error("TTS playTTSFromText 함수 내 오류:", error);
        stopCurrentTTS(); // 오류 발생 시 오디오 중지
        throw error;
    }
}

// playTTSWithControl 함수는 talk.js에서 호출하는 함수입니다.
// talk.js에서 이 함수를 호출할 때 text와 voice를 파라미터로 넘깁니다.
// 이전에 playTTSWithControl 함수를 별도로 정의했지만,
// playTTSFromText 함수 자체가 이 역할을 할 수 있으므로,
// talk.js에서 직접 playTTSFromText를 호출하도록 변경하는 것이 더 간결합니다.
// 만약 playTTSWithControl이 talk.js에 남아있다면, 해당 함수도 업데이트해야 합니다.
// (talk.js를 직접 수정하지 않으려면, 이 함수를 여기에 다시 정의해야 합니다.)
/*
// talk.js에 이 함수가 아직 있다면, 아래는 제거하거나, talk.js의 playTTSWithControl 로직을
// playTTSFromText(txt, voiceToUse) 형태로 변경하는 것을 권장합니다.
export async function playTTSWithControl(txt) {
    const voiceId = localStorage.getItem('lozee_voice'); // localStorage에서 음성 ID 가져오기
    await playTTSFromText(txt, voiceId); // playTTSFromText 호출
}
*/