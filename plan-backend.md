This is a solid choice. Using **Django’s Template Engine** (SSR) for a project like SpotShare is actually very efficient for SEO and initial development speed, as it simplifies state management between your database and the UI.

Since you are using **PostgreSQL**, ensure you have the **PostGIS** extension installed, as it allows Django’s `GeoManager` to handle the distance calculations for your "Secret Sauce."

---

## 1. Database Schema (The Foundation)

Even without a REST API, your database needs to be structured to handle time-ranges and spatial points.

### **Models & Relationships**

| Model            | Key Fields                                                                                            | Purpose                                                      |
| :--------------- | :---------------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| **ParkingSpot**  | `owner` (FK), `location` (PointField), `address`, `dimensions` (Hatchback/SUV), `base_rate`, `photos` | The physical driveway data. Uses **PostGIS** for `location`. |
| **Availability** | `spot` (FK), `day_of_week`, `start_time`, `end_time`, `is_recurring`                                  | Defines the host's "Matrix."                                 |
| **Booking**      | `spot` (FK), `driver` (FK), `start_datetime`, `end_datetime`, `total_price`, `status`                 | Tracks active and past leases.                               |

---

## 2. Host Workflow: "Showcasing the Area"

Since you are not using an API, your workflow will rely on **Django Forms** and **POST requests**.

### **Step 1: Spot Onboarding (The Form)**
The host needs to provide the location and details.
* **The Backend Logic:** Use a `ModelForm` for the `ParkingSpot`. 
* **The Map Trick:** Even without a REST API, you’ll use a small bit of Vanilla JS on the frontend. When the host clicks the map, the JS updates a **hidden HTML input field** with the latitude and longitude. When they hit "Submit," Django receives those coordinates as part of the standard form data.

### **Step 2: Defining the Availability Matrix**
Instead of a complex API-driven calendar, use a **FormSet**.
* **Workflow:** Provide a table where the host can add rows for "Monday: 09:00 - 17:00," etc.
* **Backend:** Save these as `Availability` objects linked to the `ParkingSpot`.

### **Step 3: The Host Dashboard**
A single view (`TemplateView`) that queries the database for:
* Total earnings (Sum of completed bookings).
* Active "Live" parkers (Bookings where `now()` is between start and end).
* Toggle to "Deactivate" the spot instantly.

---

## 3. Implementation Plan

### **Phase 1: Environment & PostGIS**
1.  Install `psycopg2-binary` and `django.contrib.gis`.
2.  In `settings.py`, add `'django.contrib.gis'` to `INSTALLED_APPS`.
3.  Set your `DATABASES` engine to `django.contrib.gis.db.backends.postgis`.

### **Phase 2: Core Models (The "Backbone")**
```python
# models.py
from django.contrib.gis.db import models
from django.contrib.auth.models import User

class ParkingSpot(models.Model):
    VEHICLE_CHOICES = [('small', 'Hatchback'), ('large', 'SUV/Sedan')]
    
    owner = models.ForeignKey(User, on_status=models.CASCADE)
    title = models.CharField(max_length=100)
    # PostGIS Point: stores longitude and latitude
    location = models.PointField() 
    base_rate_per_hour = models.DecimalField(max_digits=6, decimal_places=2)
    vehicle_size = models.CharField(max_length=10, choices=VEHICLE_CHOICES)
    photo = models.ImageField(upload_to='spots/')

    def __str__(self):
        return self.title
```

### **Phase 3: Logic & Template Rendering**
1.  **Views:** Create a `SpotCreateView` (inheriting from Django's `CreateView`).
2.  **Templates:** Use Tailwind for the layout. Use a `<form method="POST" enctype="multipart/form-data">` to handle the image uploads and spot details.
3.  **The "Secret Sauce" Query (Host Preview):** When a host looks at their own area, you can show them "Demand" by querying how many searches happened near their `location` using `ST_DWithin`.

---

## 4. Why this works for your "Secret Sauce"
Even in a template-rendered app, your backend handles the heavy lifting:
* **Spatial:** When a driver searches, your Django view receives the coordinates, runs the PostGIS query, and passes the `context` (the list of nearby spots) to the HTML template.
* **Temporal:** Your view filters the `Availability` objects to ensure the user's requested 3-hour window fits inside the Host's allowed time-block.

---

## Next Steps for You:
1.  **Setup the Django Project** with PostGIS enabled.
2.  **Create the ParkingSpot Model** and run migrations.
3.  **Build a simple HTML form** using Tailwind to "List a Spot."

To build a clean, scalable Django backend for SpotShare without using REST APIs, you should organize your modules based on the **Dual-Role User Architecture**. Even though a single user can be both a Host and a Driver, separating their functional logic into distinct Django "apps" makes the codebase much easier to manage.

Here is the recommended modular breakdown for your project:

---

### 1. The Directory Structure
You should split the logic into four primary apps to keep the "Secret Sauce" engine separate from the user-facing dashboards.

```text
spotshare_project/
├── users/          # Authentication & Profile Management
├── core/              # Shared Models (The "Secret Sauce" Engine)
├── hosts/             # Listing, Availability Matrix, & Earnings
└── drivers/           # Geospatial Search, Booking, & Navigation
```

---

### 2. App-by-App Module Breakdown

#### **A. The `accounts` App (The Identity Layer)**
This app manages the user's entry into the system and the "Role Switcher".
* **Purpose:** Handles OTP-based login and profile settings.
* **Key Logic:** A `is_host_mode` boolean in the session or user profile to determine which navbar/UI to render.
* **Views:** `login_view`, `signup_view`, `toggle_role_view`.

#### **B. The `core` App (The Shared Database)**
Since both Drivers and Hosts interact with the same data (spots and bookings), keep the models here to avoid circular imports.
* **Purpose:** Houses the PostGIS-enabled models.
* **Models:** * `ParkingSpot`: Stores geospatial `PointField`, dimensions, and base rates.
    * `Booking`: Tracks time slots, pricing, and payment status.
    * `Availability`: Stores the host’s time-slot matrix.
* **The "Secret Sauce":** Put your complex `ST_DWithin` and `tsrange` query logic here as custom Model Managers.

#### **C. The `hosts` App (The Supply Side)**
This module focuses on unlocking "dead capital" by allowing owners to manage their driveways.
* **Purpose:** Manage the "Host Experience".
* **Key Workflows:**
    * **Spot Onboarding:** Multi-step Django forms for photos, coordinates, and spot size.
    * **Availability Matrix:** A visual grid for hosts to drag and drop empty slots (Mon-Fri, 9 AM - 5 PM).
    * **Earnings Dashboard:** Calculating and displaying payouts and upcoming bookings.

#### **D. The `drivers` App (The Demand Side)**
This module is built for frictionless discovery and "One-Tap Booking".
* **Purpose:** Manage the "Driver Experience".
* **Key Workflows:**
    * **Geospatial Search:** Processes the destination and radius filters to find nearby spots.
    * **Dynamic Pricing Engine:** Calculates the final cost based on walking distance and duration.
    * **Active Booking UI:** Renders the countdown timer and navigation handoff to Google/Apple Maps.

---

### 3. Implementation Logic for Template Rendering

Since you are not using an API, your **"Role Switching"** logic happens at the template and middleware level:

| Feature           | Implementation Method                                                                                                                             |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Role Switcher** | A button in the shared `base.html` navbar that hits a view to flip a session variable: `request.session['role'] = 'host'`.                        |
| **Dynamic UI**    | Use Django template tags: `{% if request.session.role == 'host' %}` show Host Dashboard `{% else %}` show Map Search.                             |
| **Data Flow**     | The `drivers` search view receives coordinates via a POST form, runs the PostGIS query, and returns a list of spots to a `results.html` template. |



### 4. Shared "Secret Sauce" Utils
Create a `utils.py` inside the `core` app to handle logic that both modules might need:
* **`calculate_dynamic_price(base_rate, distance)`**: Used by Drivers to see the cost and by Hosts to see potential earnings.
* **`check_time_overlap(requested_range, spot_id)`**: Used by the booking flow to prevent double-booking.

This division ensures that your **Supply (Hosts)** and **Demand (Drivers)** logic stay clean while sharing the same powerful PostGIS foundation.

To implement the **Availability Matrix**, your `models.py` needs to handle recurring time blocks (e.g., every Monday from 9:00 AM to 5:00 PM) and specific one-off gaps.

Since you are using **PostgreSQL**, we can leverage specific field types to make the "Secret Sauce" query—finding an unbroken time-block within a geospatial radius—highly efficient.

### 1. The `models.py` Implementation

This setup resides in your `core` app to ensure both the **Host** (who creates the availability) and the **Driver** (who searches it) can access the same logic.

```python
from django.contrib.gis.db import models
from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator

class ParkingSpot(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    location = models.PointField()  # PostGIS field for ST_DWithin queries
    base_rate = models.DecimalField(max_digits=10, decimal_places=2)
    # Hatchback vs SUV dimensions
    is_suv_friendly = models.BooleanField(default=False) 

class Availability(models.Model):
    WEEKDAYS = [
        (0, 'Monday'), (1, 'Tuesday'), (2, 'Wednesday'),
        (3, 'Thursday'), (4, 'Friday'), (5, 'Saturday'), (6, 'Sunday'),
    ]

    spot = models.ForeignKey(ParkingSpot, related_name='availabilities', on_delete=models.CASCADE)
    day_of_week = models.IntegerField(choices=WEEKDAYS)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        verbose_name_plural = "Availabilities"

class Booking(models.Model):
    spot = models.ForeignKey(ParkingSpot, on_delete=models.CASCADE)
    driver = models.ForeignKey(User, on_delete=models.CASCADE)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    final_price = models.DecimalField(max_digits=10, decimal_places=2)
```

---

### 2. The "Secret Sauce" Logic (The Query)

The biggest challenge is ensuring a spot is available in the **Host's Matrix** and *not* already taken by another **Driver**. Here is how you execute that dual-filter query in a Django View:

```python
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from datetime import datetime

def find_available_spots(user_lat, user_lng, start_dt, end_dt):
    # 1. Define the search point and radius (e.g., 500 meters)
    user_location = fromstr(f'POINT({user_lng} {user_lat})', srid=4326)
    search_radius = D(m=500)

    # 2. Filter by Distance (Geospatial)
    nearby_spots = ParkingSpot.objects.filter(
        location__distance_lte=(user_location, search_radius)
    ).annotate(distance=Distance('location', user_location))

    # 3. Filter by Time-Slot (Temporal)
    requested_day = start_dt.weekday()
    requested_start = start_dt.time()
    requested_end = end_dt.time()

    available_spots = []
    for spot in nearby_spots:
        # Check if the spot has a matching window in the Host's matrix
        is_in_matrix = spot.availabilities.filter(
            day_of_week=requested_day,
            start_time__lte=requested_start,
            end_time__gte=requested_end
        ).exists()

        if is_in_matrix:
            # Check for conflicting bookings (overlaps)
            has_conflict = Booking.objects.filter(
                spot=spot,
                start_datetime__lt=end_dt,
                end_datetime__gt=start_dt
            ).exists()

            if not has_conflict:
                available_spots.append(spot)

    return available_spots
```

---

### 3. Dynamic Pricing Formula
Your algorithm must calculate the final rate based on the distance from the user's destination. In your template or view logic, you can apply this calculation:

$$Final\_Price = Base\_Rate \times \left( \frac{Search\_Radius}{Distance\_to\_Spot} \right)$$

* **Host Benefit**: Closer spots earn a higher premium automatically.
* **Driver Benefit**: Further spots are cheaper, incentivizing a short walk to save money.

### 4. Workflow for Host Management
* **Onboarding**: The Host uses a Django Form to pin their `location` and set their `base_rate`.
* **Matrix Builder**: Instead of one large complex form, the Host adds "Time Blocks" (e.g., adding a Monday block, then a Tuesday block) which are saved as individual `Availability` objects.

This modular approach keeps your **Geospatial logic (PostGIS)** separate from your **Business logic (Django Views)** while providing a seamless experience for both roles.
