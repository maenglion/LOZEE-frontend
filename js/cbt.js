// js/cbt.js

// 실제 운영 시 이 이메일 목록은 서버에서 관리하거나 더 안전한 방식으로 확인하는 것이 좋습니다.
// CBT 참여자 이메일 목록 (모두 소문자로 저장하여 대소문자 구분 없이 비교)
const VALID_CBT_EMAILS = [
    "maengnanyoung@gmail.com",
    "primer0722@gmail.com" ,
    "soul.minhoo.maeng@gmail.com" ,
    "orchidyoung@naver.com" ,
    "sujakso138@naver.com " , 
    "maenghakjae@gmail.com " ,
    "yesook0613@naver.com" ,
    "unbearable_@naver.com"
    // 필요에 따라 여기에 더 많은 이메일 주소를 추가할 수 있습니다.
].map(email => email.toLowerCase()); // 비교를 위해 미리 소문자로 변환

/**
 * 입력된 이메일이 유효한 CBT 참여자인지 검사합니다.
 * @param {string} userInput 사용자가 입력한 이메일 주소
 * @returns {boolean} 이메일이 유효한 참여자 명단에 있으면 true, 그렇지 않으면 false
 */
export function validateCbtEmail(userInput) {
    if (!userInput) {
        return false;
    }
    // 사용자 입력도 소문자로 변환하여 대소문자 구분 없이 비교
    const formattedInput = userInput.trim().toLowerCase();
    return VALID_CBT_EMAILS.includes(formattedInput);
}

/**
 * CBT 코드(이메일) 관련 오류 메시지를 반환합니다.
 * @returns {string} 오류 메시지
 */
export function getCbtErrorMessage() {
    // 오류 메시지를 좀 더 명확하게 변경할 수 있습니다. 예: "유효한 CBT 참여자 이메일이 아닙니다."
    return 'CBT 참여자 이메일이 올바르지 않아요. 다시 확인해주세요.';
}
