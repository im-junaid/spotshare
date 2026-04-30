from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.views.decorators.http import require_POST
from datetime import timedelta

from core.models import ParkingSpot, Booking
from .forms import ParkingSpotForm, SpotImageFormSet, AvailabilityFormSet
from .decorators import host_required
from users.tasks import notify_booking_cancelled_task


def cancel_and_notify_upcoming_bookings(spot, reason_code, reason_text):
    """
    Helper to cancel all upcoming confirmed bookings for a spot and notify drivers.
    """
    upcoming_bookings = Booking.objects.filter(
        spot=spot, status="confirmed", start_datetime__gt=timezone.now()
    )

    count = upcoming_bookings.count()
    for booking in upcoming_bookings:
        booking.status = "cancelled"
        booking.cancelled_reason = reason_code
        booking.save(update_fields=["status", "cancelled_reason", "updated_at"])
        # Trigger Celery task for notification
        notify_booking_cancelled_task.delay(booking.pk, reason_text)

    return count


@host_required
def dashboard(request):
    """
    Host dashboard showing:
    - Total earnings from completed bookings
    - Currently active parkers
    - All listed spots with their status
    """
    user_spots = ParkingSpot.objects.filter(
        owner=request.user, is_deleted=False
    ).prefetch_related("images")

    # Earnings from completed bookings
    total_earnings = (
        Booking.objects.filter(
            spot__owner=request.user,
            status="completed",
        ).aggregate(
            total=Sum("final_price")
        )["total"]
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
    upcoming_bookings = (
        Booking.objects.filter(
            spot__owner=request.user,
            status="confirmed",
            start_datetime__gt=now,
        )
        .select_related("spot", "driver")
        .order_by("start_datetime")[:5]
    )

    # Recent completed bookings
    recent_bookings = (
        Booking.objects.filter(
            spot__owner=request.user,
            status="completed",
        )
        .select_related("spot", "driver")
        .order_by("-end_datetime")[:5]
    )

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
            Availability.objects.bulk_create(
                [
                    Availability(
                        spot=spot, day_of_week=d, start_time="00:00", end_time="23:59"
                    )
                    for d in range(7)
                ]
            )
            messages.success(request, "Spot is now available 24/7")
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
        # Notify upcoming bookings
        cancel_count = cancel_and_notify_upcoming_bookings(
            spot,
            "host_deactivated_spot",
            "The host has temporarily deactivated this parking spot.",
        )
        if cancel_count > 0:
            messages.info(
                request,
                f'"{spot.title}" deactivated. {cancel_count} upcoming bookings cancelled and drivers notified.',
            )
        else:
            messages.info(request, f'"{spot.title}" has been deactivated.')
    else:
        spot.status = "active"
        messages.success(request, f'"{spot.title}" is now live!')

    spot.save(update_fields=["status", "updated_at"])
    return redirect("hosts:dashboard")


@host_required
@require_POST
def delete_spot(request, pk):
    """Delete a parking spot (Soft delete if history exists)."""
    spot = get_object_or_404(ParkingSpot, pk=pk, owner=request.user)

    # Cancel and notify ANY upcoming bookings before deletion/deactivation
    cancel_count = cancel_and_notify_upcoming_bookings(
        spot,
        "host_deleted_spot",
        "The host has removed this parking spot from the platform.",
    )

    # Check if there is any booking history (including past ones)
    has_history = Booking.objects.filter(spot=spot).exists()

    if has_history:
        # Soft delete
        spot.is_deleted = True
        spot.status = "inactive"
        spot.save(update_fields=["is_deleted", "status", "updated_at"])

        msg = f'Spot "{spot.title}" has been removed.'
        if cancel_count > 0:
            msg += f" {cancel_count} upcoming bookings were cancelled."
        messages.success(request, msg)
    else:
        # Hard delete if no history at all
        title = spot.title
        spot.delete()
        messages.success(request, f'Spot "{title}" has been permanently deleted.')

    return redirect("hosts:dashboard")


@host_required
def host_bookings(request):
    """View all bookings for a host's spots, organized by status."""
    now = timezone.now()
    host_bookings = Booking.objects.filter(spot__owner=request.user)

    # Active: Arrived and confirmed
    active_bookings = (
        host_bookings.filter(status="active")
        .select_related("spot", "driver")
        .prefetch_related("spot__images")
        .order_by("start_datetime")
    )

    # Pending Arrival: Within 24 hours of starting, or already started but not verified
    pending_arrival = (
        host_bookings.filter(
            status="confirmed",
            start_datetime__lte=now + timedelta(hours=24),
            end_datetime__gte=now,
        )
        .select_related("spot", "driver")
        .prefetch_related("spot__images")
        .order_by("start_datetime")
    )

    # Needs Action: Booking time is OVER but still "confirmed" (never verified)
    # Host needs to mark these as completed or no-show
    needs_action = (
        host_bookings.filter(
            status="confirmed",
            end_datetime__lt=now,
        )
        .select_related("spot", "driver")
        .prefetch_related("spot__images")
        .order_by("-start_datetime")
    )

    # Upcoming: Starting more than 24 hours from now
    upcoming = (
        host_bookings.filter(
            status="confirmed", start_datetime__gt=now + timedelta(hours=24)
        )
        .select_related("spot", "driver")
        .prefetch_related("spot__images")
        .order_by("start_datetime")
    )

    # Past: Finished, cancelled, or no-show
    past = (
        host_bookings.filter(status__in=["completed", "cancelled", "no_show"])
        .select_related("spot", "driver")
        .prefetch_related("spot__images")
        .order_by("-start_datetime")[:15]
    )

    context = {
        "upcoming": upcoming,
        "active_bookings": active_bookings,
        "pending_arrival": pending_arrival,
        "needs_action": needs_action,
        "past": past,
        "now": now,
    }
    return render(request, "hosts/pages/bookings.html", context)


@host_required
def host_booking_detail(request, pk):
    """Detailed view for a specific booking."""
    booking = get_object_or_404(
        Booking.objects.select_related("spot", "driver"),
        pk=pk,
        spot__owner=request.user,
    )

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
def emergency_allow_parking(request, pk):
    """Emergency bypass for OTP verification."""
    booking = get_object_or_404(Booking, pk=pk, spot__owner=request.user)

    if booking.status != "confirmed":
        messages.error(request, "This booking cannot be activated right now.")
        return redirect("hosts:booking_detail", pk=booking.pk)

    booking.status = "active"
    booking.otp_verified_at = timezone.now()
    # Log that this was an emergency activation if we had an audit log,
    # for now we just mark it active.
    booking.save(update_fields=["status", "otp_verified_at", "updated_at"])

    messages.warning(
        request, "Emergency override successful. Booking activated without OTP."
    )
    return redirect("hosts:booking_detail", pk=booking.pk)


@host_required
@require_POST
def mark_no_show(request, pk):
    """Mark a booking as no-show if driver didn't arrive."""
    booking = get_object_or_404(Booking, pk=pk, spot__owner=request.user)

    now = timezone.now()
    # Allow no-show if: past grace period OR booking time fully expired while still confirmed
    is_expired_confirmed = booking.status == "confirmed" and booking.end_datetime < now

    if booking.is_past_grace_period or is_expired_confirmed:
        booking.status = "no_show"
        booking.cancelled_reason = "no_show"
        booking.save(update_fields=["status", "cancelled_reason", "updated_at"])
        messages.warning(request, "Booking marked as No-Show. The spot is free again.")
    else:
        messages.error(
            request, "Grace period hasn't ended yet or booking is already verified."
        )

    return redirect("hosts:bookings")


@host_required
@require_POST
def complete_booking(request, pk):
    """Mark a booking as completed (driver left or time expired)."""
    booking = get_object_or_404(Booking, pk=pk, spot__owner=request.user)

    now = timezone.now()
    # Allow completion if: actively parked OR booking time expired while still confirmed
    is_expired_confirmed = booking.status == "confirmed" and booking.end_datetime < now

    if booking.status == "active" or is_expired_confirmed:
        booking.status = "completed"
        booking.save(update_fields=["status", "updated_at"])
        messages.success(
            request, f"Booking completed. You earned ₹{booking.final_price}."
        )
    else:
        messages.error(request, "This booking cannot be marked as completed.")

    return redirect("hosts:bookings")


@host_required
@require_POST
def cancel_booking(request, pk):
    """Cancel an upcoming booking by the host."""
    booking = get_object_or_404(Booking, pk=pk, spot__owner=request.user)

    if booking.status == "confirmed":
        booking.status = "cancelled"
        booking.cancelled_reason = "host_cancelled"
        booking.save(update_fields=["status", "cancelled_reason", "updated_at"])

        # Notify driver
        notify_booking_cancelled_task.delay(
            booking.pk, "The host has manually cancelled this booking."
        )

        messages.success(
            request,
            f"Booking for {booking.spot.title} has been cancelled and driver notified.",
        )
    else:
        messages.error(request, "Only confirmed upcoming bookings can be cancelled.")

    return redirect("hosts:bookings")
