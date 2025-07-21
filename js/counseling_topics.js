const counselingTopicsByAge = {
    directUser: {
        '10세미만': [
            {
                name: '나의 감정',
                subTopics: [
                    {
                        icon: '😊',
                        displayText: '기뻤던 순간 이야기하기',
                        systemPrompt: '사용자가 기뻤던 순간을 이야기하고 싶어합니다. 공감하며 구체적인 상황을 물어보고, 긍정적인 감정을 강화하는 대화를 유도하세요.',
                        tags: ['긍정', '기쁨'],
                        type: 'emotion'
                    },
                    {
                        icon: '😔',
                        displayText: '속상한 마음 나누기',
                        systemPrompt: '사용자가 속상한 마음을 나누고 싶어합니다. 부드럽게 공감하며 어떤 일이 있었는지, 어떤 도움을 원하는지 물어보세요.',
                        tags: ['부정', '슬픔'],
                        type: 'emotion'
                    },
                    {
                        icon: '🎧',
                        displayText: '소음이 너무 싫어요 (ASD)',
                        systemPrompt: '사용자가 감각 과부하(소음)에 대해 이야기하고 싶어합니다. ASD 특성을 고려해 공감하며, 소음에 대처하는 방법을 제안하세요.',
                        tags: ['ASD-감각과부하', '스트레스'],
                        type: 'sensory'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '사용자가 자유롭게 이야기하고 싶어합니다. 열린 질문으로 대화를 시작하고, 신경다양성 특성을 고려해 부드럽게 대응하세요.',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            },
            {
                name: '친구와의 시간',
                subTopics: [
                    {
                        icon: '🤝',
                        displayText: '친구와 다툰 이야기',
                        systemPrompt: '사용자가 친구와의 갈등을 이야기하고 싶어합니다. ASD 특성(사회적 상호작용 어려움)을 고려해 공감하고, 갈등 해결 방법을 제안하세요.',
                        tags: ['ASD-사회적상호작용', '갈등'],
                        type: 'social'
                    },
                    {
                        icon: '🎉',
                        displayText: '친구와 재밌었던 순간',
                        systemPrompt: '사용자가 친구와의 긍정적인 경험을 이야기하고 싶어합니다. 즐거운 기억을 강화하며 대화를 이어가세요.',
                        tags: ['긍정', '사회적상호작용'],
                        type: 'social'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '...',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            },
            {
                name: '나의 집중력',
                subTopics: [
                    {
                        icon: '🧠',
                        displayText: '집중이 안 될 때 (ADHD)',
                        systemPrompt: '사용자가 집중력 문제(ADHD)를 이야기하고 싶어합니다. 공감하며, 집중을 방해한 상황을 물어보고, 간단한 집중력 향상 방법을 제안하세요.',
                        tags: ['ADHD-집중력', '스트레스'],
                        type: 'attention'
                    },
                    {
                        icon: '🏃',
                        displayText: '너무 급하게 행동했어요 (ADHD)',
                        systemPrompt: '사용자가 충동적 행동(ADHD)에 대해 이야기하고 싶어합니다. 어떤 상황에서 충동적이었는지 물어보고, 충동 조절 방법을 제안하세요.',
                        tags: ['ADHD-충동성', '행동'],
                        type: 'behavior'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '...',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            }
        ],
        '11-15세': [
            {
                name: '학교 생활',
                subTopics: [
                    {
                        icon: '📚',
                        displayText: '학교에서 힘들었던 일',
                        systemPrompt: '사용자가 학교에서의 어려움을 이야기하고 싶어합니다. ASD/ADHD 특성을 고려해 공감하고, 구체적인 상황과 대처 방법을 논의하세요.',
                        tags: ['ASD-사회적상호작용', 'ADHD-집중력', '학교'],
                        type: 'school'
                    },
                    {
                        icon: '🎧',
                        displayText: '교실 소음이 힘들어요 (ASD)',
                        systemPrompt: '사용자가 교실의 감각 과부하(소음)에 대해 이야기하고 싶어합니다. ASD 특성을 고려해 공감하고, 대처 전략(예: 이어플러그)을 제안하세요.',
                        tags: ['ASD-감각과부하', '학교'],
                        type: 'sensory'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '...',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            },
            {
                name: '나의 감정',
                subTopics: [
                    {
                        icon: '😣',
                        displayText: '짜증이 날 때 (ADHD)',
                        systemPrompt: '사용자가 짜증(ADHD 관련 감정 기복)에 대해 이야기하고 싶어합니다. 공감하며 짜증의 원인을 물어보고, 감정 조절 방법을 제안하세요.',
                        tags: ['ADHD-감정기복', '부정'],
                        type: 'emotion'
                    },
                    {
                        icon: '😔',
                        displayText: '외로울 때',
                        systemPrompt: '사용자가 외로움에 대해 이야기하고 싶어합니다. ASD 특성(사회적 고립감)을 고려해 공감하고, 연결감을 높이는 방법을 제안하세요.',
                        tags: ['ASD-사회적상호작용', '외로움'],
                        type: 'emotion'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '...',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            }
        ],
        '16-29세': [
            {
                name: '일상 속 도전',
                subTopics: [
                    {
                        icon: '💼',
                        displayText: '직장에서의 어려움',
                        systemPrompt: '사용자가 직장에서의 어려움(ASD/ADHD 특성 관련)을 이야기하고 싶어합니다. 구체적인 상황을 물어보고, 직장 내 대처 전략을 제안하세요.',
                        tags: ['ASD-사회적상호작용', 'ADHD-집중력', '직장'],
                        type: 'work'
                    },
                    {
                        icon: '🎧',
                        displayText: '감각 과부하가 심해요 (ASD)',
                        systemPrompt: '사용자가 감각 과부하(ASD)에 대해 이야기하고 싶어합니다. 공감하며, 감각 관리 방법(예: 조용한 공간 찾기)을 제안하세요.',
                        tags: ['ASD-감각과부하', '스트레스'],
                        type: 'sensory'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '...',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            }
        ],
        '30-55세': [
            {
                name: '나의 삶',
                subTopics: [
                    {
                        icon: '🧠',
                        displayText: '집중력 관리하기 (ADHD)',
                        systemPrompt: '사용자가 집중력 문제(ADHD)에 대해 이야기하고 싶어합니다. 공감하며, 일상에서 집중력을 높이는 방법을 제안하세요.',
                        tags: ['ADHD-집중력', '일상'],
                        type: 'attention'
                    },
                    {
                        icon: '🤝',
                        displayText: '사회적 관계 어려움 (ASD)',
                        systemPrompt: '사용자가 사회적 상호작용(ASD)에서 어려움을 이야기하고 싶어합니다. 공감하며, 관계 개선 방법을 제안하세요.',
                        tags: ['ASD-사회적상호작용', '관계'],
                        type: 'social'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '...',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            }
        ],
        '55세이상': [
            {
                name: '나의 일상',
                subTopics: [
                    {
                        icon: '😔',
                        displayText: '늦게 알게 된 신경다양성 (ASD/ADHD)',
                        systemPrompt: '사용자가 늦게 진단받은 ASD/ADHD에 대해 이야기하고 싶어합니다. 공감하며, 자기 이해와 수용을 돕는 대화를 유도하세요.',
                        tags: ['ASD-자기이해', 'ADHD-자기이해', '진단'],
                        type: 'self'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '...',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            }
        ]
    },
    caregiver: {
        common: [
            {
                name: '양육의 어려움',
                subTopics: [
                    {
                        icon: '😣',
                        displayText: '자녀의 반복 행동에 화가 치밀어요 (ASD)',
                        systemPrompt: '보호자가 자녀의 반복 행동(ASD)으로 인한 스트레스를 이야기하고 싶어합니다. 공감하며, 자녀의 행동 배경을 설명하고 대처 방법을 제안하세요.',
                        tags: ['ASD-반복행동', '양육스트레스', '분노'],
                        type: 'caregiving'
                    },
                    {
                        icon: '🧠',
                        displayText: '자녀의 집중력 문제 (ADHD)',
                        systemPrompt: '보호자가 자녀의 집중력 문제(ADHD)에 대해 이야기하고 싶어합니다. 공감하며, ADHD 특성을 설명하고 가정 내 지원 방법을 제안하세요.',
                        tags: ['ADHD-집중력', '양육'],
                        type: 'caregiving'
                    },
                    {
                        icon: '💔',
                        displayText: '이게 카산드라 신드롬인가요?',
                        systemPrompt: '보호자가 카산드라 신드롬(정서적 소진)에 대해 이야기하고 싶어합니다. 공감하며, 소진의 원인을 물어보고 전문가 상담을 제안하세요.',
                        tags: ['카산드라신드롬', '소진', '양육스트레스'],
                        type: 'caregiving'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '...',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            },
            {
                name: '나의 감정상태',
                subTopics: [
                    {
                        icon: '😔',
                        displayText: '양육으로 지쳤어요',
                        systemPrompt: '보호자가 양육으로 인한 소진을 이야기하고 싶어합니다. 공감하며, 스트레스 관리 방법과 자녀의 신경다양성 특성을 이해하는 데 도움을 주세요.',
                        tags: ['소진', '양육스트레스'],
                        type: 'emotion'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '...',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            }
        ],
        '10세미만': [
            {
                name: '어린 자녀와의 시간',
                subTopics: [
                    {
                        icon: '🤝',
                        displayText: '자녀의 감각 문제 돕기 (ASD)',
                        systemPrompt: '보호자가 자녀의 감각 과부하(ASD)를 돕고 싶어합니다. 공감하며, 감각 조절 활동(예: 감각 놀이)을 제안하세요.',
                        tags: ['ASD-감각과부하', '양육'],
                        type: 'caregiving'
                    },
                    {
                        icon: '🏃',
                        displayText: '자녀의 충동적 행동 (ADHD)',
                        systemPrompt: '보호자가 자녀의 충동적 행동(ADHD)에 대해 이야기하고 싶어합니다. 공감하며, 행동 관리 전략을 제안하세요.',
                        tags: ['ADHD-충동성', '양육'],
                        type: 'caregiving'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '...',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            }
        ],
        '11-15세': [
            {
                name: '청소년 자녀와의 관계',
                subTopics: [
                    {
                        icon: '📚',
                        displayText: '학교 생활 지원하기 (ASD/ADHD)',
                        systemPrompt: '보호자가 자녀의 학교 생활(ASD/ADHD)을 지원하고 싶어합니다. 공감하며, 학교 환경 적응 방법을 제안하세요.',
                        tags: ['ASD-사회적상호작용', 'ADHD-집중력', '학교', '양육'],
                        type: 'caregiving'
                    },
                    {
                        icon: '💬',
                        displayText: '자유롭게 이야기하기',
                        systemPrompt: '...',
                        tags: ['자유주제', '기타'],
                        type: 'free_form'
                    }
                ]
            }
        ]
    }
};

// 태그 정규화 매핑 테이블
const tagNormalizationMap = {
    '우울감': '우울',
    '서운함': '슬픔',
    '불안감': '불안',
    '스트레스': '불안',
    '번아웃': '소진',
    '양육스트레스': '소진',
    '카산드라신드롬': '소진',
    'ASD-사회적상호작용': 'ASD-사회적상호작용',
    'ASD-감각과부하': 'ASD-감각과부하',
    'ASD-반복행동': 'ASD-반복행동',
    'ASD-자기이해': 'ASD-자기이해',
    'ADHD-집중력': 'ADHD-집중력',
    'ADHD-충동성': 'ADHD-충동성',
    'ADHD-감정기복': 'ADHD-감정기복',
    'ADHD-자기이해': 'ADHD-자기이해'
};

// 태그 정규화 함수
function normalizeTags(tags) {
    return tags.map(tag => tagNormalizationMap[tag] || tag);
}

// 중복 '자유롭게 이야기하기' 방지
function addFreeTopicOption() {
    const freeTopicOption = {
        icon: '💬',
        displayText: '기타 (자유롭게 이야기하기)',
        systemPrompt: '사용자가 자유롭게 이야기하고 싶어합니다. 열린 질문으로 대화를 시작하고, 신경다양성 특성을 고려해 부드럽게 대응하세요.',
        tags: ['자유주제', '기타'],
        type: 'free_form'
    };
    Object.keys(counselingTopicsByAge).forEach(userTypeKey => {
        const userTypeData = counselingTopicsByAge[userTypeKey];
        Object.keys(userTypeData).forEach(ageGroupKey => {
            const mainTopics = userTypeData[ageGroupKey];
            if (Array.isArray(mainTopics)) {
                mainTopics.forEach(mainTopic => {
                    const alreadyExists = mainTopic.subTopics.some(
                        sub => sub.type === 'free_form' && sub.displayText === freeTopicOption.displayText
                    );
                    if (!alreadyExists) {
                        mainTopic.subTopics.push(freeTopicOption);
                    }
                });
            }
        });
    });
}

// 주제 렌더링 전에 호출
addFreeTopicOption();

export { counselingTopicsByAge, normalizeTags };