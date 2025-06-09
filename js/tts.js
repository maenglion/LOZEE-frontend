// js/tts.js

import { getAuth } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

const TTS_BACKEND_URL = 'https://server-production-3e8f.up.railway.app/api/tts';
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let currentAudioSource = null;

/**
 * Stops any currently playing TTS audio.
 */
export function stopCurrentTTS() {
    if (currentAudioSource) {
        try {
            currentAudioSource.stop();
        } catch (e) {
            console.warn("Could not stop audio source, it might have already finished.", e);
        }
        currentAudioSource = null;
    }
}

/**
 * Fetches TTS audio from the backend and plays it.
 * @param {string} text The text to be converted to speech.
 * @param {string} voice The desired voice for the speech.
 */
export async function playTTSFromText(text, voice) {
    stopCurrentTTS();

    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
        console.error("TTS Error: User not authenticated.");
        throw new Error("User not authenticated.");
    }
    
    // ⭐ FIX: Provide a default voice if the one from localStorage is null or invalid.
    const voiceToUse = voice || 'alloy';
    console.log(`TTS 요청 - 텍스트: "${text}", 음성: "${voiceToUse}"`);

    try {
        const token = await currentUser.getIdToken();

        const response = await fetch(TTS_BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text, voice: voiceToUse }) // Use the safe voiceToUse
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`TTS API 응답 오류: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`TTS API failed with status: ${response.status}`);
        }

        const audioData = await response.arrayBuffer();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        const audioBuffer = await audioContext.decodeAudioData(audioData);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        currentAudioSource = source;

        return new Promise((resolve) => {
            source.onended = () => {
                currentAudioSource = null;
                resolve();
            };
        });

    } catch (error) {
        console.error("TTS playTTSFromText 함수 내 오류:", error);
        stopCurrentTTS();
        throw error;
    }
}
