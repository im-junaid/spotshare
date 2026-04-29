from django.urls import path
from . import views

app_name = "hosts"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("spots/new/", views.create_spot, name="create_spot"),
    path("spots/<int:pk>/", views.spot_detail, name="spot_detail"),
    path("spots/<int:pk>/edit/", views.edit_spot, name="edit_spot"),
    path("spots/<int:pk>/hours/", views.manage_availability, name="manage_availability"),
    path("spots/<int:pk>/toggle/", views.toggle_spot_status, name="toggle_status"),
    path("spots/<int:pk>/delete/", views.delete_spot, name="delete_spot"),
    
    # Booking Management
    path("bookings/", views.host_bookings, name="bookings"),
    path("bookings/<int:pk>/", views.host_booking_detail, name="booking_detail"),
    path("bookings/<int:pk>/verify/", views.verify_otp, name="verify_otp"),
    path("bookings/<int:pk>/no-show/", views.mark_no_show, name="mark_no_show"),
    path("bookings/<int:pk>/complete/", views.complete_booking, name="complete_booking"),
]
