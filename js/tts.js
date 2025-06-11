// js/tts.js

import { getAuth } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

const TTS_BACKEND_URL = 'https://server-production-3e8f.up.railway.app/api/tts';
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let currentAudioSource = null;

// ⭐ FIX: Add a function to resume the AudioContext on the first user gesture.
// This is required by modern browsers to play any audio.
function initAudioContext() {
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log("AudioContext resumed successfully by user gesture.");
        }).catch(e => console.error("Failed to resume AudioContext:", e));
    }
    // This listener should only run once.
    document.body.removeEventListener('click', initAudioContext);
    document.body.removeEventListener('touchend', initAudioContext);
}

// Add the event listeners to the page.
document.body.addEventListener('click', initAudioContext);
document.body.addEventListener('touchend', initAudioContext);


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

    const voiceToUse = voice || 'shimmer';
    console.log(`TTS 요청 - 텍스트: "${text}", 음성: "${voiceToUse}"`);

    try {
        // If the context is still suspended, try to resume it.
        // This might happen if the fetch is faster than the user's first click.
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const token = await currentUser.getIdToken();

        const response = await fetch(TTS_BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text, voice: voiceToUse })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`TTS API 응답 오류: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`TTS API failed with status: ${response.status}`);
        }

        const audioData = await response.arrayBuffer();
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
