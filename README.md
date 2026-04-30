# SpotShare 🚗

> A modern, peer-to-peer parking spot sharing platform built with Django, Tailwind CSS, and Leaflet.

[![Built with Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Styled with Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Powered by Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev/)
[![Location by Leaflet](https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)

SpotShare connects drivers looking for convenient parking with hosts who have unused parking spots. Featuring a state-of-the-art "Lime Glass" design, real-time geolocation mapping, and secure OTP-based booking verification, SpotShare aims to redefine urban mobility.

---

## ✨ Key Features

### 🛡️ Core & Security
* **Passwordless Authentication:** Secure, email-based OTP login system.
* **Role-Based Workflows:** Seamlessly switch between Driver and Host roles from a single account.
* **Background Tasks:** Robust Celery integration for asynchronous email notifications and automated booking status updates.

### 🏠 Host Portal
* **Spot Wizard:** Interactive, multi-step spot creation with drag-and-drop image uploads and map pinning.
* **Availability Scheduling:** Granular day-by-day and hour-by-hour availability matrix for hosts.
* **Dashboard Analytics:** Quick insights into earnings, total bookings, and active sessions.
* **Booking Management:** Review incoming bookings, verify arrivals via OTP, and mark no-shows.

### 🚗 Driver Portal
* **Interactive Map Search:** Leaflet-powered search to find spots near you, complete with radius and vehicle size filters.
* **Smart Booking Logic:** Prevents double-booking and validates spot availability against real-time schedules.
* **Trip Management:** Dedicated views for Active, Upcoming, and Past trips.
* **One-Tap Navigation:** Deep linking directly into Google Maps for quick directions.

---

## 🛠️ Tech Stack

### Backend
* **[Django 5+](https://www.djangoproject.com/)** - Core web framework and ORM.
* **[Celery](https://docs.celeryq.dev/)** - Distributed task queue for email and automated transitions.
* **[Redis](https://redis.io/)** - Message broker for Celery operations.
* **SQLite / PostgreSQL** - Flexible database support.

### Frontend
* **[Tailwind CSS v4](https://tailwindcss.com/)** - Utility-first CSS framework for rapid UI development.
* **[Leaflet.js](https://leafletjs.com/)** - Open-source interactive maps and geocoding.
* **[Lenis](https://lenis.studiofreight.com/)** - Smooth scrolling animations.
* **Vanilla JavaScript** - Lightweight DOM manipulation and asynchronous API calls.

---

## 📁 Project Structure

```text
spotshare/
├── spotshare/              # Django settings, URLs, WSGI/ASGI
├── core/                   # Shared models (Booking, ParkingSpot), Base Views, Auth logic
│   ├── static/             # Global CSS (input.css), JS (spotshare-map.js, etc), Images
│   └── templates/core/     # Global layouts (base.html), Navbar, Footer, Landing Page
├── hosts/                  # Host-specific views, forms, and templates
├── driver/                 # Driver-specific views, forms, and templates
├── users/                  # Custom User model and authentication managers
├── media/                  # Uploaded spot images and avatars
├── package.json            # Node dependencies (Tailwind CLI, Leaflet)
└── manage.py               # Django execution script
```

---

## 🚀 Getting Started (Local Deployment)

### Prerequisites
* Python 3.10+
* Node.js & npm (for Tailwind CLI)
* Redis Server (for Celery tasks)

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/spotshare.git
cd spotshare
```

### 2. Set up Python Environment
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
```

### 4. Database Setup
```bash
python manage.py makemigrations
python manage.py migrate
```

### 5. Frontend Build
Install Node dependencies and start the Tailwind watcher:
```bash
npm install
npm run dev
```

### 6. Run the Application
Open a new terminal and start the Django server:
```bash
python manage.py runserver 0.0.0.0:8000
```

### 7. Run Celery Worker
Open a new terminal (with Redis running) and start Celery to handle async emails/tasks:
```bash
# On Windows, using solo pool:
celery -A spotshare worker --loglevel=info --pool=solo

# On Linux/macOS:
celery -A spotshare worker --loglevel=info
```

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License
Distributed under the MIT License. See `LICENSE` for more information.
