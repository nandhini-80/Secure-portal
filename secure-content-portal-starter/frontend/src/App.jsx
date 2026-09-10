import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [role, setRole] = useState("viewer");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    axios.get(`${API}/api/content`)
      .then((res) => {
        setItems(res.data);
        setStatus("");
      })
      .catch(() => setStatus("Backend is not running yet."));
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Secure Content Portal</h1>
          <p>Starter UI for the internship assignment</p>
        </div>

        <div className="role-box">
          <span>Demo role:</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div>
            <span className="badge">Full Stack Starter</span>
            <h2>Training & Reference Content</h2>
            <p>
              Google OAuth, role-based access, secure uploads and protected
              content delivery can be added next.
            </p>
          </div>

          <button className="google-btn">
            Continue with Google
          </button>
        </section>

        {role === "admin" && (
          <section className="admin-panel">
            <h3>Admin Controls</h3>
            <div className="form-grid">
              <input placeholder="Title" />
              <input placeholder="Category / Tag" />
              <select>
                <option>PDF</option>
                <option>Video</option>
                <option>HTML</option>
              </select>
              <input type="file" />
            </div>
            <textarea placeholder="Description"></textarea>
            <button className="primary">Upload Content</button>
            <p className="hint">Starter only — upload wiring comes next.</p>
          </section>
        )}

        <section>
          <div className="section-head">
            <h3>Available Content</h3>
            <span>{items.length} item(s)</span>
          </div>

          {status && <p className="status">{status}</p>}

          <div className="cards">
            {items.map((item) => (
              <article className="card" key={item.id}>
                <div className="card-top">
                  <span className="type">{item.type}</span>
                  <span className="tag">{item.category}</span>
                </div>

                <h4>{item.title}</h4>
                <p>{item.description}</p>

                <div className="actions">
                  <button>Open</button>
                  {role === "admin" && (
                    <>
                      <button>Edit</button>
                      <button className="danger">Delete</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
