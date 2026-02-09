/**
 * English UI translations
 */
export default {
    // Title and navigation
    appTitle: 'Word Player',
    homeBtn: 'Word Player',
    dictation: 'Dictation',
    repeater: 'Repeater',

    // General settings
    general: 'General',
    shuffle: 'Shuffle',
    slow: 'Slow',
    target: 'Target',
    translation: 'Translation',
    interface: 'Interface',
    accent: 'Accent',
    color: 'Color',
    mode: 'Mode',

    // Accent options
    us: 'US',
    uk: 'UK',

    // Colors
    pink: 'Pink',
    green: 'Green',
    blue: 'Blue',
    purple: 'Purple',

    // Light/Dark mode
    light: 'Light',
    dark: 'Dark',

    // Dictation settings
    dictationSettings: 'Dictation',
    maxRetry: 'Max Retry',
    wordWriteDefListen: 'Word(write):Def(listen)',
    dictateProvide: 'Provide',
    dictateWrite: 'Write',
    optionWord: 'Word',
    optionDef: 'Definition',

    // Repeater settings
    repeaterSettings: 'Repeater',
    repeat: 'Repeat',
    interval: 'Interval(ms)',

    // Word list
    wordcard: 'Word List',
    load: 'Load',
    save: 'Save',
    update: 'Update',
    wordInputPlaceholder: 'Enter words (separated by spaces or newlines)',
    reloading: 'Reloading...',
    emptyTitle: 'No saved word lists',
    emptyHint: 'Enter words in the sidebar and click Save',
    promptName: 'Enter wordcard name:',
    nameExists: 'Name "{name}" already exists, please use another name',
    folderPromptName: 'Enter folder name:',
    folderNameExists: 'Folder name "{name}" already exists, please use another name',
    deleteFolder: 'Delete folder "{name}" and all its contents?',
    deleteCard: 'Delete "{name}"?',

    // Login related
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    resetPassword: 'Reset Password',
    sendCode: 'Send Code',
    verificationCode: 'Verification Code',
    loginTitle: 'Login',
    loginSubtitle: 'Login to sync data to cloud',
    registerTitle: 'Register',
    registerSubtitle: 'Create an account to get started',
    forgotTitle: 'Forgot Password',
    forgotSubtitle: 'Enter email to receive verification code',
    resetTitle: 'Reset Password',
    resetSubtitle: 'Verification code sent to {email}',
    passwordHint: 'Password (at least 6 characters)',
    newPasswordHint: 'New password (at least 6 characters)',
    noAccount: "Don't have an account? Register",
    hasAccount: 'Already have an account? Login',
    backToLogin: 'Back to Login',
    resendCode: 'Resend Code',
    processing: 'Processing...',
    sending: 'Sending...',
    emailRequired: 'Please enter email',
    codeRequired: 'Please enter verification code',
    passwordMismatch: 'Passwords do not match',
    operationFailed: 'Operation failed, please try again later',
    networkError: 'Network error, please try again later',
    syncData: 'Sync Data',
    checkEmail: 'Please check your email',
    checkSpamFolder: 'If you haven\'t received the email, please check your spam folder',

    // Messages
    loading: 'Loading...',
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Error',
    success: 'Success',
    confirm: 'OK',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    done: 'Done',
    deleteSuccess: 'Deleted successfully',
    deleteFailed: 'Delete failed',

    // Word cards
    newFolder: 'New Folder',
    rename: 'Rename',
    enterName: 'Enter name',
    folderName: 'Folder name',
    wordcardName: 'Wordcard name',

    // Tips
    pleaseLogin: 'Please login first to save word lists',
    pleaseLoginUpdate: 'Please login first to update word lists',
    noWords: 'No words',
    loadingTranslations: 'Translations',
    loadingAudio: 'Audio',

    // Progress display
    progressTranslation: 'Translation',
    progressAudio: 'Audio',

    // Error messages
    errorNotFound: 'Translation failed: Word not found',
    errorRateLimit: 'Translation failed: Too many requests',
    errorServer: 'Translation failed: Server error',
    errorHttp: 'Translation failed: HTTP {status}',
    errorNetwork: 'Translation failed: Network error',
    errorRequest: 'Translation failed: Request error',
    errorAborted: 'Translation failed: Request aborted',
    errorTimeout: 'Translation failed: Request timeout',
    errorParse: 'Translation failed: Response parse error',
    errorUnknown: 'Translation failed: {message}',
    errorInvalidInput: '⚠️ Please enter valid {lang}',
    errorWordNotFoundInYoudao: 'Word not found in Youdao dictionary',
    noTranslation: 'No translation',
    errorAudioLoad: 'Audio load failed',
    errorAudioPlay: 'Audio playback failed: {error}',
    errorTts: 'TTS request failed: {status}',
    errorTtsLoad: 'TTS load failed: {error}',
    warnWebSpeech: 'Youdao TTS failed, trying Web Speech: {error}',
    warnNoWebSpeech: 'Browser does not support Web Speech API',
    warningInvalidLang: '⚠️ Only {lang} input allowed',

    // Language names
    langEnglish: 'English',
    langJapanese: 'Japanese',
    langKorean: 'Korean',
    langChinese: 'Chinese',
    langWord: 'words',

    // Dictation mode
    writeWord: 'Write: Word',
    writeDefinition: 'Write: Definition',
    wordNum: 'Word #{num}',
    attempts: 'Attempts',
    typeWordPlaceholder: 'Type the word',
    dictationComplete: 'Dictation Complete!',
    score: 'Score',
    firstTryCorrect: 'First try correct',
    multipleTries: 'Multiple tries',
    failed: 'Failed',
    stamp: 'Graded',
    shareResult: 'Share Result',
    dictationRecord: 'Dictation Record',
    generating: 'Generating...',
    copySuccess: 'Copied to clipboard!',
    copyFailed: 'Copy failed',
    retryFailed: 'Retry Failed Words',
    retryComplete: 'Retry Round {num} Complete',
    retryRound: 'Retry Round {num}',

    // Repeater mode
    playCount: 'Play {current}/{total}',
    wordProgress: 'Word {current}/{total} ({percentage}%)',
    noDefinitions: 'No definitions available',
    noExamples: 'No examples available',
    noSynonyms: 'No synonyms/antonyms available',
    noDifficultyInfo: 'No difficulty information available',
    syn: 'Syn',
    ant: 'Ant',
    noWordsProvided: 'No words provided',

    // Word forms
    wordFormPast: 'Past',
    wordFormPastParticiple: 'Past Participle',
    wordFormDoing: 'Present Participle',
    wordFormThird: '3rd Person Singular',
    wordFormComparative: 'Comparative',
    wordFormSuperlative: 'Superlative',
    wordFormPlural: 'Plural',
    wordFormLemma: 'Lemma',
    wordFormRoot: 'Root',

    // Difficulty levels
    collinsStars: 'Collins Stars',
    oxford3000: 'Oxford 3000',
    coreVocabulary: 'Core Vocabulary',
    frequencyRank: 'Frequency Rank',

    // Card colors
    colorOriginal: 'Original',
    colorRed: 'Red-Orange',
    colorCyan: 'Cyan-Green',
    colorPurple: 'Purple-Blue',
    colorPink: 'Pink',
    colorBlue: 'Blue-Cyan',
    colorGreen: 'Green-Cyan',
    colorGold: 'Pink-Yellow',
    colorPastel1: 'Light Cyan-Pink',
    colorPastel2: 'Light Pink',
    colorPastel3: 'Light Purple-Pink',
    colorNavy: 'Gold-Blue',
    colorLime: 'Green-Yellow',
    colorSlate: 'Gray-Blue',

    // Guide module
    guidePrevious: 'Previous',
    guideClose: 'Close',
    guideNext: 'Next',

    // Additional messages
    shareError: 'Failed to generate share',
    noLemmaWords: 'No lemma words found',
    loadFailed: 'Load failed',
    savedToDownload: 'Saved to downloads',

    // Public folders
    searchPublicFolders: 'Search Public Folders',
    searchPlaceholder: 'Search folder name or author email...',
    publishFolder: 'Make Public',
    unpublishFolder: 'Make Private',
    publicFolderAdded: 'Public folder added',
    folderPublished: 'Folder is now public',
    folderUnpublished: 'Folder is now private',
    searchFailed: 'Search failed',
    addFailed: 'Add failed',
    copyFailed: 'Copy failed',
    words: 'words',
    searching: 'Searching...',
    noResults: 'No Results',
    tryDifferentKeywords: 'Try different keywords',
    folderInvalid: 'Invalid',

    // Public card copy functionality
    createCopy: 'Make Copy',
    copySuffix: '-copy',
    createCopyAndRename: 'Create Copy and Rename',
    copyCreatedSuccess: 'Copy created successfully',
    cannotModifyPublicCard: 'Cannot modify public card, please use \'Make Copy\' function'
};
