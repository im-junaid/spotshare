import logging
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="users.tasks.send_otp_email_task", max_retries=3)
def send_otp_email_task(self, email, otp):
    """
    Background task to send OTP via email.
    Retries up to 3 times if the email server fails.
    """
    subject = "Your Verification Code"
    message = (
        f"Your OTP for login/signup is : {otp}\n This code will expire in 5 minutes."
    )
    email_from = settings.DEFAULT_FROM_EMAIL
    recipient_list = [email]

    try:
        send_mail(subject, message, email_from, recipient_list, fail_silently=False)

        logger.info(f"OTP successfully sent to {email}")
        return f"Email sent to {email}"

    except Exception as exc:
        logger.error(f"Error sending email to {email} : {exc}")

        raise self.retry(exc=exc, countdown=60)
