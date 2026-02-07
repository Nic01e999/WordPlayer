"""
邮件服务模块
用于发送密码重置验证码
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from config import Config


# 四语言邮件文本
EMAIL_TEXTS = {
    'zh': {
        'subject': 'WordPlayer - 密码重置验证码',
        'title': '密码重置验证码',
        'body': '您正在重置 WordPlayer 的密码，验证码如下：',
        'note': '验证码 {minutes} 分钟内有效，请勿泄露给他人。',
        'sent': '发送时间',
        'valid_until': '有效期至'
    },
    'en': {
        'subject': 'WordPlayer - Password Reset Verification Code',
        'title': 'Password Reset Verification Code',
        'body': 'You are resetting your WordPlayer password. The verification code is as follows:',
        'note': 'The verification code is valid for {minutes} minutes. Do not disclose it to others.',
        'sent': 'Sent',
        'valid_until': 'Valid until'
    },
    'ja': {
        'subject': 'WordPlayer - パスワードリセット認証コード',
        'title': 'パスワードリセット認証コード',
        'body': 'WordPlayerのパスワードをリセットしています。認証コードは以下の通りです：',
        'note': '認証コードは{minutes}分間有効です。他の人に漏らさないでください。',
        'sent': '送信時刻',
        'valid_until': '有効期限'
    },
    'ko': {
        'subject': 'WordPlayer - 비밀번호 재설정 인증 코드',
        'title': '비밀번호 재설정 인증 코드',
        'body': 'WordPlayer 비밀번호를 재설정하고 있습니다. 인증 코드는 다음과 같습니다:',
        'note': '인증 코드는 {minutes}분 동안 유효합니다. 다른 사람에게 공개하지 마십시오.',
        'sent': '발송 시간',
        'valid_until': '유효 기간'
    }
}


def send_reset_code(email: str, code: str, lang: str = 'en') -> bool:
    """
    发送密码重置验证码邮件

    Args:
        email: 收件人邮箱
        code: 6位验证码
        lang: 语言代码 (zh, en, ja, ko)

    Returns:
        bool: 发送成功返回 True，失败返回 False
    """
    import sys
    from datetime import datetime

    print(f"\n[Email] 开始发送验证码到 {email}", flush=True)
    print(f"[Email] SMTP_USER 配置: {'已配置' if Config.SMTP_USER else '未配置'}", flush=True)
    print(f"[Email] SMTP_PASSWORD 配置: {'已配置' if Config.SMTP_PASSWORD else '未配置'}", flush=True)
    print(f"[Email] 验证码: {code}", flush=True)

    # 生成时间戳，降低邮件重复率
    now = datetime.now()
    send_time = now.strftime("%Y-%m-%d %H:%M:%S")
    expire_time = (now.replace(second=0, microsecond=0)).strftime("%H:%M")
    # 计算过期时间
    expire_minutes = now.minute + Config.CODE_EXPIRE_MINUTES
    expire_hour = now.hour
    if expire_minutes >= 60:
        expire_minutes -= 60
        expire_hour += 1
    expire_time = f"{expire_hour:02d}:{expire_minutes:02d}"

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

    # 获取语言文本，默认英文
    texts = EMAIL_TEXTS.get(lang, EMAIL_TEXTS['en'])

    subject = texts['subject']
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5;">
        <div style="max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="margin: 0 0 20px; color: #333; font-size: 20px;">{texts['title']}</h2>
            <p style="color: #666; margin: 0 0 20px; font-size: 14px;">{texts['body']}</p>
            <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; text-align: center; margin: 0 0 20px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">{code}</span>
            </div>
            <p style="color: #999; font-size: 12px; margin: 0 0 10px;">{texts['note'].format(minutes=Config.CODE_EXPIRE_MINUTES)}</p>
            <div style="border-top: 1px solid #eee; padding-top: 15px; margin-top: 15px;">
                <p style="color: #bbb; font-size: 11px; margin: 0 0 5px;">📅 {texts['sent']}: {send_time}</p>
                <p style="color: #bbb; font-size: 11px; margin: 0;">⏰ {texts['valid_until']}: {expire_time}</p>
            </div>
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    # 使用标准的发件人格式：发件人名称 <邮箱>
    msg['From'] = f"WordPlayer <{Config.SMTP_SENDER}>"
    msg['To'] = email

    # 添加纯文本和 HTML 版本
    text_content = f"{texts['body']} {code}\n{texts['note'].format(minutes=Config.CODE_EXPIRE_MINUTES)}\n{texts['sent']}: {send_time}\n{texts['valid_until']}: {expire_time}"
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
