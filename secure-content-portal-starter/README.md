# Secure Content Portal

A secure full-stack content management portal developed for the **Full Stack Engineer Intern Screening Assignment**.

The application provides role-based access for **Admin** and **Viewer** users and supports secure management and viewing of training/reference content including **PDF, Video, and HTML files**.

## Live Application

**Frontend:**  
https://secure-portal-two.vercel.app

**Backend:**  
https://secure-content-portal-backend.onrender.com

---

## Features

### Authentication

- Google OAuth 2.0 authentication
- Secure server-side session management
- HttpOnly session cookies
- New users are assigned the Viewer role by default
- Admin access is configured server-side

### Role-Based Access Control

The application supports two roles:

**Viewer**
- Login using Google
- Browse available content
- View PDF files
- Watch videos
- View HTML content
- Cannot access Admin CRUD operations

**Admin**
- All Viewer capabilities
- Upload new content
- Edit content metadata
- Delete content
- Manage PDF, Video, and HTML resources

Admin authorization is enforced by the FastAPI backend and is not based only on frontend UI restrictions.

---

## Content Management

Administrators can upload:

- PDF documents
- MP4/WebM videos
- HTML files

Each content item contains:

- Title
- Description
- Category
- Content type
- Associated private file

Uploaded files are validated by the backend before being stored.

---

## Secure Content Viewing

### PDF

PDF files are stored privately in Supabase Storage.

The FastAPI backend authenticates the user before retrieving the PDF. The frontend uses **PDF.js through react-pdf** to render PDF pages inside the application.

### Video

Video requests first pass through the authenticated FastAPI backend.

After authorization, the backend generates a **short-lived signed Supabase Storage URL** so the browser can play the video without exposing a permanent public file URL.

### HTML

HTML files are retrieved through the authenticated backend and displayed inside a **sandboxed iframe**.

This reduces the ability of uploaded HTML to interact with the main application.

---

## Tech Stack

### Frontend

- React
- Vite
- JavaScript
- Axios
- react-pdf / PDF.js
- HTML/CSS

### Backend

- FastAPI
- Python
- SQLAlchemy
- Authlib
- Uvicorn

### Database

- PostgreSQL
- Supabase PostgreSQL

### Storage

- Supabase Private Storage

### Authentication

- Google OAuth 2.0
- Server-side session cookies

### Deployment

- Vercel — Frontend
- Render — Backend
- Supabase — PostgreSQL Database and Private File Storage

---

## Architecture

```text
                    User Browser
                         |
                         v
                React / Vite Frontend
                     (Vercel)
                         |
                    HTTPS / API
                         |
                         v
                 FastAPI Backend
                     (Render)
                    /         \
                   /           \
                  v             v
        Supabase PostgreSQL   Supabase
             Database       Private Storage
                                 |
                         PDF / Video / HTML
```

Google OAuth is used to authenticate users. The backend creates and manages the authenticated session and performs role-based authorization before protected operations are executed.

---

## Security Implementation

The application implements multiple security controls.

### Authentication Security

- Google OAuth authentication
- HttpOnly session cookies
- Secure cookies in production
- SameSite configuration for cross-origin production deployment
- Strong server-side session secret
- No authentication tokens stored in localStorage

### Authorization Security

Admin permissions are validated by the backend.

Hiding Admin buttons in React is only a UI feature; it is **not considered the security boundary**.

A Viewer attempting to directly access an Admin API receives an authorization error.

### Storage Security

Uploaded files are stored in a **private Supabase Storage bucket**.

Files are not exposed using permanent public `/uploads/filename` URLs.

Stored objects use generated names rather than user-controlled public file paths.

### Upload Security

The backend performs validation including:

- Allowed file extensions
- MIME/content-type validation
- File signature validation where applicable
- Maximum upload size
- Supported content-type restrictions

### HTML Security

Uploaded HTML is displayed using a sandboxed iframe.

This isolates uploaded HTML from the main application context.

---

## Security Boundaries vs Deterrents

Some protections provide real access-control boundaries, while others are browser-level deterrents.

### Security Boundaries

The following are actual security controls:

- Google OAuth authentication
- Server-side session authentication
- HttpOnly cookies
- Backend-enforced RBAC
- Private Supabase Storage
- Authenticated PDF/HTML delivery
- Short-lived signed video URLs
- File validation
- Sandboxed HTML rendering

### Browser-Level Deterrents

The application may hide or disable normal download controls where possible.

For example:

- Video download controls are discouraged using browser attributes
- PDFs are rendered through PDF.js instead of exposing a normal download link
- Print/download buttons are not provided by the application

However, these measures **cannot guarantee that an authorized user will never copy content**.

A determined authenticated user may still use browser developer tools, network inspection, screen recording, screenshots, or other techniques.

Therefore these mechanisms are treated as **deterrents rather than absolute security boundaries**.

---

## Environment Variables

Create a `backend/.env` file based on `backend/.env.example`.

Required backend variables include:

```env
DATABASE_URL=your_postgresql_database_url

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

SESSION_SECRET_KEY=your_long_random_session_secret

FRONTEND_URL=http://localhost:5173

ADMIN_EMAILS=your_admin_email@example.com

MAX_UPLOAD_MB=50

ENVIRONMENT=development
SESSION_SAME_SITE=lax
SESSION_HTTPS_ONLY=false

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_server_only_supabase_secret
SUPABASE_BUCKET=secure-content
```

For the frontend, configure:

```env
VITE_API_URL=http://localhost:8000
```

Never commit real `.env` files or secret credentials to GitHub.

---

## Local Development

### 1. Clone the Repository

```bash
git clone https://github.com/nandhini-80/Secure-portal.git
cd Secure-portal/secure-content-portal-starter
```

### 2. Run Backend

```bash
cd backend

python -m venv venv
```

Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn app.main:app --reload
```

Backend:

```text
http://localhost:8000
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

---

## Run Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

## Google OAuth Configuration

For local development:

**Authorized JavaScript Origin**

```text
http://localhost:5173
```

**Authorized Redirect URI**

```text
http://localhost:8000/auth/google/callback
```

For production:

**Authorized JavaScript Origin**

```text
https://secure-portal-two.vercel.app
```

**Authorized Redirect URI**

```text
https://secure-content-portal-backend.onrender.com/auth/google/callback
```

---

## Production Deployment

### Frontend

The React/Vite frontend is deployed using **Vercel**.

Production URL:

```text
https://secure-portal-two.vercel.app
```

### Backend

The FastAPI backend is deployed using **Render**.

Production URL:

```text
https://secure-content-portal-backend.onrender.com
```

Production backend start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Database and Storage

Supabase provides:

- PostgreSQL database
- Private Storage bucket
- Secure file storage

Sensitive credentials are configured using environment variables in the deployment platforms and are not committed to the repository.

---

## Project Structure

```text
secure-content-portal-starter/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   └── models.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   └── App.jsx
│   ├── package.json
│   └── package-lock.json
│
└── README.md
```

---

## API Security

Protected API endpoints require a valid authenticated session.

Administrative endpoints additionally verify the user's Admin role on the server.

Therefore, manually entering or guessing an Admin API URL does not bypass authorization.

---

## Deployment Status

- Google OAuth — Completed
- Secure HttpOnly Sessions — Completed
- PostgreSQL Database — Completed
- Admin / Viewer RBAC — Completed
- Secure File Validation — Completed
- Supabase Private Storage — Completed
- Protected Content Delivery — Completed
- PDF.js Viewer — Completed
- Video Viewing — Completed
- Sandboxed HTML Viewer — Completed
- Backend Deployment — Completed
- Frontend Deployment — Completed

---

## Repository

https://github.com/nandhini-80/Secure-portal

## Author

**Nandhini S**