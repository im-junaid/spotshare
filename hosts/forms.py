from django import forms
from django.forms import inlineformset_factory
from core.models import ParkingSpot, SpotImage, Availability


class ParkingSpotForm(forms.ModelForm):
    """Form for creating/editing a parking spot."""

    # Hidden fields — populated by map JS on the frontend
    latitude = forms.DecimalField(
        max_digits=9,
        decimal_places=6,
        widget=forms.HiddenInput(),
    )
    longitude = forms.DecimalField(
        max_digits=9,
        decimal_places=6,
        widget=forms.HiddenInput(),
    )

    class Meta:
        model = ParkingSpot
        fields = [
            "title",
            "description",
            "address",
            "latitude",
            "longitude",
            "vehicle_size",
            "base_rate_per_hour",
            "is_covered",
            "has_guard",
            "has_cctv",
            "has_ev_charging",
            "instructions",
        ]
        widgets = {
            "title": forms.TextInput(
                attrs={"placeholder": "e.g. My Driveway in Koramangala"}
            ),
            "description": forms.Textarea(
                attrs={"rows": 3, "placeholder": "Describe your parking spot..."}
            ),
            "address": forms.Textarea(attrs={"rows": 3, "placeholder": "Full address"}),
            "base_rate_per_hour": forms.NumberInput(
                attrs={"placeholder": "₹ per hour", "min": "1"}
            ),
            "instructions": forms.Textarea(
                attrs={"rows": 2, "placeholder": "How to find and access the spot..."}
            ),
        }


class SpotImageForm(forms.ModelForm):
    """Single image upload form for a spot."""

    class Meta:
        model = SpotImage
        fields = ["image", "is_primary"]


# Image FormSet: minimum 2 images, max 8
SpotImageFormSet = inlineformset_factory(
    ParkingSpot,
    SpotImage,
    form=SpotImageForm,
    min_num=2,
    validate_min=True,
    max_num=8,
    extra=2,
    can_delete=True,
)


# Availability FormSet: add/edit/delete time blocks
AvailabilityFormSet = inlineformset_factory(
    ParkingSpot,
    Availability,
    fields=["day_of_week", "start_time", "end_time"],
    extra=3,
    can_delete=True,
)
