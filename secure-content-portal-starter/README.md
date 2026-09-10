# Secure Content Portal — Starter

A starter project for the **Full Stack Engineer Intern screening assignment**.

## Included

- React + Vite frontend
- FastAPI backend
- Viewer/Admin demo role switch
- Sample content cards
- Admin upload form UI
- Starter admin-protected API routes
- `.env.example` files
- Responsive starter styling

## Not completed yet

This is intentionally only a starter. The next steps are:

1. Google OAuth
2. Secure HttpOnly session cookies
3. PostgreSQL database models
4. Real Admin / Viewer RBAC
5. File upload validation
6. Supabase/S3-compatible private storage
7. Signed or token-gated content delivery
8. PDF.js viewer
9. Video streaming / range requests
10. Sandboxed HTML viewer
11. Deployment

## Run Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend:
`http://localhost:8000`

Swagger:
`http://localhost:8000/docs`

## Run Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:
`http://localhost:5173`

## Demo

Use the role dropdown in the top-right to switch between:

- Viewer
- Admin

This dropdown is only for initial UI testing. Real roles must later come from server-side authentication.
