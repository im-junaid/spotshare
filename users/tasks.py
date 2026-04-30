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


@shared_task(bind=True, name="users.tasks.notify_booking_cancelled_task", max_retries=3)
def notify_booking_cancelled_task(self, booking_id, reason_text):
    """
    Background task to notify driver about a cancelled booking.
    """
    from core.models import Booking

    try:
        booking = Booking.objects.select_related("spot", "driver").get(pk=booking_id)
        driver_email = booking.driver.email
        spot_title = booking.spot.title
        start_time = booking.start_datetime.strftime("%d %b, %Y at %I:%M %p")

        subject = f"Booking Cancelled: {spot_title}"
        message = (
            f"Hello {booking.driver.get_full_name() or 'Driver'},\n\n"
            f"Your booking for '{spot_title}' scheduled for {start_time} has been cancelled.\n"
            f"Reason: {reason_text}\n\n"
            "If you have already paid, a refund will be processed shortly (if applicable).\n\n"
            "Team SpotShare"
        )
        email_from = settings.DEFAULT_FROM_EMAIL
        recipient_list = [driver_email]

        send_mail(subject, message, email_from, recipient_list, fail_silently=False)
        logger.info(f"Cancellation notice sent to {driver_email} for booking {booking_id}")
        return f"Notice sent to {driver_email}"

    except Booking.DoesNotExist:
        logger.error(f"Booking {booking_id} not found for notification.")
    except Exception as exc:
        logger.error(f"Error sending cancellation notice for booking {booking_id}: {exc}")
        raise self.retry(exc=exc, countdown=60)
