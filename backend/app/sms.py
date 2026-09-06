import re

from twilio.rest import Client

from .settings import settings


def normalize_mobile(value: str) -> str:
    value = value.strip()

    if value.startswith("+"):
        digits = re.sub(r"\D", "", value[1:])
        return "+" + digits

    digits = re.sub(r"\D", "", value)

    if digits.startswith("91") and len(digits) == 12:
        return "+" + digits

    if len(digits) == 10:
        return "+91" + digits

    raise ValueError("Invalid mobile number")


def send_sms(mobile: str, message: str):
    if not settings.twilio_account_sid:
        print(f"[DEV SMS] {mobile}: {message}")
        return

    if not settings.twilio_auth_token:
        raise RuntimeError("TWILIO_AUTH_TOKEN is not configured")

    if not settings.twilio_from_number:
        raise RuntimeError("TWILIO_FROM_NUMBER is not configured")

    to_number = normalize_mobile(mobile)

    client = Client(
        settings.twilio_account_sid,
        settings.twilio_auth_token,
    )

    result = client.messages.create(
        body=message,
        from_=settings.twilio_from_number,
        to=to_number,
    )

    print(
        f"[SMS] OTP dispatched to "
        f"{to_number[:7]}******; "
        f"message_sid={result.sid}; "
        f"status={result.status}"
    )

    return result.sid