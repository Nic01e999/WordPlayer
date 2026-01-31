/**
 * 日本語インターフェース翻訳
 */
export default {
    // タイトルとナビゲーション
    appTitle: '単語プレーヤー',
    homeBtn: '英語ディクテーション',
    dictation: 'ディクテーション',
    repeater: 'リピーター',

    // 一般設定
    general: '一般',
    shuffle: 'シャッフル',
    slow: 'スロー',
    target: '学習言語',
    translation: '翻訳',
    interface: 'インターフェース',
    accent: 'アクセント',
    color: 'カラー',
    mode: 'モード',

    // アクセントオプション
    us: '米国式',
    uk: '英国式',

    // 色
    pink: 'ピンク',
    green: 'グリーン',
    blue: 'ブルー',
    purple: 'パープル',

    // ライト/ダークモード
    light: 'ライト',
    dark: 'ダーク',

    // ディクテーション設定
    dictationSettings: 'ディクテーション',
    maxRetry: '最大リトライ',
    wordWriteDefListen: '単語(書く):意味(聞く)',

    // リピーター設定
    repeaterSettings: 'リピーター',
    repeat: 'リピート',
    interval: '間隔(ミリ秒)',

    // 単語リスト
    wordList: '単語リスト',
    load: '読み込み',
    save: '保存',
    update: '更新',
    wordInputPlaceholder: '単語を入力（スペースまたは改行で区切る）',
    reloading: '再読み込み中...',
    emptyTitle: '保存された単語リストがありません',
    emptyHint: 'サイドバーに単語を入力して保存をクリック',
    promptName: '単語リスト名を入力：',
    nameExists: '名前「{name}」は既に存在します。別の名前を使用してください',
    folderPromptName: 'フォルダ名を入力：',
    folderNameExists: 'フォルダ名「{name}」は既に存在します。別の名前を使用してください',
    deleteFolder: 'フォルダ「{name}」とその内容をすべて削除しますか？',
    deleteCard: '「{name}」を削除しますか？',

    // ログイン関連
    login: 'ログイン',
    logout: 'ログアウト',
    register: '登録',
    email: 'メール',
    password: 'パスワード',
    confirmPassword: 'パスワード確認',
    forgotPassword: 'パスワードを忘れた？',
    resetPassword: 'パスワードリセット',
    sendCode: 'コード送信',
    verificationCode: '認証コード',
    loginTitle: 'ログイン',
    loginSubtitle: 'ログインしてクラウドにデータを同期',
    registerTitle: '登録',
    registerSubtitle: 'アカウントを作成して始める',
    forgotTitle: 'パスワードを忘れた',
    forgotSubtitle: 'メールアドレスを入力して認証コードを受け取る',
    resetTitle: 'パスワードリセット',
    resetSubtitle: '認証コードを {email} に送信しました',
    passwordHint: 'パスワード（6文字以上）',
    newPasswordHint: '新しいパスワード（6文字以上）',
    noAccount: 'アカウントがない？登録',
    hasAccount: 'アカウントをお持ちですか？ログイン',
    backToLogin: 'ログインに戻る',
    resendCode: 'コードを再送信',
    processing: '処理中...',
    passwordMismatch: 'パスワードが一致しません',
    operationFailed: '操作に失敗しました。後でもう一度お試しください',
    networkError: 'ネットワークエラー、後でもう一度お試しください',
    syncData: 'データを同期',

    // メッセージ
    loading: '読み込み中...',
    saving: '保存中...',
    saved: '保存済み',
    error: 'エラー',
    success: '成功',
    confirm: 'OK',
    cancel: 'キャンセル',
    delete: '削除',
    edit: '編集',
    done: '完了',

    // 単語カード
    newFolder: '新規フォルダ',
    rename: '名前変更',
    enterName: '名前を入力',
    folderName: 'フォルダ名',
    wordlistName: '単語リスト名',

    // ヒント
    pleaseLogin: '単語リストを保存するにはログインしてください',
    pleaseLoginUpdate: '単語リストを更新するにはログインしてください',
    noWords: '単語がありません',
    loadingTranslations: '翻訳',
    loadingAudio: 'オーディオ',

    // 進捗表示
    progressTranslation: '翻訳',
    progressAudio: 'オーディオ',

    // エラーメッセージ
    errorNotFound: '翻訳失敗: 単語が見つかりません',
    errorRateLimit: '翻訳失敗: リクエストが多すぎます',
    errorServer: '翻訳失敗: サーバーエラー',
    errorHttp: '翻訳失敗: HTTP {status}',
    errorNetwork: '翻訳失敗: ネットワークエラー',
    errorRequest: '翻訳失敗: リクエストエラー',
    errorAborted: '翻訳失敗: リクエストが中断されました',
    errorTimeout: '翻訳失敗: リクエストタイムアウト',
    errorParse: '翻訳失敗: レスポンス解析エラー',
    errorUnknown: '翻訳失敗: {message}',
    errorInvalidInput: '⚠️ 有効な{lang}を入力してください',
    errorWordNotFoundInYoudao: '有道辞書に単語が見つかりません',
    noTranslation: '翻訳なし',
    errorAudioLoad: 'オーディオ読み込み失敗',
    errorAudioPlay: 'オーディオ再生失敗: {error}',
    errorTts: 'TTSリクエスト失敗: {status}',
    errorTtsLoad: 'TTS読み込み失敗: {error}',
    warnWebSpeech: 'Youdao TTS失敗、Web Speechを試行: {error}',
    warnNoWebSpeech: 'ブラウザはWeb Speech APIをサポートしていません',
    warningInvalidLang: '⚠️ {lang}のみ入力可能です',
    mixedLanguageWarning: '同じ言語で入力してください',

    // 言語名
    langEnglish: '英語',
    langJapanese: '日本語',
    langKorean: '韓国語',
    langFrench: 'フランス語',
    langChinese: '中国語',
    langWord: '単語',

    // ディクテーションモード
    writeWord: '書く: 単語',
    writeDefinition: '書く: 意味',
    wordNum: '単語 #{num}',
    attempts: '試行回数',
    typeWordPlaceholder: '単語を入力',
    dictationComplete: 'ディクテーション完了！',
    score: 'スコア',
    firstTryCorrect: '一発正解',
    multipleTries: '複数回試行',
    failed: '失敗',
    stamp: '採点済',
    shareResult: '結果を共有',
    dictationRecord: 'ディクテーション記録',
    generating: '生成中...',
    copySuccess: 'クリップボードにコピーしました！',
    copyFailed: 'コピー失敗',

    // リピーターモード
    playCount: '再生 {current}/{total}',
    noDefinitions: '定義がありません',
    noExamples: '例文がありません',
    noSynonyms: '同義語/反義語がありません',
    syn: '同',
    ant: '反',
    noWordsProvided: '単語を入力してください',

    // カードの色
    colorOriginal: 'オリジナル',
    colorRed: 'レッドオレンジ',
    colorCyan: 'シアングリーン',
    colorPurple: 'パープルブルー',
    colorPink: 'ピンク',
    colorBlue: 'ブルーシアン',
    colorGreen: 'グリーンシアン',
    colorGold: 'ピンクイエロー',
    colorPastel1: 'ライトシアンピンク',
    colorPastel2: 'ライトピンク',
    colorPastel3: 'ライトパープルピンク',
    colorNavy: 'ゴールドブルー',
    colorLime: 'グリーンイエロー',
    colorSlate: 'グレーブルー'
};
