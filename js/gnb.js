// js/gnb.js

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const dropdownMenu = document.getElementById('dropdown-menu');

    // 기존 드롭다운 메뉴 토글 기능
    if (menuToggle && dropdownMenu) {
        menuToggle.addEventListener('click', (event) => {
            event.stopPropagation(); // 이벤트 전파 중단
            dropdownMenu.classList.toggle('show');
        });

        // 메뉴 바깥을 클릭하면 닫히도록 설정
        document.addEventListener('click', (event) => {
            if (!menuToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
    }

    // --- ⭐ 추가된 로직 시작: 나이에 따라 분석 링크 동적 변경 ⭐ ---
    const analysisLink = document.getElementById('gnb-analysis-link');
    if (analysisLink) {
        // localStorage에서 사용자 나이와 유형 정보를 가져옵니다.
        const userAge = parseInt(localStorage.getItem('lozee_userAge'), 10) || 0;
        const currentUserType = localStorage.getItem('lozee_userType');

        // 조건: 15세 이상 '당사자(directUser)'일 경우에만 성인 분석 페이지로 링크
        if (userAge >= 15 && currentUserType === 'directUser') {
            analysisLink.href = 'analysis_adult.html';
            // (선택 사항) 링크 텍스트도 변경하여 사용자에게 명확히 알려주기
            analysisLink.innerHTML = '📊 나의 대화 성찰'; 
        } else {
            // 그 외의 경우(15세 미만, 보호자 등)는 기본 분석 페이지로
            analysisLink.href = 'analysis.html';
            analysisLink.innerHTML = '📊 우리 이야기 분석';
        }
        console.log(`GNB 분석 링크가 '${analysisLink.href}'로 설정되었습니다.`);
    }
    // --- ⭐ 추가된 로직 끝 ---
});