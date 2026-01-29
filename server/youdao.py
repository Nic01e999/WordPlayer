"""
有道词典 API - 多语言翻译服务
支持语言对: 英日韩法中 互译
"""

import requests
from flask import Blueprint, request, jsonify
from constants import DICT_FIELDS, YOUDAO_LANG_CODES, SUPPORTED_LANGS
from validators import validate_language_pair

youdao_bp = Blueprint('youdao', __name__)


def _parse_definitions(dict_data):
    """解析有道词典返回的释义数据（支持多种格式）"""
    definitions = []

    if not dict_data:
        return definitions

    words = dict_data.get('word', [])
    if not words:
        return definitions

    # words 可能是 list 或 dict
    if isinstance(words, list):
        word_data = words[0] if words else {}
    else:
        word_data = words

    # 格式1: 英语词典格式 - word[].trs[].pos/tran
    trs = word_data.get('trs', [])
    if trs:
        for tr_item in trs:
            pos = tr_item.get('pos', '')
            meanings = []

            # 直接 tran 字段 (常见)
            tran = tr_item.get('tran', '')
            if tran:
                meanings.append(tran)

            # 嵌套 tr -> l -> i 结构 (旧版)
            tr_list = tr_item.get('tr', [])
            for tr in tr_list:
                l_data = tr.get('l', {})
                i_list = l_data.get('i', [])
                for item in i_list:
                    if isinstance(item, str):
                        if not pos and '. ' in item:
                            parts = item.split('. ', 1)
                            if len(parts) == 2:
                                pos = parts[0] + '.'
                                meanings.append(parts[1])
                            else:
                                meanings.append(item)
                        else:
                            meanings.append(item)

            if meanings:
                definitions.append({
                    'pos': pos,
                    'meanings': meanings
                })
        return definitions

    # 格式2: 日/韩/法语词典格式 - word.sense[].cx/phrList[].jmsy
    senses = word_data.get('sense', [])
    if senses:
        for sense in senses:
            pos = sense.get('cx', '')  # 词性 (名词·形容动词 等)
            meanings = []

            phr_list = sense.get('phrList', [])
            for phr in phr_list:
                jmsy = phr.get('jmsy', '')  # 中文释义
                if jmsy:
                    meanings.append(jmsy)

            if meanings:
                definitions.append({
                    'pos': pos,
                    'meanings': meanings
                })

    return definitions


def _get_phonetic(dict_data):
    """获取音标/读音"""
    if not dict_data:
        return None

    words = dict_data.get('word', [])
    if not words:
        return None

    # words 可能是 list 或 dict
    if isinstance(words, list):
        word_data = words[0] if words else {}
    else:
        word_data = words

    # 英语有 usphone/ukphone
    us = word_data.get('usphone', '')
    uk = word_data.get('ukphone', '')
    if us or uk:
        return {'us': us, 'uk': uk}

    # 日语有 head.pjm (假名读音)
    head = word_data.get('head', {})
    if head:
        pjm = head.get('pjm', '')  # 平假名
        tone = head.get('tone', '')  # 声调
        if pjm:
            return f"{pjm}" + (f" {tone}" if tone else "")

    # 其他语言用 phone
    phone = word_data.get('phone', '')
    if phone:
        return phone

    return None


def _extract_examples(data, max_count=2):
    """
    从有道 API 提取例句
    优先级：blng_sents_part > auth_sents_part > media_sents_part

    返回格式：
    {
        "common": ["例句1 | 翻译1", "例句2 | 翻译2"],
        "fun": []  # 有道没有 fun 类型，保持空数组兼容
    }
    """
    examples = {"common": [], "fun": []}

    try:
        # 定义优先级顺序
        priority_keys = ['blng_sents_part', 'auth_sents_part', 'media_sents_part']

        for key in priority_keys:
            if key in data and 'sentence-pair' in data[key]:
                sentence_pairs = data[key]['sentence-pair']

                for pair in sentence_pairs:
                    if len(examples["common"]) >= max_count:
                        break

                    # 提取例句和翻译
                    sentence = pair.get('sentence', '').strip()
                    translation = pair.get('sentence-translation', '').strip()

                    if sentence and translation:
                        # 格式化为 "sentence | translation"
                        example = f"{sentence} | {translation}"
                        examples["common"].append(example)

                # 如果已经收集到足够的例句，停止
                if len(examples["common"]) >= max_count:
                    break

        print(f"[有道API] 提取到 {len(examples['common'])} 条例句")

    except Exception as e:
        print(f"[有道API] 提取例句时出错: {str(e)}")

    return examples


def _extract_synonyms(data, max_count=5):
    """
    从有道 API 提取同义词

    返回格式：["word1", "word2", ...]（最多5个）
    """
    synonyms = []

    try:
        # 从 syno.synos[] 提取同义词
        if 'syno' in data and 'synos' in data['syno']:
            synos = data['syno']['synos']

            for syno_group in synos:
                if len(synonyms) >= max_count:
                    break

                # 提取 ws[] 数组中的单词
                if 'ws' in syno_group:
                    words = syno_group['ws']
                    for word in words:
                        if len(synonyms) >= max_count:
                            break
                        if word and word not in synonyms:
                            synonyms.append(word)

        print(f"[有道API] 提取到 {len(synonyms)} 个同义词")

    except Exception as e:
        print(f"[有道API] 提取同义词时出错: {str(e)}")

    return synonyms


def _extract_word_forms(data):
    """
    从有道 API 提取词形变化（时态）

    返回格式：
    {
        "第三人称单数": "goes",
        "现在分词": "going",
        "过去式": "went",
        "过去分词": "gone"
    }
    """
    word_forms = {}

    try:
        # 从 ec.word[0].wfs[] 提取
        if 'ec' in data and 'word' in data['ec']:
            words = data['ec']['word']

            # words 可能是 list 或 dict
            if isinstance(words, list):
                word_data = words[0] if words else {}
            else:
                word_data = words

            # 提取 wfs 数组
            if 'wfs' in word_data:
                wfs = word_data['wfs']
                for wf in wfs:
                    name = wf.get('wf', {}).get('name', '')
                    value = wf.get('wf', {}).get('value', '')
                    if name and value:
                        word_forms[name] = value

        print(f"[有道API] 提取到 {len(word_forms)} 个词形变化")

    except Exception as e:
        print(f"[有道API] 提取词形变化时出错: {str(e)}")

    return word_forms


def _fetch_youdao_dict(word, from_lang, to_lang):
    """
    调用有道词典 API 获取翻译
    返回: { translation, definitions, phonetic }
    """
    # 构建请求URL
    le_code = YOUDAO_LANG_CODES.get(from_lang, from_lang)
    url = f"http://dict.youdao.com/jsonapi_s?doctype=json&jsonversion=4&le={le_code}&q={requests.utils.quote(word)}"

    try:
        response = requests.get(url, timeout=10)
        if not response.ok:
            return None

        data = response.json()
    except Exception as e:
        print(f"有道词典请求失败: {e}")
        return None

    # 获取词典字段
    dict_field = DICT_FIELDS.get((from_lang, to_lang))

    # 尝试多个可能的字段名 (优先使用 new* 版本，因为原版可能是 $ref)
    dict_data = None
    if dict_field:
        # 先尝试 new* 版本
        dict_data = data.get(f'new{dict_field}')
        # 再尝试原版，但跳过 $ref 引用
        if not dict_data:
            orig = data.get(dict_field)
            if orig and '$ref' not in orig:
                dict_data = orig

    # 如果没有直接的语言对，尝试通过中文中转
    if not dict_data and to_lang != 'zh' and from_lang != 'zh':
        # 先查 from_lang -> zh
        zh_field = DICT_FIELDS.get((from_lang, 'zh'))
        if zh_field:
            dict_data = data.get(zh_field) or data.get(f'new{zh_field}')

    # 解析结果
    result = {
        'word': word,
        'fromLang': from_lang,
        'toLang': to_lang,
        'translation': None,
        'definitions': [],
        'phonetic': None
    }

    if dict_data:
        result['definitions'] = _parse_definitions(dict_data)
        result['phonetic'] = _get_phonetic(dict_data)

        # 提取主翻译（第一个释义的第一个含义）
        if result['definitions']:
            first_def = result['definitions'][0]
            if first_def.get('meanings'):
                result['translation'] = first_def['meanings'][0]

    # 尝试从 web_trans 获取翻译（如果没有词典数据）
    if not result['translation']:
        web_trans = data.get('web_trans', {})
        translations = web_trans.get('web-translation', [])
        if translations:
            first_trans = translations[0].get('trans', [])
            if first_trans:
                result['translation'] = first_trans[0].get('value', '')

    return result


@youdao_bp.route("/api/youdao/translate", methods=["GET"])
def translate():
    """
    获取单词翻译
    GET /api/youdao/translate?word=apple&from=en&to=zh
    返回: { word, translation, definitions, phonetic }
    """
    word = request.args.get("word", "").strip()
    from_lang = request.args.get("from", "en")
    to_lang = request.args.get("to", "zh")

    if not word:
        return jsonify({"error": "缺少 word 参数"}), 400

    # 验证语言代码
    is_valid, error_msg = validate_language_pair(from_lang, to_lang)
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    result = _fetch_youdao_dict(word, from_lang, to_lang)

    if result is None:
        return jsonify({"error": "翻译请求失败"}), 500

    return jsonify(result)


@youdao_bp.route("/api/youdao/batch", methods=["POST"])
def translate_batch():
    """
    批量翻译单词
    POST /api/youdao/batch
    Body: { words: ["apple", "happy"], from: "en", to: "zh" }
    返回: { results: { word: { translation, definitions, phonetic } } }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "缺少请求体"}), 400

    words = data.get("words", [])
    from_lang = data.get("from", "en")
    to_lang = data.get("to", "zh")

    if not words:
        return jsonify({"error": "缺少 words 参数"}), 400

    # 验证语言代码
    is_valid, error_msg = validate_language_pair(from_lang, to_lang)
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    results = {}
    for word in words:
        word = word.strip()
        if word:
            result = _fetch_youdao_dict(word, from_lang, to_lang)
            if result:
                results[word] = result

    return jsonify({"results": results})


def validate_words_batch(words, from_lang, to_lang):
    """
    批量验证单词是否存在于有道词典中

    Args:
        words: 单词列表
        from_lang: 源语言
        to_lang: 目标语言

    Returns:
        {"valid": [有效单词列表], "invalid": [无效单词列表]}
    """
    valid = []
    invalid = []

    for word in words:
        try:
            result = _fetch_youdao_dict(word, from_lang, to_lang)
            # 更严格的判断标准：必须有词典数据（definitions 或 phonetic），不能只有网络翻译
            if result and (result.get('definitions') or result.get('phonetic')):
                valid.append(word)
                print(f"[有道验证] 单词 '{word}' 验证通过")
            else:
                invalid.append(word)
                print(f"[有道验证] 单词 '{word}' 验证失败：未找到词典数据")
        except Exception as e:
            invalid.append(word)
            print(f"[有道验证] 单词 '{word}' 验证失败：{str(e)}")

    print(f"[有道验证] 批量验证完成 - 有效: {len(valid)}, 无效: {len(invalid)}")
    return {"valid": valid, "invalid": invalid}


def get_word_complete_info(word, from_lang, to_lang):
    """
    获取单词的完整信息（替代 DeepSeek）

    返回格式：
    {
        "word": "happy",
        "phonetic": "ˈhæpi",
        "translation": "快乐的",
        "nativeDefinitions": [{"pos": "adj.", "meanings": ["快乐的"]}],
        "targetDefinitions": [{"pos": "adj.", "meanings": ["happy"]}],
        "examples": {"common": ["例句1", "例句2"], "fun": []},
        "synonyms": ["glad", "pleased"],
        "antonyms": [],  # 始终为空
        "wordForms": {"比较级": "happier", "最高级": "happiest"}
    }
    """
    print(f"[有道API] 获取单词完整信息: {word} ({from_lang} -> {to_lang})")

    try:
        # 1. 调用有道 API 获取完整 JSON
        le_code = YOUDAO_LANG_CODES.get(from_lang, from_lang)
        url = f"http://dict.youdao.com/jsonapi_s?doctype=json&jsonversion=4&le={le_code}&q={requests.utils.quote(word)}"

        response = requests.get(url, timeout=10)
        if not response.ok:
            print(f"[有道API] 请求失败: HTTP {response.status_code}")
            return {"error": "word_not_found"}

        data = response.json()

        # 2. 使用 _fetch_youdao_dict 获取基本信息（翻译、释义、音标）
        basic_info = _fetch_youdao_dict(word, from_lang, to_lang)

        if not basic_info:
            print(f"[有道API] 单词 '{word}' 未找到基本信息")
            return {"error": "word_not_found"}

        # 3. 提取音标、翻译、释义
        phonetic = basic_info.get('phonetic')
        translation = basic_info.get('translation')
        native_definitions = basic_info.get('definitions', [])

        # 4. 提取目标语言释义（英文释义）
        target_definitions = []
        if 'ee' in data:
            target_definitions = _parse_definitions(data['ee'])

        # 5. 调用新函数提取例句、同义词、词形变化
        examples = _extract_examples(data)
        synonyms = _extract_synonyms(data)
        word_forms = _extract_word_forms(data)

        # 6. 检查是否有有效数据
        has_data = (phonetic or translation or native_definitions or
                   target_definitions or examples["common"] or synonyms or word_forms)

        if not has_data:
            print(f"[有道API] 单词 '{word}' 未找到有效数据")
            return {"error": "word_not_found"}

        # 7. 构建返回结果
        result = {
            "word": word,
            "phonetic": phonetic,
            "translation": translation,
            "nativeDefinitions": native_definitions,
            "targetDefinitions": target_definitions,
            "examples": examples,
            "synonyms": synonyms,
            "antonyms": [],  # 有道 API 没有反义词，固定返回空数组
            "wordForms": word_forms
        }

        print(f"[有道API] 成功获取单词 '{word}' 的完整信息")
        return result

    except Exception as e:
        print(f"[有道API] 获取单词 '{word}' 完整信息时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": "word_not_found"}
