import math
from decimal import Decimal

from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db.models import Q, Prefetch
from django.utils import timezone
from django.views.decorators.http import require_POST

from core.models import ParkingSpot, SpotImage, Availability, Booking


def driver_home(request):
    """If logged in, go to dashboard. Else redirect to search."""
    if request.user.is_authenticated:
        return my_bookings(request)
    return redirect("driver:search")


def search(request):
    return render(request, "driver/pages/search.html")


def api_nearby_spots(request):
    """Return active parking spots as JSON."""
    spots = (
        ParkingSpot.objects.filter(status="active")
        .select_related("owner")
        .prefetch_related(
            Prefetch(
                "images",
                queryset=SpotImage.objects.order_by("-is_primary", "uploaded_at"),
            ),
            "availabilities",
        )
    )

    vehicle_size = request.GET.get("vehicle_size")
    if vehicle_size and vehicle_size in dict(ParkingSpot.VEHICLE_CHOICES):
        spots = spots.filter(vehicle_size=vehicle_size)

    for flag in ("is_covered", "has_ev_charging", "has_cctv", "has_guard"):
        val = request.GET.get(flag)
        if val == "1":
            spots = spots.filter(**{flag: True})

    q = request.GET.get("q", "").strip()
    if q:
        spots = spots.filter(Q(title__icontains=q) | Q(address__icontains=q))

    lat = request.GET.get("lat")
    lng = request.GET.get("lng")
    radius = float(request.GET.get("radius", 5))

    now = timezone.now()
    current_day = now.weekday()
    
    start_time_str = request.GET.get("start_time")
    end_time_str = request.GET.get("end_time")

    if start_time_str and end_time_str:
        from datetime import datetime, timedelta
        from django.utils import timezone
        try:
            req_start = timezone.make_aware(datetime.fromisoformat(start_time_str))
            req_end = timezone.make_aware(datetime.fromisoformat(end_time_str))
            
            if req_start > now + timedelta(days=7):
                return JsonResponse({"spots": [], "count": 0, "error": "Can only book up to 1 week in advance."})

            if req_start < req_end:
                spots = spots.exclude(
                    bookings__status__in=["confirmed", "active"],
                    bookings__start_datetime__lt=req_end,
                    bookings__end_datetime__gt=req_start
                )
                
                # Check that the spot's availability schedule covers the requested time
                req_day = req_start.weekday()
                spots = spots.filter(
                    availabilities__day_of_week=req_day,
                    availabilities__start_time__lte=req_start.time(),
                    availabilities__end_time__gte=req_end.time()
                ).distinct()
        except ValueError:
            pass

    results = []
    for spot in spots:
        spot_lat = float(spot.latitude)
        spot_lng = float(spot.longitude)

        distance = None
        if lat and lng:
            d_lat = math.radians(spot_lat - float(lat))
            d_lng = math.radians(spot_lng - float(lng))
            a = (
                math.sin(d_lat / 2) ** 2
                + math.cos(math.radians(float(lat)))
                * math.cos(math.radians(spot_lat))
                * math.sin(d_lng / 2) ** 2
            )
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            distance = round(6371 * c, 2)

            if distance > radius:
                continue

        today_avail = [
            {
                "start": a.start_time.strftime("%H:%M"),
                "end": a.end_time.strftime("%H:%M"),
            }
            for a in spot.availabilities.all()
            if a.day_of_week == current_day
        ]

        images = list(spot.images.all())
        primary_img = None
        if images:
            primary = next((i for i in images if i.is_primary), images[0])
            primary_img = primary.image.url if primary else None

        results.append(
            {
                "id": spot.pk,
                "title": spot.title,
                "address": spot.address,
                "lat": spot_lat,
                "lng": spot_lng,
                "vehicle_size": spot.vehicle_size,
                "vehicle_size_display": spot.get_vehicle_size_display(),
                "rate": str(spot.base_rate_per_hour),
                "is_covered": spot.is_covered,
                "has_guard": spot.has_guard,
                "has_cctv": spot.has_cctv,
                "has_ev_charging": spot.has_ev_charging,
                "distance_km": distance,
                "image": primary_img,
                "today_availability": today_avail,
                "instructions": spot.instructions[:120] if spot.instructions else "",
            }
        )

    if lat and lng:
        results.sort(key=lambda s: s["distance_km"] or 999)

    return JsonResponse({"spots": results, "count": len(results)})


# Spot Detail
def spot_detail(request, pk):
    spot = get_object_or_404(
        ParkingSpot.objects.prefetch_related("images", "availabilities"),
        pk=pk,
        status="active",
    )

    # Group availability by day
    avail_by_day = {}
    for a in spot.availabilities.all():
        day_name = a.get_day_of_week_display()
        avail_by_day.setdefault(day_name, []).append(
            f"{a.start_time.strftime('%H:%M')} – {a.end_time.strftime('%H:%M')}"
        )

    context = {
        "spot": spot,
        "images": spot.images.all(),
        "avail_by_day": avail_by_day,
    }
    return render(request, "driver/pages/spot_detail.html", context)


# Create Booking
@login_required
@require_POST
def create_booking(request, pk):
    spot = get_object_or_404(ParkingSpot, pk=pk, status="active")

    start_str = request.POST.get("start_datetime", "")
    end_str = request.POST.get("end_datetime", "")

    if not start_str or not end_str:
        messages.error(request, "Please select both start and end times.")
        return redirect("driver:spot_detail", pk=pk)

    from datetime import datetime, timedelta
    from django.utils import timezone

    try:
        start_dt = timezone.make_aware(datetime.fromisoformat(start_str))
        end_dt = timezone.make_aware(datetime.fromisoformat(end_str))
    except ValueError:
        messages.error(request, "Invalid date/time format.")
        return redirect("driver:spot_detail", pk=pk)

    now = timezone.now()
    if start_dt < now:
        messages.error(request, "Cannot book in the past.")
        return redirect("driver:spot_detail", pk=pk)

    if start_dt > now + timedelta(days=7):
        messages.error(request, "You can only book a spot up to 1 week from now.")
        return redirect("driver:spot_detail", pk=pk)

    if end_dt <= start_dt:
        messages.error(request, "End time must be after start time.")
        return redirect("driver:spot_detail", pk=pk)

    # Check if spot is actually available during this time
    is_available = spot.availabilities.filter(
        day_of_week=start_dt.weekday(),
        start_time__lte=start_dt.time(),
        end_time__gte=end_dt.time()
    ).exists()
    
    if not is_available:
        messages.error(request, "The spot is not available during this time slot.")
        return redirect("driver:spot_detail", pk=pk)

    # Calculate price
    hours = Decimal(str((end_dt - start_dt).total_seconds() / 3600))
    final_price = (hours * spot.base_rate_per_hour).quantize(Decimal("0.01"))

    # Check for overlapping bookings
    overlap = Booking.objects.filter(
        spot=spot,
        status__in=["confirmed", "active"],
        start_datetime__lt=end_dt,
        end_datetime__gt=start_dt,
    ).exists()

    if overlap:
        messages.error(request, "This time slot is already booked.")
        return redirect("driver:spot_detail", pk=pk)

    booking = Booking.objects.create(
        spot=spot,
        driver=request.user,
        start_datetime=start_dt,
        end_datetime=end_dt,
        final_price=final_price,
        status="confirmed",
    )

    messages.success(
        request,
        f"Booking confirmed for {spot.title}! Total: ₹{final_price}",
    )
    return redirect("driver:home")


# Driver Bookings Dashboard
@login_required
def my_bookings(request):
    """Driver dashboard showing active, upcoming, and past bookings."""
    now = timezone.now()
    user_bookings = Booking.objects.filter(driver=request.user).select_related("spot")

    # Current parking session or pending arrival (starts now or soon)
    active = user_bookings.filter(
        status__in=["confirmed", "active"],
        start_datetime__lte=now,
        end_datetime__gte=now,
    ).order_by("start_datetime")
    
    upcoming = user_bookings.filter(
        status="confirmed",
        start_datetime__gt=now,
    ).order_by("start_datetime")
    
    past = user_bookings.filter(
        status__in=["completed", "cancelled", "no_show"],
    ).order_by("-start_datetime")[:10]

    context = {
        "active_bookings": active,
        "upcoming_bookings": upcoming,
        "past_bookings": past,
        "now": now,
    }
    return render(request, "driver/pages/my_bookings.html", context)


@login_required
def booking_detail(request, pk):
    """Detailed view for a specific driver booking, showing OTP when revealable."""
    booking = get_object_or_404(Booking.objects.select_related("spot"), pk=pk, driver=request.user)
    
    context = {
        "booking": booking,
        "now": timezone.now(),
    }
    return render(request, "driver/pages/booking_detail.html", context)


# Cancel booking
@login_required
@require_POST
def cancel_booking(request, pk):
    booking = get_object_or_404(Booking, pk=pk, driver=request.user)

    if booking.status not in ("pending", "confirmed"):
        messages.error(request, "This booking cannot be cancelled.")
        return redirect("driver:my_bookings")

    booking.status = "cancelled"
    booking.cancelled_reason = "driver_cancelled"
    booking.save(update_fields=["status", "cancelled_reason", "updated_at"])
    messages.success(request, "Booking cancelled successfully.")
    return redirect("driver:home")
