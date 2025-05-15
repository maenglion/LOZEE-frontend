<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LOZEE 시작하기</title>
    <link href="https://fonts.googleapis.com/css2?family=KoPub+World+Dotum:wght@400;700&display=swap" rel="stylesheet">
    <style>
        /* 기본 스타일 */
        body, html {
            margin: 0;
            padding: 0;
            font-family: 'KoPub World Dotum', sans-serif;
            color: #333; /* 기본 글자색은 어두운 색으로 유지 */
            height: 100%;
            overflow: hidden; /* 스크롤 방지 */
        }

        .step {
            display: none; /* 기본적으로 모든 스텝 숨김 */
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
            text-align: center;
            height: 100vh; /* 전체 화면 높이 */
            width: 100vw; /* 전체 화면 너비 */
            position: absolute; /* 겹치도록 설정 */
            top: 0;
            left: 0;
            color: white; /* 메인 배경 위에 표시될 글자색 */
        }

        .step.active {
            display: flex; /* 활성화된 스텝만 보임 */
        }

        /* 배경 스타일 */
        .step-background-main {
            background: linear-gradient(135deg, #6e8efb, #a777e3); /* 메인 배경 그라데이션 */
            color: white;
        }
        .step-background-main input,
        .step-background-main select,
        .step-background-main textarea {
            color: #333;
        }
        .step-background-main .error-message {
            color: #ffdddd; /* 메인 배경 위 오류 메시지 색상 */
        }
        .step-background-main .info-text {
            color: #e0e0e0; /* 보조 안내 텍스트 색상 */
            font-size: 0.9em;
            margin-bottom: 10px;
        }

        h1, h2 {
            margin-bottom: 20px;
        }
        h2 {
            font-size: 1.8em; /* 제목 크기 조정 */
        }

        p {
            margin-bottom: 15px;
            font-size: 1.1em; /* 문단 글꼴 크기 조정 */
            line-height: 1.6;
        }

        input[type="text"],
        input[type="number"],
        select,
        textarea {
            padding: 12px;
            margin-bottom: 12px;
            border: 1px solid #ccc;
            border-radius: 8px;
            width: 85%;
            max-width: 350px;
            box-sizing: border-box;
            font-size: 1em;
        }

        textarea {
            height: 120px;
            resize: none;
        }

        button {
            padding: 12px 25px;
            background-color: #ffffff; 
            color: #6e8efb; 
            border: none;
            border-radius: 25px; 
            cursor: pointer;
            transition: background-color 0.3s ease, color 0.3s ease, transform 0.2s ease;
            margin-top: 15px; 
            font-weight: bold;
            font-size: 1em;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        button:hover {
            background-color: #f0f0f0; 
            transform: translateY(-2px); 
        }
        button:active {
            transform: translateY(0px);
        }

        button:disabled {
            background-color: #ccc;
            color: #666;
            cursor: not-allowed;
            box-shadow: none;
            transform: none;
        }

        .error-message {
            color: #ffdddd; 
            font-size: 0.9em;
            min-height: 1.2em; 
            margin-top: -5px;
            margin-bottom: 5px;
            line-height: 1.2; 
        }

        .options-container { 
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
            margin-bottom: 20px;
            max-width: 450px; 
        }

        .options-container button, button.secondary-button { 
            background-color: rgba(255,255,255,0.2); 
            color: white;
            border: 1px solid rgba(255,255,255,0.5);
            padding: 10px 15px;
            border-radius: 20px; 
            font-size: 0.9em; 
            cursor: pointer;
            transition: background-color 0.3s ease, color 0.3s ease;
        }

        .options-container button.selected, 
        .options-container button:hover, 
        button.secondary-button:hover {
            background-color: white;
            color: #6e8efb; 
            border-color: white;
        }
        
        button.secondary-button { 
            margin-top: 5px;
            background-color: transparent;
            border: 1px solid white;
        }

        /* 반응형 디자인 */
        @media (max-width: 600px) {
            h2 { font-size: 1.5em; }
            p { font-size: 1em; }
            input[type="text"],
            input[type="number"],
            select,
            textarea {
                width: 90%;
                padding: 10px;
            }
            button { padding: 10px 20px; font-size: 0.95em;}
            .options-container button, button.secondary-button {
                padding: 8px 12px;
                font-size: 0.85em; 
            }
        }
    </style>
</head>
<body id="introBody" class="step-background-main">

    <div id="stepNameAge" class="step"> <h2>만나서 반가워요!</h2>
        <p>로지가 당신을 어떻게 부르면 좋을까요?</p>
        <input type="text" id="nameInput" placeholder="이름 또는 별명">
        <div class="error-message" id="nameError"></div>
        
        <p style="margin-top: 20px;">나이를 알려주세요.</p>
        <p class="info-text">로지와 깊이 있는 대화를 나누기 위해서는 나이 정보가 중요해요.<br>실제 나이를 선택해주세요.</p>
        <select id="ageSelectInput">
            <option value="">나이를 선택해주세요</option>
            </select>
        <div class="error-message" id="ageError"></div>
        <button id="submitNameAgeBtn">다음</button>
    </div>

    <div id="stepDiagnosis" class="step"> 
        <h2>가지고 있는 어려움이 있다면 알려주세요.</h2>
        <p class="info-text">로지가 당신을 더 잘 이해하는 데 도움이 될 수 있어요.<br>해당하는 것을 모두 선택해주세요. (선택하지 않아도 괜찮아요)</p>
        <div id="diagnosisSelection" class="options-container">
            </div>
        <div class="error-message" id="diagnosisError"></div>
        <button id="submitDiagnosisBtn">다음</button>
    </div>

    <div id="stepTopic" class="step"> 
        <h2>What would you like to talk about?</h2>
        <p><span id="topicUserAgeInfo"></span> Featured topics for users.<br>Please select the topic you want.</p>
        <div id="topicSelection" class="options-container"> 
            </div>
        <button id="noTopicBtn" class="secondary-button">N/A</button>
        <div class="error-message" id="topicOverallError"></div>
    </div>

    <script type="module">
        import { counselingTopicsByAge } from './js/counseling_topics.js';
        // TTS 관련 import는 실제 tts.js 구현에 따라 달라집니다.
        // import { playTTS } from './js/tts.js'; 

        // --- DOM 요소 바인딩 ---
        const introBody = document.getElementById('introBody');
        // stepCBT 관련 요소 바인딩 제거
        // const stepCBT = document.getElementById('stepCBT');
        // const cbtCodeInput = document.getElementById('cbtCodeInput');
        // const cbtCodeError = document.getElementById('cbtCodeError');
        // const submitCbtCodeBtn = document.getElementById('submitCbtCodeBtn');

        const stepNameAge = document.getElementById('stepNameAge');
        const nameInput = document.getElementById('nameInput');
        const nameError = document.getElementById('nameError');
        const ageSelectInput = document.getElementById('ageSelectInput');
        const ageError = document.getElementById('ageError');
        const submitNameAgeBtn = document.getElementById('submitNameAgeBtn');

        const stepDiagnosis = document.getElementById('stepDiagnosis');
        const diagnosisSelection = document.getElementById('diagnosisSelection');
        const diagnosisError = document.getElementById('diagnosisError');
        const submitDiagnosisBtn = document.getElementById('submitDiagnosisBtn');

        const stepTopic = document.getElementById('stepTopic');
        const topicUserAgeInfo = document.getElementById('topicUserAgeInfo');
        const topicSelection = document.getElementById('topicSelection');
        const noTopicBtn = document.getElementById('noTopicBtn');
        const topicOverallError = document.getElementById('topicOverallError');

        // --- 앱 상태 및 설정 ---
        let currentStepIndex = 0; // 첫 번째 스텝은 이제 stepNameAge (인덱스 0)
        const steps = [stepNameAge, stepDiagnosis, stepTopic]; // 스텝 순서 정의 (stepCBT 제거)
        // const CBT_CODE = "LOZEE2024"; // CBT 코드 관련 로직 제거

        // --- TTS 함수 (단일 목소리 사용 가정) ---
        let playTTSFromText = async (text, voiceName = "ko-KR-Chirp3-HD-Vindemiatrix") => { 
            console.log(`[MOCK TTS - Voice: ${voiceName}] ${text}`);
            // 실제 Web Speech API 또는 외부 TTS 서비스 연동 코드
            return Promise.resolve(); 
        };

        // --- 초기화 함수 ---
        function populateAgeOptions() {
            for (let i = 5; i <= 90; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `${i}세`;
                ageSelectInput.appendChild(option);
            }
        }

        const diagnosisOptionsList = [
            { id: 'adhd', text: 'ADHD' },
            { id: 'asd', text: 'ASD' },
            { id: 'asperger', text: 'ASD(아스퍼거증후군)' },
            { id: 'borderline_intel', text: '경계선지능' },
            { id: 'developmental_dis', text: '발달장애' },
            { id: 'language_delay', text: '언어지연' },
            { id: 'none', text: '진단받은 것 없어', exclusive: true },
            { id: 'prefer_not_to_say', text: '지금은 선택 안할래', exclusive: true }
        ];

        function populateDiagnosisOptions() {
            diagnosisSelection.innerHTML = '';
            diagnosisOptionsList.forEach(diag => {
                const button = document.createElement('button');
                button.textContent = diag.text;
                button.dataset.id = diag.id;
                if (diag.exclusive) button.dataset.exclusive = "true";

                button.onclick = () => {
                    button.classList.toggle('selected');
                    const isExclusive = button.dataset.exclusive === "true";
                    
                    if (button.classList.contains('selected') && isExclusive) {
                        diagnosisSelection.querySelectorAll('button').forEach(btn => {
                            if (btn !== button) btn.classList.remove('selected');
                        });
                    } else if (button.classList.contains('selected') && !isExclusive) {
                        diagnosisSelection.querySelectorAll('button[data-exclusive="true"]').forEach(exBtn => {
                            exBtn.classList.remove('selected');
                        });
                    }
                    diagnosisError.textContent = '';
                };
                diagnosisSelection.appendChild(button);
            });
        }

        async function initializeApp() {
            populateAgeOptions();
            populateDiagnosisOptions();
            
            // 첫 화면(이름/나이 입력)에 대한 초기 TTS 메시지
            playTTSFromText("안녕하세요! 로지와 대화를 시작해볼까요? 먼저 당신을 어떻게 부르면 좋을지, 나이는 어떻게 되는지 알려주세요.");
            showStep(currentStepIndex); // currentStepIndex는 0 (stepNameAge)
        }

        // --- 스텝 네비게이션 ---
        function showStep(index) {
            steps.forEach((step, i) => {
                if(step) step.classList.toggle('active', i === index);
            });
            currentStepIndex = index;
        }

        function validateAndProceedToNext(validationFn, errorElement, successCallback) {
            if (validationFn()) {
                if (errorElement) errorElement.textContent = ''; 
                if(successCallback) successCallback(); 
                
                if (currentStepIndex < steps.length - 1) {
                    showStep(currentStepIndex + 1); 
                } else {
                    proceedToDialog({}); 
                }
            }
        }
        
        // --- 이벤트 핸들러 ---
        // submitCbtCodeBtn 핸들러 제거

        submitNameAgeBtn.onclick = () => {
            let nameValid = false;
            let ageValid = false;

            if (nameInput.value.trim()) {
                nameError.textContent = '';
                nameValid = true;
            } else {
                nameError.textContent = '이름 또는 별명을 입력해주세요.';
                playTTSFromText('이름 또는 별명을 입력해주세요.');
            }

            if (ageSelectInput.value) {
                ageError.textContent = '';
                ageValid = true;
            } else {
                ageError.textContent = '나이를 선택해주세요.';
                 if(nameValid) playTTSFromText('나이를 선택해주세요.'); 
            }
            
            if (nameValid && ageValid) {
                validateAndProceedToNext(
                    () => true, 
                    nameError, 
                    () => {
                        localStorage.setItem('lozee_username', nameInput.value.trim());
                        localStorage.setItem('lozee_userage', ageSelectInput.value);
                        playTTSFromText("좋아요. 혹시 가지고 있는 어려움이 있다면 알려주세요. 로지가 당신을 더 잘 이해하는 데 도움이 될 수 있어요. 해당하는 것을 모두 선택해주세요. 선택하지 않아도 괜찮아요.");
                    }
                );
            }
        };

        submitDiagnosisBtn.onclick = () => {
            const selectedDiagnoses = [];
            diagnosisSelection.querySelectorAll('button.selected').forEach(btn => {
                selectedDiagnoses.push(btn.dataset.id); 
            });
            localStorage.setItem('lozee_userdisease', JSON.stringify(selectedDiagnoses)); 
            
            validateAndProceedToNext(
                () => true, 
                diagnosisError,
                () => {
                    const userAge = localStorage.getItem('lozee_userage');
                    if (topicUserAgeInfo) { 
                       topicUserAgeInfo.textContent = userAge ? `${userAge} years old.` : ''; 
                    }
                    renderTopicsForAge(userAge); 
                    playTTSFromText("What would you like to talk about? Featured topics for users. Please select the topic you want."); 
                }
            );
        };
        
        // --- 주제 선택 관련 로직 ---
        function getTopicsForAge(age) {
            if (!counselingTopicsByAge || Object.keys(counselingTopicsByAge).length === 0) {
                console.warn("counselingTopicsByAge 데이터가 비어있거나 로드되지 않았습니다. ./js/counseling_topics.js 파일을 확인해주세요.");
                return [];
            }
            const ageInt = parseInt(age, 10);
            let key;
            if (ageInt >= 8 && ageInt <= 10)    key = '8-10';
            else if (ageInt >= 11 && ageInt <= 15) key = '11-15'; 
            else                                key = '30+'; 
            
            return counselingTopicsByAge[key] || [];
        }

        function renderTopicsForAge(age) {
            const topics = getTopicsForAge(age);
            topicSelection.innerHTML = ''; 

            if (!age) {
                 topicSelection.innerHTML = '<p>Age information is missing. Please go back and select your age.</p>';
                 return;
            }
            if (topics.length === 0) { 
                topicSelection.innerHTML = '<p>No recommended topics for this age. You can select "N/A".</p>';
            }

            topics.forEach(topicText => {
                const button = document.createElement('button');
                button.textContent = topicText;
                button.onclick = () => {
                    console.log(`Topic selected: ${topicText}`);
                    localStorage.setItem('selectedTopic', topicText);
                    topicOverallError.textContent = '';
                    playTTSFromText(`${topicText} topic has been selected.`);
                    proceedToDialog({ topic: topicText, selectionMethod: 'recommended' });
                };
                topicSelection.appendChild(button);
            });
        }
        
        noTopicBtn.onclick = () => {
            topicSelection.querySelectorAll('button.selected').forEach(btn => btn.classList.remove('selected'));
            topicOverallError.textContent = '';
            localStorage.setItem('selectedTopic', 'USER_WILL_DEFINE_IN_CHAT');
            playTTSFromText("Okay. We can decide on a topic in our conversation.");
            proceedToDialog({ selectionMethod: 'user_will_define_in_chat' });
        };

        function proceedToDialog(data) {
            console.log("Proceeding to dialog with data:", data);
            alert("온보딩 완료! 실제 대화창으로 이동합니다. (구현 필요)\n" + JSON.stringify(localStorage)); 
            
            if(steps[currentStepIndex]) { 
                steps[currentStepIndex].classList.remove('active');
            }
        }

        // --- DOMContentLoaded ---
        document.addEventListener('DOMContentLoaded', initializeApp);

    </script>
</body>
</html>
