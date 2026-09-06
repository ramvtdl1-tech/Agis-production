import smtplib
from email.message import EmailMessage
from .settings import settings
def send_otp(email,code):
    if not settings.smtp_host:
        print(f"[DEV OTP] {email}: {code}")
        return
    m=EmailMessage();m["Subject"]="AGIS verification code";m["From"]=settings.smtp_from;m["To"]=email
    m.set_content(f"Your AGIS verification code is {code}. It expires in {settings.otp_minutes} minutes.")
    with smtplib.SMTP(settings.smtp_host,settings.smtp_port,timeout=15) as s:
        s.starttls()
        if settings.smtp_username:s.login(settings.smtp_username,settings.smtp_password)
        s.send_message(m)
