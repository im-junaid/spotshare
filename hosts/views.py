from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.views.decorators.http import require_POST

from core.models import ParkingSpot, Booking
from .forms import ParkingSpotForm, SpotImageFormSet, AvailabilityFormSet
from .decorators import host_required


@host_required
def dashboard(request):
    """
    Host dashboard showing:
    - Total earnings from completed bookings
    - Currently active parkers
    - All listed spots with their status
    """
    user_spots = ParkingSpot.objects.filter(owner=request.user).prefetch_related("images")

    # Earnings from completed bookings
    total_earnings = (
        Booking.objects.filter(
            spot__owner=request.user,
            status="completed",
        ).aggregate(total=Sum("final_price"))["total"]
        or 0
    )

    # Pending earnings (confirmed but not yet completed)
    pending_earnings = (
        Booking.objects.filter(
            spot__owner=request.user,
            status__in=["confirmed", "active"],
        ).aggregate(total=Sum("final_price"))["total"]
        or 0
    )

    # Active parkers right now
    now = timezone.now()
    active_bookings = Booking.objects.filter(
        spot__owner=request.user,
        status="active",
        start_datetime__lte=now,
        end_datetime__gte=now,
    ).select_related("spot", "driver")

    # Upcoming bookings
    upcoming_bookings = Booking.objects.filter(
        spot__owner=request.user,
        status="confirmed",
        start_datetime__gt=now,
    ).select_related("spot", "driver").order_by("start_datetime")[:5]

    # Recent completed bookings
    recent_bookings = Booking.objects.filter(
        spot__owner=request.user,
        status="completed",
    ).select_related("spot", "driver").order_by("-end_datetime")[:5]

    # Spot stats
    total_spots = user_spots.count()
    active_spots = user_spots.filter(status="active").count()
    total_bookings = Booking.objects.filter(spot__owner=request.user).count()

    context = {
        "spots": user_spots,
        "total_earnings": total_earnings,
        "pending_earnings": pending_earnings,
        "active_bookings": active_bookings,
        "active_parkers_count": active_bookings.count(),
        "upcoming_bookings": upcoming_bookings,
        "recent_bookings": recent_bookings,
        "total_spots": total_spots,
        "active_spots": active_spots,
        "total_bookings": total_bookings,
    }
    return render(request, "hosts/pages/dashboard.html", context)


@host_required
def create_spot(request):
    """Create a new parking spot with images."""
    if request.method == "POST":
        form = ParkingSpotForm(request.POST)
        image_formset = SpotImageFormSet(request.POST, request.FILES)

        if form.is_valid() and image_formset.is_valid():
            spot = form.save(commit=False)
            spot.owner = request.user
            spot.save()

            # Save images linked to the spot
            image_formset.instance = spot
            image_formset.save()

            messages.success(request, f'Spot "{spot.title}" created successfully!')
            return redirect("hosts:manage_availability", pk=spot.pk)
        else:
            messages.error(request, "Please fix the errors below.")
    else:
        form = ParkingSpotForm()
        image_formset = SpotImageFormSet()

    context = {
        "form": form,
        "image_formset": image_formset,
        "is_edit": False,
    }
    return render(request, "hosts/pages/spot_form.html", context)


@host_required
def edit_spot(request, pk):
    """Edit an existing parking spot and its images."""
    spot = get_object_or_404(ParkingSpot, pk=pk, owner=request.user)

    if request.method == "POST":
        form = ParkingSpotForm(request.POST, instance=spot)
        image_formset = SpotImageFormSet(request.POST, request.FILES, instance=spot)

        if form.is_valid() and image_formset.is_valid():
            form.save()
            image_formset.save()
            messages.success(request, f'Spot "{spot.title}" updated successfully!')
            return redirect("hosts:spot_detail", pk=spot.pk)
        else:
            messages.error(request, "Please fix the errors below.")
    else:
        form = ParkingSpotForm(instance=spot)
        image_formset = SpotImageFormSet(instance=spot)

    context = {
        "form": form,
        "image_formset": image_formset,
        "spot": spot,
        "is_edit": True,
    }
    return render(request, "hosts/pages/spot_form.html", context)


@host_required
def spot_detail(request, pk):
    """View a single spot with all its details, images, and availability."""
    spot = get_object_or_404(
        ParkingSpot.objects.prefetch_related("images", "availabilities"),
        pk=pk,
        owner=request.user,
    )

    # Booking stats for this spot
    now = timezone.now()
    spot_bookings = Booking.objects.filter(spot=spot)
    spot_earnings = (
        spot_bookings.filter(status="completed").aggregate(total=Sum("final_price"))[
            "total"
        ]
        or 0
    )
    active_parkers = spot_bookings.filter(
        status="active",
        start_datetime__lte=now,
        end_datetime__gte=now,
    ).select_related("driver")

    context = {
        "spot": spot,
        "spot_earnings": spot_earnings,
        "active_parkers": active_parkers,
        "total_bookings": spot_bookings.count(),
    }
    return render(request, "hosts/pages/spot_detail.html", context)


@host_required
def manage_availability(request, pk):
    """Manage availability time blocks for a spot using a formset."""
    spot = get_object_or_404(ParkingSpot, pk=pk, owner=request.user)

    if request.method == "POST":
        if "set_24_7" in request.POST:
            from core.models import Availability
            spot.availabilities.all().delete()
            Availability.objects.bulk_create([
                Availability(spot=spot, day_of_week=d, start_time="00:00", end_time="23:59")
                for d in range(7)
            ])
            messages.success(request, "Spot is now available 24/7!")
            return redirect("hosts:spot_detail", pk=spot.pk)

        formset = AvailabilityFormSet(request.POST, instance=spot)
        if formset.is_valid():
            formset.save()
            messages.success(request, "Availability updated successfully!")
            return redirect("hosts:spot_detail", pk=spot.pk)
        else:
            messages.error(request, "Please fix the errors below.")
    else:
        formset = AvailabilityFormSet(instance=spot)

    context = {
        "spot": spot,
        "formset": formset,
    }
    return render(request, "hosts/pages/availability.html", context)


@host_required
@require_POST
def toggle_spot_status(request, pk):
    """Activate or deactivate a parking spot."""
    spot = get_object_or_404(ParkingSpot, pk=pk, owner=request.user)

    if spot.status == "active":
        spot.status = "inactive"
        messages.info(request, f'"{spot.title}" has been deactivated.')
    else:
        spot.status = "active"
        messages.success(request, f'"{spot.title}" is now live!')

    spot.save(update_fields=["status", "updated_at"])
    return redirect("hosts:dashboard")


@host_required
@require_POST
def delete_spot(request, pk):
    """Delete a parking spot (only if no active bookings)."""
    spot = get_object_or_404(ParkingSpot, pk=pk, owner=request.user)

    # Prevent deletion if there are active/confirmed bookings
    has_active_bookings = Booking.objects.filter(
        spot=spot,
        status__in=["confirmed", "active"],
    ).exists()

    if has_active_bookings:
        messages.error(
            request,
            f'Cannot delete "{spot.title}" — it has active bookings. Deactivate it instead.',
        )
        return redirect("hosts:spot_detail", pk=spot.pk)

    title = spot.title
    spot.delete()
    messages.success(request, f'Spot "{title}" has been deleted.')
    return redirect("hosts:dashboard")


@host_required
def host_bookings(request):
    """View all bookings for a host's spots, organized by status."""
    now = timezone.now()
    all_bookings = Booking.objects.filter(spot__owner=request.user).select_related("spot", "driver")

    # Group bookings
    upcoming = all_bookings.filter(status="confirmed", start_datetime__gt=now).order_by("start_datetime")
    
    # Active meaning currently parked (host verified OTP)
    active = all_bookings.filter(status="active").order_by("-start_datetime")
    
    # Pending arrival (time has started, but host hasn't verified OTP yet)
    # They stay here until grace period is over
    pending_arrival = all_bookings.filter(
        status="confirmed",
        start_datetime__lte=now,
    ).order_by("start_datetime")

    past = all_bookings.filter(status__in=["completed", "cancelled", "no_show"]).order_by("-start_datetime")

    context = {
        "upcoming": upcoming,
        "active": active,
        "pending_arrival": pending_arrival,
        "past": past,
        "now": now,
    }
    return render(request, "hosts/pages/bookings.html", context)


@host_required
def host_booking_detail(request, pk):
    """Detailed view for a specific booking."""
    booking = get_object_or_404(Booking.objects.select_related("spot", "driver"), pk=pk, spot__owner=request.user)
    
    context = {
        "booking": booking,
        "now": timezone.now(),
    }
    return render(request, "hosts/pages/booking_detail.html", context)


@host_required
@require_POST
def verify_otp(request, pk):
    """Verify driver OTP and mark booking as active."""
    booking = get_object_or_404(Booking, pk=pk, spot__owner=request.user)
    
    # Can only verify confirmed bookings
    if booking.status != "confirmed":
        messages.error(request, "This booking cannot be verified right now.")
        return redirect("hosts:booking_detail", pk=booking.pk)
        
    submitted_otp = request.POST.get("otp", "").strip()
    
    if submitted_otp == booking.otp:
        booking.status = "active"
        booking.otp_verified_at = timezone.now()
        booking.save(update_fields=["status", "otp_verified_at", "updated_at"])
        messages.success(request, f"OTP verified successfully! Driver is now parked.")
    else:
        messages.error(request, "Invalid OTP. Please try again.")
        
    return redirect("hosts:booking_detail", pk=booking.pk)


@host_required
@require_POST
def mark_no_show(request, pk):
    """Mark a booking as no-show if driver didn't arrive within grace period."""
    booking = get_object_or_404(Booking, pk=pk, spot__owner=request.user)
    
    if booking.is_past_grace_period:
        booking.status = "no_show"
        booking.cancelled_reason = "no_show"
        booking.save(update_fields=["status", "cancelled_reason", "updated_at"])
        messages.warning(request, "Booking marked as No-Show. The spot is free again.")
    else:
        messages.error(request, "Grace period hasn't ended yet or booking is already verified.")
        
    return redirect("hosts:bookings")


@host_required
@require_POST
def complete_booking(request, pk):
    """Mark an active booking as completed (driver left)."""
    booking = get_object_or_404(Booking, pk=pk, spot__owner=request.user)
    
    if booking.status == "active":
        booking.status = "completed"
        booking.save(update_fields=["status", "updated_at"])
        messages.success(request, f"Booking completed. You earned ₹{booking.final_price}.")
    else:
        messages.error(request, "Only active bookings can be marked as completed.")
        
    return redirect("hosts:bookings")

