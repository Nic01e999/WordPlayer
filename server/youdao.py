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
