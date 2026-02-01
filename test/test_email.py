#!/usr/bin/env python3
"""
测试邮件发送功能
"""

import sys
import os

# 添加 server 目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from email_service import send_reset_code

def test_email():
    """测试发送邮件到指定地址"""
    test_email = "nicole.long@harrowshenzhen.cn"
    test_code = "123456"

    print(f"正在发送测试邮件到: {test_email}")
    print(f"测试验证码: {test_code}")
    print("-" * 50)

    result = send_reset_code(test_email, test_code)

    print("-" * 50)
    if result:
        print("✅ 邮件发送成功！")
        print(f"请检查 {test_email} 的收件箱（包括垃圾邮件箱）")
    else:
        print("❌ 邮件发送失败！")
        print("请检查 .env 文件中的 SMTP 配置")

    return result

if __name__ == "__main__":
    test_email()
