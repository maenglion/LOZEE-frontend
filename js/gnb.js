document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const gnbElement = document.getElementById('gnb'); // gnb 전체 영역 참조

    if (menuToggle && dropdownMenu && gnbElement) {
        menuToggle.addEventListener('click', (event) => {
            event.stopPropagation(); // 이벤트 버블링 중단 (선택 사항)
            dropdownMenu.classList.toggle('show');
        });

        // 드롭다운 메뉴가 아닌 다른 곳을 클릭했을 때 메뉴 닫기
        document.addEventListener('click', (event) => {
            // 클릭된 요소가 gnb 영역 내부의 요소가 아니고,
            // 그리고 토글 버튼 자체도 아니라면 메뉴를 닫음
            if (!gnbElement.contains(event.target) && event.target !== menuToggle) {
                dropdownMenu.classList.remove('show');
            }
            // 만약 드롭다운 메뉴 내부의 링크를 클릭했을 때도 메뉴가 닫히게 하려면,
            // 드롭다운 메뉴 링크들에 대한 이벤트 리스너를 추가하고 거기서도 remove('show')를 호출할 수 있습니다.
            // 하지만 일반적으로 링크 클릭 시 페이지가 이동하므로 필수적이지 않을 수 있습니다.
        });
    } else {
        // 하나라도 요소를 찾지 못하면 콘솔에 경고를 남겨 디버깅 용이하게 함
        if (!menuToggle) console.warn("GNB: menu-toggle 요소를 찾을 수 없습니다.");
        if (!dropdownMenu) console.warn("GNB: dropdown-menu 요소를 찾을 수 없습니다.");
        if (!gnbElement) console.warn("GNB: gnb 요소를 찾을 수 없습니다.");
    }
});