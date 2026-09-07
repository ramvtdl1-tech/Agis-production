import requests

from .settings import settings


def send_otp(email: str, code: str):
    if not settings.resend_api_key:
        print(f"[DEV OTP] {email}: {code}")
        return

    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": settings.resend_from,
            "to": [email],
            "subject": "AGIS OTP Verification Code",
            "text": (
                f"Your AGIS verification code is: {code}\n\n"
                "This code expires soon. If you did not request it, "
                "please ignore this email."
            ),
        },
        timeout=15,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Resend email failed: {response.status_code} {response.text}"
        )
