from django.urls import path
from . import views

app_name = "driver"

urlpatterns = [
    path("", views.driver_home, name="home"),
    path("search/", views.search, name="search"),
    path("api/spots/", views.api_nearby_spots, name="api_nearby_spots"),
    path("spot/<int:pk>/", views.spot_detail, name="spot_detail"),
    path("spot/<int:pk>/book/", views.create_booking, name="create_booking"),
    path("bookings/<int:pk>/", views.booking_detail, name="booking_detail"),
    path("bookings/<int:pk>/cancel/", views.cancel_booking, name="cancel_booking"),
    path("my-bookings/", views.my_bookings, name="my_bookings"),
]
