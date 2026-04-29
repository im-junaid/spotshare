import random
import string

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone


class ParkingSpot(models.Model):
    """A parking spot listed by a host."""

    VEHICLE_CHOICES = [
        ("motorcycle", "Motorcycle"),
        ("hatchback", "Hatchback"),
        ("sedan", "Sedan"),
        ("suv", "SUV"),
        ("large", "Oversized / Truck"),
    ]
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="parking_spots",
    )
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=300)

    # Coordinates — stored as decimals for now
    # Can upgrade to PostGIS PointField later
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)

    vehicle_size = models.CharField(max_length=20, choices=VEHICLE_CHOICES)
    base_rate_per_hour = models.DecimalField(max_digits=8, decimal_places=2)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    is_covered = models.BooleanField(default=False)
    has_guard = models.BooleanField(default=False)
    has_cctv = models.BooleanField(default=False)
    has_ev_charging = models.BooleanField(default=False)

    instructions = models.TextField(
        blank=True, help_text="Access instructions for the driver"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} — {self.owner.email}"

    @property
    def primary_image(self):
        """Return the primary image or first image."""
        return self.images.filter(is_primary=True).first() or self.images.first()

    @property
    def image_count(self):
        return self.images.count()


class SpotImage(models.Model):
    """Images for a parking spot. Minimum 4 per spot."""

    spot = models.ForeignKey(
        ParkingSpot,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = models.ImageField(upload_to="spots/%Y/%m/")
    is_primary = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_primary", "uploaded_at"]

    def __str__(self):
        return f"Image for {self.spot.title}"


class Availability(models.Model):
    """Time blocks when a parking spot is available."""

    WEEKDAYS = [
        (0, "Monday"),
        (1, "Tuesday"),
        (2, "Wednesday"),
        (3, "Thursday"),
        (4, "Friday"),
        (5, "Saturday"),
        (6, "Sunday"),
    ]

    spot = models.ForeignKey(
        ParkingSpot,
        on_delete=models.CASCADE,
        related_name="availabilities",
    )
    day_of_week = models.IntegerField(choices=WEEKDAYS)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        verbose_name_plural = "Availabilities"
        ordering = ["day_of_week", "start_time"]
        unique_together = ["spot", "day_of_week", "start_time", "end_time"]

    def clean(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValidationError("End time must be after start time.")

    def __str__(self):
        return f"{self.get_day_of_week_display()} {self.start_time}–{self.end_time}"


class Booking(models.Model):
    """A booking made by a driver for a parking spot."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("active", "Active"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
        ("no_show", "No Show"),
    ]

    spot = models.ForeignKey(
        ParkingSpot, on_delete=models.CASCADE, related_name="bookings"
    )
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    final_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    # OTP verification
    otp = models.CharField(max_length=6, blank=True)
    otp_verified_at = models.DateTimeField(null=True, blank=True)
    cancelled_reason = models.CharField(
        max_length=50,
        blank=True,
        help_text="no_show, driver_cancelled, host_cancelled",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_datetime"]

    def __str__(self):
        return f"Booking #{self.pk} — {self.spot.title}"

    def save(self, *args, **kwargs):
        # Auto-generate a 6-digit OTP on first save
        if not self.otp:
            self.otp = "".join(random.choices(string.digits, k=6))
        super().save(*args, **kwargs)

    # --- Helper properties ---

    @property
    def is_otp_revealable(self):
        """Driver can only see OTP during the booking time window."""
        now = timezone.now()
        return (
            self.status == "confirmed"
            and self.start_datetime <= now <= self.end_datetime
        )

    @property
    def is_past_grace_period(self):
        """True if 5+ minutes past start time and OTP hasn't been verified."""
        from datetime import timedelta

        now = timezone.now()
        grace_end = self.start_datetime + timedelta(minutes=5)
        return (
            self.status == "confirmed"
            and now > grace_end
            and self.otp_verified_at is None
        )

    @property
    def google_maps_url(self):
        """Google Maps navigation URL for the spot."""
        lat = self.spot.latitude
        lng = self.spot.longitude
        return f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"

