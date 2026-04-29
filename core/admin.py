from django.contrib import admin
from .models import ParkingSpot, SpotImage, Availability, Booking


class SpotImageInline(admin.TabularInline):
    model = SpotImage
    extra = 1


class AvailabilityInline(admin.TabularInline):
    model = Availability
    extra = 1


@admin.register(ParkingSpot)
class ParkingSpotAdmin(admin.ModelAdmin):
    list_display = ["title", "owner", "status", "base_rate_per_hour", "vehicle_size", "created_at"]
    list_filter = ["status", "vehicle_size", "is_covered"]
    search_fields = ["title", "address", "owner__email"]
    inlines = [SpotImageInline, AvailabilityInline]


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = [
        "id", "spot", "driver", "status", "otp",
        "otp_verified_at", "final_price", "start_datetime", "end_datetime",
    ]
    list_filter = ["status"]
    search_fields = ["spot__title", "driver__email", "otp"]
    readonly_fields = ["otp"]

