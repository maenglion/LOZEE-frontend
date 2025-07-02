// js/tts.js
import { auth } from './firebase-config.js';

const TTS_BACKEND_URL = 'https://server-production-3e8f.up.railway.app/api/google-tts'; // Google TTS 엔드포인트

let audioContext = null; // AudioContext는 getAudioContext 함수 내에서 생성 및 관리
let currentAudioSource = null; // 현재 재생 중인 AudioBufferSourceNode를 저장

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
        console.log("TTS 재생 중지됨.");
    }
}

/**
 * 텍스트를 백엔드 TTS API를 통해 음성으로 변환하고 재생합니다.
 * @param {string} text 재생할 텍스트.
 * @param {string} requestedVoice - 요청된 음성 이름 (localStorage에서 올 수도 있음).
 * @returns {Promise<void>}
 */
export async function playTTSFromText(text, requestedVoice) {
    stopCurrentTTS();

    // Firebase 인증 토큰 가져오기
    const currentUser = auth.currentUser; // firebase-config에서 import한 auth 인스턴스 사용
    if (!currentUser) {
        console.error("TTS Error: User not authenticated.");
        throw new Error("User not authenticated for TTS.");
    }

    const token = await currentUser.getIdToken();

    // 'Leda' 및 기타 요청 음성을 실제 Google Cloud TTS 음성 이름으로 매핑
    const mapVoiceNameToGoogleVoice = (voiceId) => {
        switch (voiceId) {
            case 'Leda': // 'Leda'라는 이름이 요청되면 ko-KR-Chirp3-HD-Leda 사용
                return 'ko-KR-Chirp3-HD-Leda'; // ✅ 사용자 요청에 따른 정확한 음성 이름
            case 'shimmer': // 기존 'shimmer'에 대한 매핑 (필요 시)
                return 'ko-KR-Chirp3-HD-Vindemiatrix'; // 또는 다른 적절한 음성
            // 다른 가상 이름 또는 직접 Google Cloud TTS 음성 이름에 대한 매핑 추가 가능
            default:
                return 'ko-KR-Chirp3-HD-Leda'; // ✅ 기본값 음성으로 설정
        }
    };
    
    const voiceToUse = mapVoiceNameToGoogleVoice(requestedVoice); // 요청된 음성 이름을 Google TTS 음성으로 매핑

    console.log(`TTS 요청 - 텍스트: "${text}", 음성: "${voiceToUse}"`);

    const context = getAudioContext();
    // ✅ 여기에서 text를 정제해야 합니다.
    const sanitizedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); // 백슬래시와 큰따옴표 이스케이프

    try {
           const response = await fetch(TTS_BACKEND_URL, { // ✅ URL도 TTS_BACKEND_URL 변수 사용
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
  body: JSON.stringify({
                text: sanitizedText , 
                voiceName: voiceToUse  // ✅ voiceToUse 변수 사용 (백엔드에서 voiceName으로 받음)
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`TTS API 응답 오류: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`TTS API failed with status: ${response.status}. Body: ${errorBody}`);
        }

        const audioData = await response.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(audioData);

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