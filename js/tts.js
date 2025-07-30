// js/tts.js
import { auth } from './firebase-config.js';

const TTS_BACKEND_URL = 'https://lozee-backend-838397276113.asia-northeast3.run.app/api/google-tts'; 

let audioContext = null;
let currentAudioSource = null;

// 오디오 컨텍스트 가져오기
function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(e => console.error('Error resuming AudioContext:', e));
    }
    return audioContext;
}

// 현재 TTS 정지
export function stopCurrentTTS() {
    if (currentAudioSource) {
        try {
            currentAudioSource.stop();
            if (currentAudioSource.buffer) {
                currentAudioSource.disconnect();
            }
        } catch (e) {
            console.warn("TTS 정지 중 오류:", e);
        }
        currentAudioSource = null;
        console.log("TTS 재생 중지됨.");
    }
}

/**
 * 텍스트를 Google TTS API를 통해 음성으로 변환 후 재생
 * @param {string} text - 재생할 텍스트
 * @param {string} requestedVoice - 사용자 선택 음성 ID (예: 'Leda')
 */
export async function playTTSFromText(text, requestedVoice = 'Leda') {
    stopCurrentTTS();

    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error("TTS Error: User not authenticated.");
        throw new Error("User not authenticated for TTS.");
    }

    const mapVoiceNameToGoogleVoice = (voiceId) => {
        switch (voiceId) {
            case 'Leda':
                return 'ko-KR-Chirp3-HD-Leda';
            case 'shimmer':
                return 'ko-KR-Chirp3-HD-Vindemiatrix';
            default:
                return 'ko-KR-Chirp3-HD-Leda';
        }
    };

    const voiceToUse = mapVoiceNameToGoogleVoice(requestedVoice);
    const token = await currentUser.getIdToken();

    console.log(`TTS 요청 - 텍스트: "${text}", 음성: "${voiceToUse}"`);

    const cleanedText = String(text).trim();

    const payload = {
        text: cleanedText,
        voice: voiceToUse
    };

    const response = await fetch(TTS_BACKEND_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS API failed with status: ${response.status}. Body: ${errorText}`);
    }

    const audioData = await response.arrayBuffer();
    const audioBlob = new Blob([audioData], { type: 'audio/wav' });
    const audio = new Audio(URL.createObjectURL(audioBlob));
    await audio.play();

    console.log("✅ TTS payload:", JSON.stringify(payload)); 
  }
