// js/talk.js (테스트용 코드)

// 1. 이 로그가 콘솔에 찍히는지 확인합니다.
console.log("✅ talk.js 파일이 성공적으로 로드 및 파싱되었습니다.");

// 2. DOMContentLoaded 이벤트가 정상적으로 실행되는지 확인합니다.
document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ DOMContentLoaded 이벤트가 정상적으로 실행되었습니다.");

    const chatWindow = document.getElementById('chat-window');
    const inputArea = document.getElementById('input-area');

    if (chatWindow && inputArea) {
        // 3. HTML 요소를 찾고, 내용을 변경할 수 있는지 확인합니다.
        console.log("✅ chat-window와 input-area 요소를 성공적으로 찾았습니다.");
        chatWindow.innerHTML = '<p style="padding:20px; text-align:center; color: #1e88e5; font-weight:bold;">테스트 성공! talk.js가 연결되었습니다. 이제 이전 코드로 되돌린 후, 콘솔의 오류 메시지를 확인해주세요.</p>';
        inputArea.style.display = 'flex'; // 입력창을 강제로 표시
        inputArea.innerHTML = '<p style="width:100%; text-align:center; color:#555;">(테스트 중...)</p>';
    } else {
        console.error("❌ 'chat-window' 또는 'input-area' 요소를 찾을 수 없습니다. talk.html 파일의 id 속성을 확인해주세요.");
    }
});