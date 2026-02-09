/**
 * 中文界面翻译
 */
export default {
    // 标题和导航
    appTitle: '单词玩家',
    homeBtn: '单词玩家',
    dictation: '听 写',
    repeater: '复 读',

    // 通用设置
    general: '通用',
    shuffle: '单词随机',
    slow: '慢速阅读',
    target: '目标语言',
    translation: '翻译',
    interface: '界面',
    accent: '口音',
    color: '颜色',
    mode: '模式',

    // 口音选项
    us: '美式',
    uk: '英式',

    // 颜色
    pink: '粉色',
    green: '绿色',
    blue: '蓝色',
    purple: '紫色',

    // 亮暗模式
    light: '浅色',
    dark: '深色',

    // 听写设置
    dictationSettings: '听写',
    maxRetry: '最大重试',
    wordWriteDefListen: '单词(写):释义(听)',
    dictateProvide: '提供',
    dictateWrite: '书写',
    optionWord: '单词',
    optionDef: '释义',

    // 复读设置
    repeaterSettings: '复读',
    repeat: '重复',
    interval: '间隔(毫秒)',

    // 单词列表
    wordcard: '单词列表',
    load: '加载',
    save: '保存',
    update: '更新',
    clearInput: '清空',
    wordInputPlaceholder: '输入单词（用空格或换行分隔）',
    reloading: '重新加载中...',
    emptyTitle: '暂无保存的单词卡',
    emptyHint: '在侧边栏输入单词后点击保存',
    promptName: '输入单词卡名称：',
    nameExists: '名称 "{name}" 已存在，请使用其他名称',
    folderPromptName: '输入文件夹名称：',
    folderNameExists: '文件夹名称 "{name}" 已存在，请使用其他名称',
    deleteFolder: '删除文件夹 "{name}" 及其所有内容？',
    deleteCard: '删除 "{name}"？',

    // 登录相关
    login: '登录',
    logout: '退出登录',
    register: '注册',
    email: '邮箱',
    password: '密码',
    confirmPassword: '确认密码',
    forgotPassword: '忘记密码？',
    resetPassword: '重置密码',
    sendCode: '发送验证码',
    verificationCode: '验证码',
    loginTitle: '登录',
    loginSubtitle: '登录后可同步数据到云端',
    registerTitle: '注册',
    registerSubtitle: '创建账号开始使用',
    forgotTitle: '忘记密码',
    forgotSubtitle: '输入邮箱接收验证码',
    resetTitle: '重置密码',
    resetSubtitle: '验证码已发送到 {email}',
    passwordHint: '密码（至少6位）',
    newPasswordHint: '新密码（至少6位）',
    noAccount: '没有账号？注册',
    hasAccount: '已有账号？登录',
    backToLogin: '返回登录',
    resendCode: '重新发送验证码',
    processing: '处理中...',
    sending: '发送中...',
    emailRequired: '请输入邮箱',
    codeRequired: '请输入验证码',
    passwordMismatch: '两次输入的密码不一致',
    operationFailed: '操作失败，请稍后重试',
    networkError: '网络错误，请稍后重试',
    syncData: '同步数据',
    checkEmail: '请检查您的邮箱',
    checkSpamFolder: '如果未收到邮件，请检查垃圾邮件文件夹',

    // 消息
    loading: '加载中...',
    saving: '保存中...',
    saved: '已保存',
    error: '错误',
    success: '成功',
    confirm: '确定',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    done: '完成',
    deleteSuccess: '删除成功',
    deleteFailed: '删除失败',

    // 单词卡
    newFolder: '新文件夹',
    rename: '重命名',
    enterName: '输入名称',
    folderName: '文件夹名称',
    wordcardName: '单词卡名称',

    // 提示
    pleaseLogin: '请先登录后再保存单词卡',
    pleaseLoginUpdate: '请先登录后再更新单词卡',
    noWords: '没有单词',
    loadingTranslations: '翻译',
    loadingAudio: '音频',

    // 进度显示
    progressTranslation: '翻译',
    progressAudio: '音频',

    // 错误消息
    errorNotFound: '翻译失败: 未找到该单词',
    errorRateLimit: '翻译失败: 请求过于频繁',
    errorServer: '翻译失败: 服务器错误',
    errorHttp: '翻译失败: HTTP {status}',
    errorNetwork: '翻译失败: 网络连接错误',
    errorRequest: '翻译失败: 请求构造错误',
    errorAborted: '翻译失败: 请求被中断',
    errorTimeout: '翻译失败: 请求超时',
    errorParse: '翻译失败: 响应解析错误',
    errorUnknown: '翻译失败: {message}',
    errorInvalidInput: '⚠️ 请输入有效的{lang}',
    errorWordNotFoundInYoudao: '单词未通过有道验证',
    noTranslation: '无翻译',
    errorAudioLoad: '音频加载失败',
    errorAudioPlay: '音频播放失败: {error}',
    errorTts: 'TTS请求失败: {status}',
    errorTtsLoad: 'TTS加载失败: {error}',
    warnWebSpeech: '有道TTS失败，尝试Web Speech: {error}',
    warnNoWebSpeech: '浏览器不支持 Web Speech API',
    warningInvalidLang: '⚠️ 只允许输入{lang}',

    // 语言名称
    langEnglish: '英文',
    langJapanese: '日语',
    langKorean: '韩语',
    langChinese: '中文',
    langWord: '单词',

    // 听写模式
    writeWord: '写: 单词',
    writeDefinition: '写: 释义',
    wordNum: '单词 #{num}',
    attempts: '尝试次数',
    typeWordPlaceholder: '输入单词',
    dictationComplete: '听写完成！',
    score: '得分',
    firstTryCorrect: '一次正确',
    multipleTries: '多次尝试',
    failed: '失败',
    stamp: '批阅',
    shareResult: '分享结果',
    dictationRecord: '听写记录',
    generating: '生成中...',
    copySuccess: '已复制到剪贴板！',
    copyFailed: '复制失败',
    retryFailed: '错题重听',
    retryComplete: '第 {num} 次重试完成',
    retryRound: '第 {num} 次重试',

    // 复读模式
    playCount: '播放 {current}/{total}',
    wordProgress: '单词 {current}/{total} ({percentage}%)',
    noDefinitions: '暂无释义',
    noExamples: '暂无例句',
    noSynonyms: '暂无同/反义词',
    noDifficultyInfo: '暂无难度信息',
    syn: '近',
    ant: '反',
    noWordsProvided: '请输入单词',

    // 词形变化
    wordFormPast: '过去式',
    wordFormPastParticiple: '过去分词',
    wordFormDoing: '现在分词',
    wordFormThird: '第三人称单数',
    wordFormComparative: '比较级',
    wordFormSuperlative: '最高级',
    wordFormPlural: '复数',
    wordFormLemma: '原型',
    wordFormRoot: '词根',

    // 难度等级
    collinsStars: '柯林斯星级',
    oxford3000: '牛津3000核心词汇',
    coreVocabulary: '核心词汇',
    frequencyRank: '词频排名',

    // 卡片颜色
    colorOriginal: '原色',
    colorRed: '红橙',
    colorCyan: '青绿',
    colorPurple: '紫蓝',
    colorPink: '粉红',
    colorBlue: '蓝青',
    colorGreen: '绿青',
    colorGold: '粉黄',
    colorPastel1: '淡青粉',
    colorPastel2: '淡粉',
    colorPastel3: '淡紫粉',
    colorNavy: '金蓝',
    colorLime: '绿黄',
    colorSlate: '灰蓝',

    // 指引模块
    guidePrevious: '上一步',
    guideClose: '关闭',
    guideNext: '下一步',

    // 其他消息
    shareError: '生成失败',
    noLemmaWords: '未找到同词根词汇',
    loadFailed: '加载失败',
    savedToDownload: '已保存到下载',

    // 公开文件夹
    searchPublicFolders: '搜索公开单词卡',
    searchPlaceholder: '搜索文件夹名称或作者邮箱...',
    publishFolder: '设为公开',
    unpublishFolder: '取消公开',
    publicFolderAdded: '已添加公开文件夹',
    folderPublished: '文件夹已设为公开',
    folderUnpublished: '文件夹已取消公开',
    searchFailed: '搜索失败',
    addFailed: '添加失败',
    copyFailed: '复制失败',
    words: '词',
    searching: '搜索中...',
    noResults: '暂无结果',
    tryDifferentKeywords: '试试其他关键词吧',
    folderInvalid: '已失效',

    // 公开卡片副本功能
    createCopy: '创建副本',
    copySuffix: '-副本',
    createCopyAndRename: '创建副本并命名',
    copyCreatedSuccess: '副本创建成功',
    cannotModifyPublicCard: '无法修改公开卡片，请使用「创建副本」功能'
};
