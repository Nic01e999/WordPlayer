"""
邮件服务模块
用于发送密码重置验证码
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from config import Config


def send_reset_code(email: str, code: str) -> bool:
    """
    发送密码重置验证码邮件

    Args:
        email: 收件人邮箱
        code: 6位验证码

    Returns:
        bool: 发送成功返回 True，失败返回 False
    """
    import sys

    print(f"\n[Email] 开始发送验证码到 {email}", flush=True)
    print(f"[Email] SMTP_USER 配置: {'已配置' if Config.SMTP_USER else '未配置'}", flush=True)
    print(f"[Email] SMTP_PASSWORD 配置: {'已配置' if Config.SMTP_PASSWORD else '未配置'}", flush=True)

    if not Config.SMTP_USER or not Config.SMTP_PASSWORD:
        # 开发环境：打印验证码到控制台
        print("\n" + "="*60, flush=True)
        print(f"📧 验证码邮件（控制台模式）", flush=True)
        print(f"收件人: {email}", flush=True)
        print(f"验证码: {code}", flush=True)
        print(f"有效期: {Config.CODE_EXPIRE_MINUTES} 分钟", flush=True)
        print("="*60 + "\n", flush=True)
        sys.stdout.flush()
        # 生产环境应该返回 False，这里为了开发方便返回 True
        import os
        if os.environ.get('FLASK_ENV') == 'production':
            print(f"[Email] 生产环境必须配置 SMTP", flush=True)
            return False
        return True

    subject = "English Dictation - 密码重置验证码"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5;">
        <div style="max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="margin: 0 0 20px; color: #333; font-size: 20px;">密码重置验证码</h2>
            <p style="color: #666; margin: 0 0 20px; font-size: 14px;">您正在重置 English Dictation 的密码，验证码如下：</p>
            <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; text-align: center; margin: 0 0 20px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">{code}</span>
            </div>
            <p style="color: #999; font-size: 12px; margin: 0;">验证码 {Config.CODE_EXPIRE_MINUTES} 分钟内有效，请勿泄露给他人。</p>
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = Config.SMTP_SENDER
    msg['To'] = email

    # 添加纯文本和 HTML 版本
    text_content = f"您的验证码是：{code}，{Config.CODE_EXPIRE_MINUTES} 分钟内有效。"
    msg.attach(MIMEText(text_content, 'plain', 'utf-8'))
    msg.attach(MIMEText(html_content, 'html', 'utf-8'))

    try:
        if Config.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(Config.SMTP_HOST, Config.SMTP_PORT)
        else:
            server = smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT)
            server.starttls()

        server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
        server.sendmail(Config.SMTP_SENDER, [email], msg.as_string())
        server.quit()
        print(f"[Email] 验证码已发送到 {email}", flush=True)
        return True
    except Exception as e:
        print(f"[Email] 发送失败: {e}", flush=True)
        # 邮件发送失败时，打印验证码到控制台（开发环境）
        import os
        import sys
        if os.environ.get('FLASK_ENV') != 'production':
            print("\n" + "="*60, flush=True)
            print(f"📧 验证码邮件（控制台模式 - 邮件发送失败）", flush=True)
            print(f"收件人: {email}", flush=True)
            print(f"验证码: {code}", flush=True)
            print(f"有效期: {Config.CODE_EXPIRE_MINUTES} 分钟", flush=True)
            print("="*60 + "\n", flush=True)
            sys.stdout.flush()
            return True  # 返回 True，允许用户使用控制台验证码
        return False
