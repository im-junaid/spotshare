from django.shortcuts import render, redirect
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from core.models import ParkingSpot

def home(request):
    featured_spots = ParkingSpot.objects.filter(status="active").order_by("-created_at")[:3]
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
    return redirect("driver:search")
