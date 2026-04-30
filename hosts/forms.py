from django import forms
from django.forms import inlineformset_factory
from core.models import ParkingSpot, SpotImage, Availability


class ParkingSpotForm(forms.ModelForm):
    """Form for creating/editing a parking spot."""

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


# Image FormSet: minimum 1 image, max 3
SpotImageFormSet = inlineformset_factory(
    ParkingSpot,
    SpotImage,
    form=SpotImageForm,
    min_num=1,
    validate_min=True,
    max_num=3,
    extra=0,
    can_delete=True,
)


class AvailabilityForm(forms.ModelForm):
    day_of_week = forms.TypedChoiceField(
        choices=[("", "Select Day")] + Availability.WEEKDAYS,
        coerce=int,
        required=False,
    )

    class Meta:
        model = Availability
        fields = ["day_of_week", "start_time", "end_time"]
        widgets = {
            "start_time": forms.TimeInput(attrs={"type": "time"}),
            "end_time": forms.TimeInput(attrs={"type": "time"}),
        }


# Availability FormSet: add/edit/delete time blocks
AvailabilityFormSet = inlineformset_factory(
    ParkingSpot,
    Availability,
    form=AvailabilityForm,
    extra=1,
    can_delete=True,
)
