// js/tts.js

// 1) 백엔드 URL
const TTS_BACKEND_URL_TTS_MODULE = 'https://server-production-3e8f.up.railway.app/api/tts';

// 2) 사용할 수 있는 음성 리스트 및 기본값
export const AVAILABLE_VOICES = [
  "ko-KR-Chirp3-HD-Rasalgethi",
  "ko-KR-Chirp3-HD-Leda",
  "ko-KR-Chirp3-HD-Sadachbia",
  "ko-KR-Chirp3-HD-Kore",
  "ko-KR-Chirp3-HD-Schedar"
];
export let DEFAULT_VOICE = "ko-KR-Chirp3-HD-Leda";

if (!AVAILABLE_VOICES.includes(DEFAULT_VOICE)) {
  DEFAULT_VOICE = "ko-KR-Chirp3-HD-Leda"; // 기본값이 목록에 없으면 안전한 값으로 재설정
}

// 현재 재생 중인 오디오 객체와 Blob URL을 저장하기 위한 변수 (모듈 스코프)
let currentPlayingAudio = null;
let currentAudioRevokeUrl = null;

// 4) 현재 TTS 중지 함수 (talk.html 에서 import 필요)
export function stopCurrentTTS() {
  if (currentPlayingAudio) {
    currentPlayingAudio.pause(); // 현재 오디오 정지
    currentPlayingAudio.src = ''; // 오디오 로딩 중단 및 리소스 일부 해제 시도
    console.log("TTS 중지됨.");

    if (currentAudioRevokeUrl) {
        URL.revokeObjectURL(currentAudioRevokeUrl); // 이전에 생성된 Object URL 해제
        console.log("Blob URL 해제:", currentAudioRevokeUrl);
        currentAudioRevokeUrl = null;
    }
    currentPlayingAudio = null;
  }
}

// 3) TTS 재생 함수
export async function playTTSFromText(text, voiceId) {
  // 이전 TTS가 있다면 먼저 중지 (새로운 TTS 재생 전 항상 호출)
  stopCurrentTTS();

  const effectiveVoiceId = voiceId || DEFAULT_VOICE;

  if (!text || !String(text).trim()) {
    console.log("TTS: 말할 내용 없음.");
    return;
  }
  
  let finalVoiceId = effectiveVoiceId;
  if (!AVAILABLE_VOICES.includes(effectiveVoiceId)) {
      finalVoiceId = DEFAULT_VOICE;
  }
  console.log(`TTS 요청 - 텍스트: "${text}", 음성: "${finalVoiceId}"`);

  try {
    const response = await fetch(TTS_BACKEND_URL_TTS_MODULE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: finalVoiceId })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP error ${response.status}`);
      console.error(`TTS API 오류 ${response.status}: ${errText}`);
      throw new Error(`TTS API 오류 ${response.status}: ${errText}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      console.error("TTS: 수신된 오디오 데이터가 비어있음");
      throw new Error("TTS: 수신된 오디오 데이터가 비어있음");
    }
    
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    currentPlayingAudio = audio; // 새로 생성된 오디오 객체 할당
    currentAudioRevokeUrl = url; // revoke를 위해 URL 저장

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        console.log("TTS 재생 완료.");
        if (currentAudioRevokeUrl === url) { // URL.revokeObjectURL 중복 호출 방지
            URL.revokeObjectURL(url);
            currentAudioRevokeUrl = null;
        }
        if (currentPlayingAudio === audio) currentPlayingAudio = null; // 참조 제거
        resolve();
      };
      audio.onerror = e => {
        console.error("오디오 재생 중 오류:", e);
        if (currentAudioRevokeUrl === url) { // URL.revokeObjectURL 중복 호출 방지
            URL.revokeObjectURL(url);
            currentAudioRevokeUrl = null;
        }
        if (currentPlayingAudio === audio) currentPlayingAudio = null; // 참조 제거
        reject(new Error("오디오 재생 중 오류"));
      };
      audio.play().catch(playError => {
        console.error("오디오 재생 시작 오류:", playError);
        if (currentAudioRevokeUrl === url) { // URL.revokeObjectURL 중복 호출 방지
            URL.revokeObjectURL(url); 
            currentAudioRevokeUrl = null;
        }
        if (currentPlayingAudio === audio) currentPlayingAudio = null; // 참조 제거
        reject(playError);
      });
    });
  } catch (error) {
    console.error("TTS playTTSFromText 함수 내 오류:", error);
    // 오류 발생 시에도 현재 오디오 관련 변수들 초기화 시도
    if (currentPlayingAudio) {
        currentPlayingAudio.pause();
        currentPlayingAudio.src = '';
        currentPlayingAudio = null;
    }
    if (currentAudioRevokeUrl) {
        URL.revokeObjectURL(currentAudioRevokeUrl);
        currentAudioRevokeUrl = null;
    }
    throw error; 
  }
}