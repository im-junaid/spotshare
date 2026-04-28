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
