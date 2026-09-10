from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Secure Content Portal API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEMO_CONTENT = [
    {
        "id": 1,
        "title": "Employee Handbook",
        "description": "Sample PDF reference content.",
        "type": "PDF",
        "category": "HR"
    },
    {
        "id": 2,
        "title": "Security Training",
        "description": "Sample internal training video.",
        "type": "VIDEO",
        "category": "Security"
    },
    {
        "id": 3,
        "title": "Getting Started",
        "description": "Sample HTML onboarding page.",
        "type": "HTML",
        "category": "Onboarding"
    }
]

def admin_only(x_demo_role: str = Header(default="viewer")):
    if x_demo_role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return True

@app.get("/")
def root():
    return {"message": "Secure Content Portal API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/content")
def list_content():
    return DEMO_CONTENT

@app.post("/api/content")
def create_content(_: bool = Depends(admin_only)):
    return {
        "message": "Starter endpoint only. Add multipart upload + storage next."
    }

@app.put("/api/content/{content_id}")
def update_content(content_id: int, _: bool = Depends(admin_only)):
    return {"message": f"Starter update endpoint for content {content_id}"}

@app.delete("/api/content/{content_id}")
def delete_content(content_id: int, _: bool = Depends(admin_only)):
    return {"message": f"Starter delete endpoint for content {content_id}"}

@app.get("/api/auth/google")
def google_login_placeholder():
    return {
        "message": "Google OAuth placeholder. Configure OAuth in the next step."
    }
