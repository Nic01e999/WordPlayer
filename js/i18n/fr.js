/**
 * Traductions de l'interface en français
 */
export default {
    // Titre et navigation
    appTitle: 'Lecteur de Mots',
    homeBtn: 'Dictée Anglaise',
    dictation: 'Dictée',
    repeater: 'Répéteur',

    // Paramètres généraux
    general: 'Général',
    shuffle: 'Aléatoire',
    slow: 'Lent',
    target: 'Langue cible',
    translation: 'Traduction',
    interface: 'Interface',
    accent: 'Accent',
    color: 'Couleur',
    mode: 'Mode',

    // Options d'accent
    us: 'US',
    uk: 'UK',

    // Couleurs
    pink: 'Rose',
    green: 'Vert',
    blue: 'Bleu',
    purple: 'Violet',

    // Mode clair/sombre
    light: 'Clair',
    dark: 'Sombre',

    // Paramètres de dictée
    dictationSettings: 'Dictée',
    maxRetry: 'Essais max',
    wordWriteDefListen: 'Mot(écrire):Déf(écouter)',

    // Paramètres du répéteur
    repeaterSettings: 'Répéteur',
    repeat: 'Répéter',
    interval: 'Intervalle(ms)',

    // Liste de mots
    wordList: 'Liste de Mots',
    load: 'Charger',
    save: 'Enregistrer',
    update: 'Mettre à jour',
    wordInputPlaceholder: 'Entrez les mots (séparés par espaces ou retours à la ligne)',
    reloading: 'Rechargement...',
    emptyTitle: 'Aucune liste de mots enregistrée',
    emptyHint: 'Entrez des mots dans la barre latérale et cliquez sur Enregistrer',
    promptName: 'Entrez le nom de la liste:',
    nameExists: 'Le nom "{name}" existe déjà, veuillez utiliser un autre nom',
    folderPromptName: 'Entrez le nom du dossier:',
    folderNameExists: 'Le nom de dossier "{name}" existe déjà, veuillez utiliser un autre nom',
    deleteFolder: 'Supprimer le dossier "{name}" et tout son contenu?',
    deleteCard: 'Supprimer "{name}"?',

    // Connexion
    login: 'Connexion',
    logout: 'Déconnexion',
    register: 'Inscription',
    email: 'Email',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    forgotPassword: 'Mot de passe oublié?',
    resetPassword: 'Réinitialiser le mot de passe',
    sendCode: 'Envoyer le code',
    verificationCode: 'Code de vérification',
    loginTitle: 'Connexion',
    loginSubtitle: 'Connectez-vous pour synchroniser les données vers le cloud',
    registerTitle: 'Inscription',
    registerSubtitle: 'Créez un compte pour commencer',
    forgotTitle: 'Mot de passe oublié',
    forgotSubtitle: 'Entrez votre email pour recevoir le code de vérification',
    resetTitle: 'Réinitialiser le mot de passe',
    resetSubtitle: 'Code de vérification envoyé à {email}',
    passwordHint: 'Mot de passe (au moins 6 caractères)',
    newPasswordHint: 'Nouveau mot de passe (au moins 6 caractères)',
    noAccount: "Pas de compte? Inscrivez-vous",
    hasAccount: 'Déjà un compte? Connexion',
    backToLogin: 'Retour à la connexion',
    resendCode: 'Renvoyer le code',
    processing: 'Traitement...',
    passwordMismatch: 'Les mots de passe ne correspondent pas',
    operationFailed: "L'opération a échoué, veuillez réessayer plus tard",
    networkError: 'Erreur réseau, veuillez réessayer plus tard',
    syncData: 'Synchroniser les données',

    // Messages
    loading: 'Chargement...',
    saving: 'Enregistrement...',
    saved: 'Enregistré',
    error: 'Erreur',
    success: 'Succès',
    confirm: 'OK',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    done: 'Terminé',

    // Cartes de mots
    newFolder: 'Nouveau dossier',
    rename: 'Renommer',
    enterName: 'Entrez le nom',
    folderName: 'Nom du dossier',
    wordlistName: 'Nom de la liste',

    // Conseils
    pleaseLogin: "Veuillez vous connecter d'abord pour enregistrer les listes de mots",
    pleaseLoginUpdate: "Veuillez vous connecter d'abord pour mettre à jour les listes de mots",
    noWords: 'Pas de mots',
    loadingTranslations: 'Traductions',
    loadingAudio: 'Audio',

    // Affichage de la progression
    progressTranslation: 'Traduction',
    progressAudio: 'Audio',

    // Messages d'erreur
    errorNotFound: 'Échec de la traduction: Mot non trouvé',
    errorRateLimit: 'Échec de la traduction: Trop de requêtes',
    errorServer: 'Échec de la traduction: Erreur serveur',
    errorHttp: 'Échec de la traduction: HTTP {status}',
    errorNetwork: 'Échec de la traduction: Erreur réseau',
    errorRequest: 'Échec de la traduction: Erreur de requête',
    errorAborted: 'Échec de la traduction: Requête annulée',
    errorTimeout: 'Échec de la traduction: Délai expiré',
    errorParse: "Échec de la traduction: Erreur d'analyse de la réponse",
    errorUnknown: 'Échec de la traduction: {message}',
    errorInvalidInput: '⚠️ Veuillez entrer un {lang} valide',
    noTranslation: 'Pas de traduction',
    errorAudioLoad: "Échec du chargement de l'audio",
    errorAudioPlay: "Échec de la lecture audio: {error}",
    errorTts: 'Échec de la requête TTS: {status}',
    errorTtsLoad: 'Échec du chargement TTS: {error}',
    warnWebSpeech: 'Échec de Youdao TTS, essai de Web Speech: {error}',
    warnNoWebSpeech: 'Le navigateur ne supporte pas Web Speech API',
    warningInvalidLang: '⚠️ Seul {lang} est autorisé',
    mixedLanguageWarning: 'Veuillez saisir des mots dans la même langue',

    // Noms des langues
    langEnglish: 'anglais',
    langJapanese: 'japonais',
    langKorean: 'coréen',
    langFrench: 'français',
    langChinese: 'chinois',
    langWord: 'mots',

    // Mode dictée
    writeWord: 'Écrire: Mot',
    writeDefinition: 'Écrire: Définition',
    wordNum: 'Mot #{num}',
    attempts: 'Essais',
    typeWordPlaceholder: 'Tapez le mot',
    dictationComplete: 'Dictée terminée!',
    score: 'Score',
    firstTryCorrect: 'Réussi du premier coup',
    multipleTries: 'Plusieurs essais',
    failed: 'Échoué',
    stamp: 'Noté',

    // Mode répéteur
    playCount: 'Lecture {current}/{total}',
    noDefinitions: 'Pas de définitions disponibles',
    noExamples: 'Pas d\'exemples disponibles',
    noSynonyms: 'Pas de synonymes/antonymes disponibles',
    syn: 'Syn',
    ant: 'Ant',
    noWordsProvided: 'Veuillez entrer des mots',

    // Couleurs des cartes
    colorOriginal: 'Original',
    colorRed: 'Rouge-Orange',
    colorCyan: 'Cyan-Vert',
    colorPurple: 'Violet-Bleu',
    colorPink: 'Rose',
    colorBlue: 'Bleu-Cyan',
    colorGreen: 'Vert-Cyan',
    colorGold: 'Rose-Jaune',
    colorPastel1: 'Cyan-Rose clair',
    colorPastel2: 'Rose clair',
    colorPastel3: 'Violet-Rose clair',
    colorNavy: 'Or-Bleu',
    colorLime: 'Vert-Jaune',
    colorSlate: 'Gris-Bleu'
};
