from django.shortcuts import render, redirect
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.views.decorators.http import require_POST
from core.models import ParkingSpot, Booking


def home(request):
    featured_spots = ParkingSpot.objects.filter(
        status="active", is_deleted=False
    ).order_by("-created_at")[:3]
    return render(request, "core/pages/index.html", {"featured_spots": featured_spots})


def signup(request):
    return render(request, "core/pages/auth.html", {"is_signup": True})


def login(request):
    return render(request, "core/pages/auth.html", {"is_signup": False})


def logout_view(request):
    logout(request)
    return redirect("core:login")


@login_required
@require_POST
def switch_role(request):
    """Toggle session role between 'host' and 'driver'."""
    current = request.session.get("active_role", "driver")
    new_role = "host" if current == "driver" else "driver"
    request.session["active_role"] = new_role

    if new_role == "host":
        return redirect("hosts:dashboard")
    return redirect("driver:my_bookings")


@login_required
def profile(request):
    """User profile page — view and edit."""
    user = request.user

    if request.method == "POST":
        full_name = request.POST.get("full_name", "").strip()
        phone = request.POST.get("phone", "").strip()

        errors = []
        if len(full_name) < 4:
            errors.append("Full name must be at least 4 characters.")
        if len(phone) < 10 or not phone.isdigit():
            errors.append("Please enter a valid 10-digit phone number.")

        if errors:
            for e in errors:
                messages.error(request, e)
        else:
            user.full_name = full_name
            user.phone = phone
            user.save(update_fields=["full_name", "phone"])
            messages.success(request, "Profile updated successfully!")
            return redirect("core:profile")

    # Stats
    total_bookings = Booking.objects.filter(driver=user).count()
    completed_bookings = Booking.objects.filter(driver=user, status="completed").count()
    spots_listed = ParkingSpot.objects.filter(owner=user, is_deleted=False).count()

    context = {
        "profile_user": user,
        "total_bookings": total_bookings,
        "completed_bookings": completed_bookings,
        "spots_listed": spots_listed,
    }
    return render(request, "core/pages/profile.html", context)
