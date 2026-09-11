import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./styles.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TYPE_META = {
  PDF: { icon: "📄", label: "PDF" },
  VIDEO: { icon: "🎬", label: "Video" },
  HTML: { icon: "🌐", label: "HTML" },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [items, setItems] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [status, setStatus] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("PDF");
  const [file, setFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [viewerItem, setViewerItem] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [htmlContent, setHtmlContent] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pdfError, setPdfError] = useState("");

  // Interactive UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("TITLE_ASC");
  const [showUploadPanel, setShowUploadPanel] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    initializePortal();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (message, tone = "success") => {
    setToast({ message, tone });
  };

  const initializePortal = async () => {
    setLoadingUser(true);
    try {
      const userResponse = await axios.get(`${API}/api/me`, {
        withCredentials: true,
      });
      setUser(userResponse.data);

      const contentResponse = await axios.get(`${API}/api/content`, {
        withCredentials: true,
      });
      setItems(contentResponse.data);
      setStatus("");
    } catch (error) {
      console.error("Initialization error:", error);
      setUser(null);
      setItems([]);
      setStatus(
        error.response?.status === 401
          ? "Please sign in with Google to access the portal."
          : "Unable to connect to the portal."
      );
    } finally {
      setLoadingUser(false);
    }
  };

  const loadContent = async (showToast = false) => {
    setLoadingContent(true);
    setStatus("");
    try {
      const response = await axios.get(`${API}/api/content`, {
        withCredentials: true,
      });
      setItems(response.data);
      if (showToast) notify("Content refreshed successfully.");
    } catch (error) {
      console.error("Content load error:", error);
      if (error.response?.status === 401) {
        setUser(null);
        setStatus("Please sign in again.");
      } else {
        setStatus("Unable to load content.");
      }
    } finally {
      setLoadingContent(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API}/auth/google/login`;
  };

  const handleLogout = () => {
    window.location.href = `${API}/auth/logout`;
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setType("PDF");
    setFile(null);
    setEditingId(null);
    const fileInput = document.getElementById("content-file");
    if (fileInput) fileInput.value = "";
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !category.trim()) {
      notify("Please fill all required fields.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const payload = {
          title: title.trim(),
          description: description.trim(),
          type,
          category: category.trim(),
        };

        await axios.put(`${API}/api/content/${editingId}`, payload, {
          withCredentials: true,
        });
        notify("Content updated successfully.");
      } else {
        if (!file) {
          notify("Please choose a file.", "error");
          return;
        }

        const formData = new FormData();
        formData.append("title", title.trim());
        formData.append("description", description.trim());
        formData.append("type", type);
        formData.append("category", category.trim());
        formData.append("file", file);

        await axios.post(`${API}/api/content`, formData, {
          withCredentials: true,
        });
        notify("Content uploaded successfully.");
      }

      resetForm();
      await loadContent();
    } catch (error) {
      console.error("Save error:", error);
      const message = error.response?.data?.detail;
      if (error.response?.status === 401) {
        notify("Please login again.", "error");
      } else if (error.response?.status === 403) {
        notify("Admin access required.", "error");
      } else if (error.response?.status === 413) {
        notify(message || "File is too large.", "error");
      } else {
        notify(message || "Unable to save content.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setTitle(item.title || "");
    setDescription(item.description || "");
    setCategory(item.category || "");
    setType(item.type || "PDF");
    setFile(null);
    setShowUploadPanel(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${item.title}"?`
    );
    if (!confirmed) return;

    try {
      await axios.delete(`${API}/api/content/${item.id}`, {
        withCredentials: true,
      });
      notify("Content deleted successfully.");

      if (editingId === item.id) resetForm();
      if (viewerItem?.id === item.id) closeViewer();
      await loadContent();
    } catch (error) {
      console.error("Delete error:", error);
      notify(
        error.response?.status === 403
          ? "Admin access required."
          : error.response?.data?.detail || "Unable to delete content.",
        "error"
      );
    }
  };

  const handleOpen = async (item) => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }

    setViewerItem(item);
    setViewerLoading(true);
    setHtmlContent("");
    setNumPages(null);
    setPdfError("");

    try {
      if (item.type === "PDF") {
        const response = await axios.get(
          `${API}/api/content/${item.id}/pdf`,
          { withCredentials: true, responseType: "blob" }
        );
        const blob = new Blob([response.data], { type: "application/pdf" });
        setPdfUrl(URL.createObjectURL(blob));
      }

      if (item.type === "HTML") {
        const response = await axios.get(
          `${API}/api/content/${item.id}/html`,
          { withCredentials: true, responseType: "text" }
        );
        setHtmlContent(response.data);
      }
    } catch (error) {
      console.error("Viewer error:", error);
      if (item.type === "PDF") {
        setPdfError(error.response?.data?.detail || "Unable to load PDF.");
      } else {
        notify("Unable to load content.", "error");
        setViewerItem(null);
      }
    } finally {
      setViewerLoading(false);
      setTimeout(() => {
        document
          .getElementById("content-viewer")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

  const closeViewer = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setViewerItem(null);
    setHtmlContent("");
    setNumPages(null);
    setPdfError("");
    setViewerLoading(false);
  };

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const result = items.filter((item) => {
      const matchesSearch =
        !term ||
        item.title?.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        item.category?.toLowerCase().includes(term) ||
        item.type?.toLowerCase().includes(term);
      const matchesType = typeFilter === "ALL" || item.type === typeFilter;
      return matchesSearch && matchesType;
    });

    return [...result].sort((a, b) => {
      if (sortBy === "TITLE_DESC") return (b.title || "").localeCompare(a.title || "");
      if (sortBy === "TYPE") return (a.type || "").localeCompare(b.type || "");
      if (sortBy === "CATEGORY") return (a.category || "").localeCompare(b.category || "");
      return (a.title || "").localeCompare(b.title || "");
    });
  }, [items, searchTerm, typeFilter, sortBy]);

  const stats = useMemo(
    () => ({
      total: items.length,
      pdf: items.filter((item) => item.type === "PDF").length,
      video: items.filter((item) => item.type === "VIDEO").length,
      html: items.filter((item) => item.type === "HTML").length,
    }),
    [items]
  );

  const clearFilters = () => {
    setSearchTerm("");
    setTypeFilter("ALL");
    setSortBy("TITLE_ASC");
  };

  if (loadingUser) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-orb" />
          <h2>Secure Content Portal</h2>
          <p>Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          <span>{toast.tone === "error" ? "!" : "✓"}</span>
          {toast.message}
        </div>
      )}

      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">SC</div>
          <div>
            <h1>Secure Content Portal</h1>
            <p>Training & reference workspace</p>
          </div>
        </div>

        {user && (
          <div className="topbar-actions">
            <div className="role-box">
              <span className="status-dot" />
              <span>{user.role === "admin" ? "Administrator" : "Viewer"}</span>
            </div>
            <button className="ghost-btn" onClick={() => loadContent(true)}>
              ↻ Refresh
            </button>
          </div>
        )}
      </header>

      <main className="container">
        <section className="hero">
          <div className="hero-copy">
            <span className="badge">Secure learning hub</span>
            <h2>Your protected content, organized beautifully.</h2>
            <p>
              Browse, manage and securely view PDFs, videos and HTML resources
              from one focused workspace.
            </p>

            {user && (
              <div className="hero-chips">
                <span>🔐 Authenticated</span>
                <span>🛡 Role protected</span>
                <span>☁ Private storage</span>
              </div>
            )}
          </div>

          <div className="profile-card">
            {user ? (
              <>
                <div className="profile-head">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name || "Profile"}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="avatar-fallback">
                      {(user.name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span className="profile-label">Signed in as</span>
                    <strong>{user.name || "User"}</strong>
                    <small>{user.email}</small>
                  </div>
                </div>
                <div className="profile-role-row">
                  <span>Access level</span>
                  <b>{user.role === "admin" ? "Admin" : "Viewer"}</b>
                </div>
                <button className="secondary-btn full" onClick={handleLogout}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <div className="login-icon">🔐</div>
                <h3>Welcome back</h3>
                <p>Sign in securely with your Google account to continue.</p>
                <button className="google-btn full" onClick={handleGoogleLogin}>
                  <span className="google-g">G</span>
                  Continue with Google
                </button>
              </>
            )}
          </div>
        </section>

        {!user && (
          <section className="signin-note">
            <div>ℹ️</div>
            <div>
              <h3>Sign in required</h3>
              <p>{status || "Authentication is required to access portal content."}</p>
            </div>
          </section>
        )}

        {user && (
          <>
            <section className="stats-grid">
              <article className="stat-card">
                <span className="stat-icon">📚</span>
                <div><small>Total content</small><strong>{stats.total}</strong></div>
              </article>
              <article className="stat-card">
                <span className="stat-icon">📄</span>
                <div><small>PDF documents</small><strong>{stats.pdf}</strong></div>
              </article>
              <article className="stat-card">
                <span className="stat-icon">🎬</span>
                <div><small>Videos</small><strong>{stats.video}</strong></div>
              </article>
              <article className="stat-card">
                <span className="stat-icon">🌐</span>
                <div><small>HTML resources</small><strong>{stats.html}</strong></div>
              </article>
            </section>

            {user.role === "admin" && (
              <section className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">Admin workspace</span>
                    <h3>{editingId ? "Edit content" : "Publish new content"}</h3>
                    <p>
                      {editingId
                        ? "Update the metadata for this resource."
                        : "Upload a secure training or reference resource."}
                    </p>
                  </div>
                  <button
                    className="ghost-btn"
                    onClick={() => setShowUploadPanel((prev) => !prev)}
                  >
                    {showUploadPanel ? "Hide form" : "Show form"}
                  </button>
                </div>

                {showUploadPanel && (
                  <div className="upload-body">
                    <div className="form-grid">
                      <label className="field">
                        <span>Title</span>
                        <input
                          type="text"
                          placeholder="e.g. React Fundamentals"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                        />
                      </label>

                      <label className="field">
                        <span>Category</span>
                        <input
                          type="text"
                          placeholder="e.g. Development"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        />
                      </label>

                      <label className="field">
                        <span>Content type</span>
                        <select
                          value={type}
                          disabled={Boolean(editingId)}
                          onChange={(e) => {
                            setType(e.target.value);
                            setFile(null);
                          }}
                        >
                          <option value="PDF">PDF</option>
                          <option value="VIDEO">Video</option>
                          <option value="HTML">HTML</option>
                        </select>
                      </label>

                      {!editingId && (
                        <label className="field">
                          <span>Choose file</span>
                          <input
                            id="content-file"
                            type="file"
                            accept={
                              type === "PDF"
                                ? ".pdf"
                                : type === "VIDEO"
                                ? ".mp4,.webm"
                                : ".html,.htm"
                            }
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                          />
                        </label>
                      )}
                    </div>

                    <label className="field full-field">
                      <span>Description</span>
                      <textarea
                        rows="4"
                        placeholder="Write a short description for this resource..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </label>

                    {!editingId && file && (
                      <div className="selected-file">
                        <span>📎</span>
                        <div><small>Selected file</small><strong>{file.name}</strong></div>
                      </div>
                    )}

                    <div className="form-actions">
                      <button className="primary" disabled={saving} onClick={handleSubmit}>
                        {saving
                          ? "Saving..."
                          : editingId
                          ? "Save changes"
                          : "Upload content"}
                      </button>
                      {editingId && (
                        <button className="secondary-btn" onClick={resetForm}>
                          Cancel editing
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="library-section">
              <div className="section-head">
                <div>
                  <span className="eyebrow">Content library</span>
                  <h3>Available resources</h3>
                  <p>Search resources and filter them by content type.</p>
                </div>
                <span className="result-count">{filteredItems.length} shown</span>
              </div>

              <div className="toolbar">
                <div className="search-box">
                  <span>⌕</span>
                  <input
                    type="search"
                    placeholder="Search title, category or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button className="clear-search" onClick={() => setSearchTerm("")}>
                      ×
                    </button>
                  )}
                </div>

                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="ALL">All types</option>
                  <option value="PDF">PDF</option>
                  <option value="VIDEO">Video</option>
                  <option value="HTML">HTML</option>
                </select>


                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="TITLE_ASC">Title A–Z</option>
                  <option value="TITLE_DESC">Title Z–A</option>
                  <option value="TYPE">Type</option>
                  <option value="CATEGORY">Category</option>
                </select>

              </div>

              {loadingContent && <p className="status">Loading content...</p>}
              {status && !loadingContent && <p className="status">{status}</p>}

              {!loadingContent && filteredItems.length === 0 && !status && (
                <div className="empty-state">
                  <div>🔎</div>
                  <h4>No matching content</h4>
                  <p>Try changing your search or filter settings.</p>
                  <button className="secondary-btn" onClick={clearFilters}>Clear filters</button>
                </div>
              )}

              <div className="cards">
                {filteredItems.map((item, index) => {
                  const meta = TYPE_META[item.type] || { icon: "📁", label: item.type };
                  const typeClass = item.type?.toLowerCase() || "other";

                  return (
                    <article
                      className="resource-card"
                      key={item.id}
                      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
                    >
                      <div className={`resource-icon ${typeClass}`} aria-hidden="true">
                        {meta.icon}
                      </div>

                      <div className="resource-content">
                        <span className={`resource-type ${typeClass}`}>
                          {meta.label}
                        </span>

                        <h4>{item.title}</h4>
                        <p>{item.description}</p>

                        <div className="resource-actions">
                          <button
                            className="open-resource-btn"
                            onClick={() => handleOpen(item)}
                          >
                            Open resource
                          </button>

                          {user.role === "admin" && (
                            <>
                              <button
                                className="edit-resource-btn"
                                onClick={() => handleEdit(item)}
                              >
                                Edit
                              </button>
                              <button
                                className="delete-resource-btn"
                                onClick={() => handleDelete(item)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {viewerItem && (
              <section id="content-viewer" className="viewer-panel">
                <div className="viewer-head">
                  <div>
                    <div className="viewer-meta-row">
                      <span className="type">{viewerItem.type}</span>
                      <span className="tag">{viewerItem.category}</span>
                    </div>
                    <h3>{viewerItem.title}</h3>
                    <p>{viewerItem.description}</p>
                  </div>
                  <button className="secondary-btn" onClick={closeViewer}>
                    ✕ Close viewer
                  </button>
                </div>

                {viewerLoading && (
                  <div className="viewer-loading">
                    <span className="spinner" />
                    <p>Loading content...</p>
                  </div>
                )}

                {!viewerLoading && viewerItem.type === "PDF" && (
                  <div className="pdf-shell" onContextMenu={(e) => e.preventDefault()}>
                    {pdfUrl ? (
                      <Document
                        file={pdfUrl}
                        onLoadSuccess={({ numPages }) => {
                          setNumPages(numPages);
                          setPdfError("");
                        }}
                        onLoadError={(error) => {
                          console.error("PDF.js error:", error);
                          setPdfError("Unable to display this PDF.");
                        }}
                        loading={<p>Rendering PDF...</p>}
                      >
                        {Array.from({ length: numPages || 0 }, (_, index) => (
                          <div className="pdf-page-wrap" key={index}>
                            <Page
                              pageNumber={index + 1}
                              width={Math.min(820, window.innerWidth - 80)}
                              renderAnnotationLayer={false}
                              renderTextLayer={true}
                            />
                          </div>
                        ))}
                      </Document>
                    ) : (
                      <p>{pdfError || "Unable to load PDF."}</p>
                    )}
                    {pdfError && <p className="status">{pdfError}</p>}
                  </div>
                )}

                {!viewerLoading && viewerItem.type === "VIDEO" && (
                  <div className="video-shell">
                    <video
                      key={viewerItem.id}
                      controls
                      controlsList="nodownload"
                      disablePictureInPicture
                      preload="metadata"
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <source src={`${API}/api/content/${viewerItem.id}/video`} />
                      Your browser does not support video playback.
                    </video>
                  </div>
                )}

                {!viewerLoading && viewerItem.type === "HTML" && (
                  <div className="html-shell">
                    <iframe
                      title={viewerItem.title}
                      sandbox=""
                      srcDoc={htmlContent}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <span>Secure Content Portal</span>
        <span>Protected access • Private storage • Role-based control</span>
      </footer>
    </div>
  );
}
