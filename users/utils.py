from django.core.cache import cache
import random
import json
import re

from .tasks import send_otp_email_task

# TODO: ADD LATER TRUSTED EMAILS
# List of valid Email Providers
TRUSTED_PROVIDERS = [
    "gmail.com",
    "outlook.com",
    "hotmail.com",
    "yahoo.com",
    "icloud.com",
    "proton.me",
    "zoho.com",
]


def is_trusted_email(email):
    """
    Check the Email ID is Trustable,
    Only Allow Trusted Email provider
    """
    domain = email.split("@")[-1].lower()
    return domain in TRUSTED_PROVIDERS


EMAIL_REGEX = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"


def is_valid_email(email):
    """
    Check the Email ID is Valid.
    alphanumeric, dots, underscores, pluses, and hyphens,
    plus a domain with at least one dot and a 2+ letter.
    """
    return re.fullmatch(EMAIL_REGEX, email) is not None


class OTPHandler:
    """
    Handles OTP generation, storage in Redis, and triggering Celery tasks.
    """

    @staticmethod
    def generate_otp():
        return str(random.randint(100000, 999999))

    @classmethod
    def check_rate_limit(cls, email):
        import time

        history_key = f"otp_history_{email}"
        history = cache.get(history_key, [])
        now = time.time()

        # Remove timestamps older than 1 hour (3600s)
        history = [ts for ts in history if now - ts < 3600]

        count = len(history)

        if count >= 4:
            # 4th OTP wait 30 min to next OTP generation (Requesting 5th)
            # But user also said "use max 4 otp".
            # Let's interpret "max 4 otp" as the hard limit for the hour.
            # And "4th otp wait 30 min" as the wait after the 4th one.
            wait = 1800 - (now - history[-1])
            if wait > 0:
                return (
                    False,
                    f"Maximum 4 OTPs reached. Please wait {int(wait//60)} minutes.",
                )
            return False, "Maximum 4 OTPs per hour reached."

        if count == 1:
            # 1st OTP was sent, now requesting 2nd. Wait 30s.
            wait = 30 - (now - history[-1])
            if wait > 0:
                return (
                    False,
                    f"Please wait {int(wait)} seconds before requesting another OTP.",
                )
        elif count == 2:
            # 2nd OTP was sent, now requesting 3rd. Wait 1m.
            wait = 60 - (now - history[-1])
            if wait > 0:
                return (
                    False,
                    f"Please wait {int(wait)} seconds before requesting another OTP.",
                )
        elif count == 3:
            # 3rd OTP was sent, now requesting 4th. Wait 5m.
            wait = 300 - (now - history[-1])
            if wait > 0:
                return (
                    False,
                    f"Please wait {int(wait//60)} minutes before requesting another OTP.",
                )

        return True, ""

    @classmethod
    def record_otp_request(cls, email):
        import time

        history_key = f"otp_history_{email}"
        history = cache.get(history_key, [])
        now = time.time()
        history = [ts for ts in history if now - ts < 3600]
        history.append(now)
        cache.set(history_key, history, timeout=3600)

    @classmethod
    def send_and_store_otp(cls, email, purpose="login", signup_data=None):
        """
        1. Generates OTP.
        2. Stores it in Redis (with extra data if signup).
        3. Dispatches Celery task to send email.
        """
        otp = cls.generate_otp()

        otp_key = f"otp_{email}"
        data_key = f"signup_data_{email}"

        # Store OTP in REDIS (EXP : 5min)
        cache.set(otp_key, otp, timeout=300)

        # If signup, store data(name, phone) (EXP: 10min)
        if purpose == "signup" and signup_data:
            cache.set(data_key, json.dumps(signup_data), timeout=600)

        # Record generation for rate limiting
        cls.record_otp_request(email)

        send_otp_email_task.delay(email, otp)

        return otp

    @staticmethod
    def verify_otp(email, user_otp):
        """Checks if the provided OTP matches the one in Redis."""
        stored_otp = cache.get(f"otp_{email}")

        if stored_otp and str(stored_otp) == str(user_otp):
            return True
        return False

    @staticmethod
    def get_signup_data(email):
        """Retrieves temporary signup data from Redis."""
        data = cache.get(f"signup_data_{email}")
        return json.loads(data) if data else None

    @staticmethod
    def clear_data(email):
        """Cleans up Redis after successful verification"""
        cache.delete(f"otp_{email}")
        cache.delete(f"signup_data_{email}")
