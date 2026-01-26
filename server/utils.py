"""
通用工具函数
"""


def strip_markdown_code_blocks(content):
    """
    移除 Markdown 代码块标记（```json 或 ```）

    Args:
        content: 可能包含 markdown 代码块的字符串

    Returns:
        移除代码块标记后的内容
    """
    if not content:
        return content

    content = content.strip()

    if content.startswith("```"):
        lines = content.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]  # 移除开头的 ```json 或 ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]  # 移除结尾的 ```
        content = "\n".join(lines)

    return content


def parse_deepseek_response(response):
    """
    解析 DeepSeek API 响应并提取内容

    Args:
        response: requests.Response 对象

    Returns:
        tuple: (success: bool, content: str, error_message: str)
               如果成功，返回 (True, content, None)
               如果失败，返回 (False, None, error_message)
    """
    if not response.ok:
        return False, None, f"API 错误: {response.status_code}"

    try:
        resp_data = response.json()
    except Exception as e:
        return False, None, f"JSON 解析失败: {str(e)}"

    # 验证 API 响应结构
    choices = resp_data.get("choices")
    if not choices or len(choices) == 0:
        return False, None, "API 返回格式异常"

    message = choices[0].get("message", {})
    content = message.get("content", "")
    if not content:
        return False, None, "API 返回内容为空"

    return True, content.strip(), None


def build_auth_response(user, token):
    """
    构建统一的认证响应格式

    Args:
        user: 用户对象（字典或数据库行对象），需包含 id 和 email 字段
        token: 会话 token

    Returns:
        dict: 标准的认证响应格式
    """
    return {
        'success': True,
        'token': token,
        'user': {
            'id': user['id'],
            'email': user['email']
        }
    }


