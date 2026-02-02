/**
 * 한국어 인터페이스 번역
 */
export default {
    // 제목과 네비게이션
    appTitle: '단어 플레이어',
    homeBtn: '영어 받아쓰기',
    dictation: '받아쓰기',
    repeater: '반복',

    // 일반 설정
    general: '일반',
    shuffle: '셔플',
    slow: '느리게',
    target: '학습 언어',
    translation: '번역',
    interface: '인터페이스',
    accent: '억양',
    color: '색상',
    mode: '모드',

    // 억양 옵션
    us: '미국식',
    uk: '영국식',

    // 색상
    pink: '핑크',
    green: '그린',
    blue: '블루',
    purple: '퍼플',

    // 라이트/다크 모드
    light: '라이트',
    dark: '다크',

    // 받아쓰기 설정
    dictationSettings: '받아쓰기',
    maxRetry: '최대 재시도',
    wordWriteDefListen: '단어(쓰기):뜻(듣기)',
    dictateProvide: '제공',
    dictateWrite: '쓰기',
    optionWord: '단어',
    optionDef: '정의',

    // 반복 설정
    repeaterSettings: '반복',
    repeat: '반복',
    interval: '간격(ms)',

    // 단어 목록
    wordList: '단어 목록',
    load: '로드',
    save: '저장',
    update: '업데이트',
    wordInputPlaceholder: '단어 입력 (공백 또는 줄바꿈으로 구분)',
    reloading: '다시 로드 중...',
    emptyTitle: '저장된 단어장이 없습니다',
    emptyHint: '사이드바에 단어를 입력하고 저장을 클릭하세요',
    promptName: '단어장 이름 입력:',
    nameExists: '이름 "{name}"이(가) 이미 존재합니다. 다른 이름을 사용하세요',
    folderPromptName: '폴더 이름 입력:',
    folderNameExists: '폴더 이름 "{name}"이(가) 이미 존재합니다. 다른 이름을 사용하세요',
    deleteFolder: '폴더 "{name}"과(와) 모든 내용을 삭제하시겠습니까?',
    deleteCard: '"{name}"을(를) 삭제하시겠습니까?',

    // 로그인 관련
    login: '로그인',
    logout: '로그아웃',
    register: '가입',
    email: '이메일',
    password: '비밀번호',
    confirmPassword: '비밀번호 확인',
    forgotPassword: '비밀번호 찾기?',
    resetPassword: '비밀번호 재설정',
    sendCode: '코드 전송',
    verificationCode: '인증 코드',
    loginTitle: '로그인',
    loginSubtitle: '로그인하여 클라우드에 데이터 동기화',
    registerTitle: '가입',
    registerSubtitle: '계정을 만들어 시작하세요',
    forgotTitle: '비밀번호 찾기',
    forgotSubtitle: '이메일을 입력하여 인증 코드를 받으세요',
    resetTitle: '비밀번호 재설정',
    resetSubtitle: '{email}로 인증 코드를 보냈습니다',
    passwordHint: '비밀번호 (6자 이상)',
    newPasswordHint: '새 비밀번호 (6자 이상)',
    noAccount: '계정이 없으신가요? 가입',
    hasAccount: '이미 계정이 있으신가요? 로그인',
    backToLogin: '로그인으로 돌아가기',
    resendCode: '코드 재전송',
    processing: '처리 중...',
    passwordMismatch: '비밀번호가 일치하지 않습니다',
    operationFailed: '작업에 실패했습니다. 나중에 다시 시도하세요',
    networkError: '네트워크 오류, 나중에 다시 시도하세요',
    syncData: '데이터 동기화',

    // 메시지
    loading: '로딩 중...',
    saving: '저장 중...',
    saved: '저장됨',
    error: '오류',
    success: '성공',
    confirm: '확인',
    cancel: '취소',
    delete: '삭제',
    edit: '편집',
    done: '완료',

    // 단어 카드
    newFolder: '새 폴더',
    rename: '이름 변경',
    enterName: '이름 입력',
    folderName: '폴더 이름',
    wordlistName: '단어장 이름',

    // 팁
    pleaseLogin: '단어장을 저장하려면 먼저 로그인하세요',
    pleaseLoginUpdate: '단어장을 업데이트하려면 먼저 로그인하세요',
    noWords: '단어 없음',
    loadingTranslations: '번역',
    loadingAudio: '오디오',

    // 진행 상황 표시
    progressTranslation: '번역',
    progressAudio: '오디오',

    // 오류 메시지
    errorNotFound: '번역 실패: 단어를 찾을 수 없습니다',
    errorRateLimit: '번역 실패: 요청이 너무 많습니다',
    errorServer: '번역 실패: 서버 오류',
    errorHttp: '번역 실패: HTTP {status}',
    errorNetwork: '번역 실패: 네트워크 오류',
    errorRequest: '번역 실패: 요청 오류',
    errorAborted: '번역 실패: 요청이 중단되었습니다',
    errorTimeout: '번역 실패: 요청 시간 초과',
    errorParse: '번역 실패: 응답 구문 분석 오류',
    errorUnknown: '번역 실패: {message}',
    errorInvalidInput: '⚠️ 유효한 {lang}을(를) 입력하세요',
    errorWordNotFoundInYoudao: '유도 사전에서 단어를 찾을 수 없습니다',
    noTranslation: '번역 없음',
    errorAudioLoad: '오디오 로드 실패',
    errorAudioPlay: '오디오 재생 실패: {error}',
    errorTts: 'TTS 요청 실패: {status}',
    errorTtsLoad: 'TTS 로드 실패: {error}',
    warnWebSpeech: 'Youdao TTS 실패, Web Speech 시도: {error}',
    warnNoWebSpeech: '브라우저가 Web Speech API를 지원하지 않습니다',
    warningInvalidLang: '⚠️ {lang}만 입력 가능합니다',

    // 언어 이름
    langEnglish: '영어',
    langJapanese: '일본어',
    langKorean: '한국어',
    langFrench: '프랑스어',
    langChinese: '중국어',
    langWord: '단어',

    // 받아쓰기 모드
    writeWord: '쓰기: 단어',
    writeDefinition: '쓰기: 뜻',
    wordNum: '단어 #{num}',
    attempts: '시도 횟수',
    typeWordPlaceholder: '단어 입력',
    dictationComplete: '받아쓰기 완료!',
    score: '점수',
    firstTryCorrect: '첫 시도 정답',
    multipleTries: '여러 번 시도',
    failed: '실패',
    stamp: '채점완료',
    shareResult: '결과 공유',
    dictationRecord: '받아쓰기 기록',
    generating: '생성 중...',
    copySuccess: '클립보드에 복사되었습니다!',
    copyFailed: '복사 실패',

    // 반복 모드
    playCount: '재생 {current}/{total}',
    wordProgress: '단어 {current}/{total} ({percentage}%)',
    noDefinitions: '정의가 없습니다',
    noExamples: '예문이 없습니다',
    noSynonyms: '동의어/반의어가 없습니다',
    noDifficultyInfo: '난이도 정보가 없습니다',
    syn: '동',
    ant: '반',
    noWordsProvided: '단어를 입력하세요',

    // 어형 변화
    wordFormPast: '과거형',
    wordFormPastParticiple: '과거분사',
    wordFormDoing: '현재분사',
    wordFormThird: '3인칭 단수',
    wordFormComparative: '비교급',
    wordFormSuperlative: '최상급',
    wordFormPlural: '복수형',
    wordFormLemma: '원형',
    wordFormRoot: '어근',

    // 난이도 레벨
    collinsStars: '콜린스 별점',
    oxford3000: '옥스퍼드 3000',
    coreVocabulary: '핵심 어휘',
    frequencyRank: '빈도 순위',

    // 카드 색상
    colorOriginal: '원본',
    colorRed: '레드오렌지',
    colorCyan: '시안그린',
    colorPurple: '퍼플블루',
    colorPink: '핑크',
    colorBlue: '블루시안',
    colorGreen: '그린시안',
    colorGold: '핑크옐로',
    colorPastel1: '라이트시안핑크',
    colorPastel2: '라이트핑크',
    colorPastel3: '라이트퍼플핑크',
    colorNavy: '골드블루',
    colorLime: '그린옐로',
    colorSlate: '그레이블루'
};
