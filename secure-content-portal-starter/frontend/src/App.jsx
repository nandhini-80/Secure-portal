import React, {
  useEffect,
  useState,
} from "react";

import axios from "axios";

import {
  Document,
  Page,
  pdfjs,
} from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";


pdfjs.GlobalWorkerOptions.workerSrc =
  new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();


const API =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";


export default function App() {

  // =====================================================
  // USER
  // =====================================================

  const [user, setUser] =
    useState(null);

  const [loadingUser, setLoadingUser] =
    useState(true);


  // =====================================================
  // CONTENT
  // =====================================================

  const [items, setItems] =
    useState([]);

  const [loadingContent, setLoadingContent] =
    useState(false);

  const [status, setStatus] =
    useState("");


  // =====================================================
  // ADMIN FORM
  // =====================================================

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [type, setType] =
    useState("PDF");

  const [file, setFile] =
    useState(null);

  const [editingId, setEditingId] =
    useState(null);

  const [saving, setSaving] =
    useState(false);


  // =====================================================
  // VIEWER
  // =====================================================

  const [viewerItem, setViewerItem] =
    useState(null);

  const [viewerLoading, setViewerLoading] =
    useState(false);

  const [htmlContent, setHtmlContent] =
    useState("");

  const [pdfUrl, setPdfUrl] =
    useState(null);

  const [numPages, setNumPages] =
    useState(null);

  const [pdfError, setPdfError] =
    useState("");


  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    initializePortal();

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(
          pdfUrl
        );
      }
    };
  }, []);


  const initializePortal =
    async () => {

      setLoadingUser(true);

      try {

        const userResponse =
          await axios.get(
            `${API}/api/me`,
            {
              withCredentials: true,
            }
          );

        setUser(
          userResponse.data
        );


        const contentResponse =
          await axios.get(
            `${API}/api/content`,
            {
              withCredentials: true,
            }
          );

        setItems(
          contentResponse.data
        );

        setStatus("");

      } catch (error) {

        console.error(
          "Initialization error:",
          error
        );

        setUser(null);
        setItems([]);

        if (
          error.response?.status ===
          401
        ) {

          setStatus(
            "Please sign in with Google to access the portal."
          );

        } else {

          setStatus(
            "Unable to connect to the portal."
          );
        }

      } finally {

        setLoadingUser(false);
      }
    };


  // =====================================================
  // LOAD CONTENT
  // =====================================================

  const loadContent =
    async () => {

      setLoadingContent(true);
      setStatus("");

      try {

        const response =
          await axios.get(
            `${API}/api/content`,
            {
              withCredentials: true,
            }
          );

        setItems(
          response.data
        );

      } catch (error) {

        console.error(
          "Content load error:",
          error
        );

        if (
          error.response?.status ===
          401
        ) {

          setUser(null);

          setStatus(
            "Please sign in again."
          );

        } else {

          setStatus(
            "Unable to load content."
          );
        }

      } finally {

        setLoadingContent(false);
      }
    };


  // =====================================================
  // LOGIN
  // =====================================================

  const handleGoogleLogin =
    () => {

      window.location.href =
        `${API}/auth/google/login`;
    };


  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout =
    () => {

      window.location.href =
        `${API}/auth/logout`;
    };


  // =====================================================
  // RESET FORM
  // =====================================================

  const resetForm =
    () => {

      setTitle("");
      setDescription("");
      setCategory("");
      setType("PDF");
      setFile(null);
      setEditingId(null);

      const fileInput =
        document.getElementById(
          "content-file"
        );

      if (fileInput) {
        fileInput.value = "";
      }
    };


  // =====================================================
  // UPLOAD / UPDATE
  // =====================================================

  const handleSubmit =
    async () => {

      if (
        !title.trim() ||
        !description.trim() ||
        !category.trim()
      ) {

        alert(
          "Please fill all required fields."
        );

        return;
      }


      setSaving(true);

      try {

        // =================================================
        // EDIT
        // =================================================

        if (editingId) {

          const payload = {
            title:
              title.trim(),

            description:
              description.trim(),

            type,

            category:
              category.trim(),
          };


          await axios.put(
            `${API}/api/content/${editingId}`,
            payload,
            {
              withCredentials: true,
            }
          );


          alert(
            "Content updated successfully."
          );

        }

        // =================================================
        // UPLOAD
        // =================================================

        else {

          if (!file) {

            alert(
              "Please choose a file."
            );

            return;
          }


          const formData =
            new FormData();


          formData.append(
            "title",
            title.trim()
          );

          formData.append(
            "description",
            description.trim()
          );

          formData.append(
            "type",
            type
          );

          formData.append(
            "category",
            category.trim()
          );

          formData.append(
            "file",
            file
          );


          await axios.post(
            `${API}/api/content`,
            formData,
            {
              withCredentials: true,
            }
          );


          alert(
            "Content uploaded successfully."
          );
        }


        resetForm();

        await loadContent();

      } catch (error) {

        console.error(
          "Save error:",
          error
        );


        const message =
          error.response?.data
            ?.detail;


        if (
          error.response?.status ===
          401
        ) {

          alert(
            "Please login again."
          );

        } else if (
          error.response?.status ===
          403
        ) {

          alert(
            "Admin access required."
          );

        } else if (
          error.response?.status ===
          413
        ) {

          alert(
            message ||
              "File is too large."
          );

        } else {

          alert(
            message ||
              "Unable to save content."
          );
        }

      } finally {

        setSaving(false);
      }
    };


  // =====================================================
  // EDIT
  // =====================================================

  const handleEdit =
    (item) => {

      setEditingId(
        item.id
      );

      setTitle(
        item.title || ""
      );

      setDescription(
        item.description || ""
      );

      setCategory(
        item.category || ""
      );

      setType(
        item.type || "PDF"
      );

      setFile(null);


      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };


  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete =
    async (item) => {

      const confirmed =
        window.confirm(
          `Are you sure you want to delete "${item.title}"?`
        );


      if (!confirmed) {
        return;
      }


      try {

        await axios.delete(
          `${API}/api/content/${item.id}`,
          {
            withCredentials: true,
          }
        );


        alert(
          "Content deleted successfully."
        );


        if (
          editingId ===
          item.id
        ) {

          resetForm();
        }


        if (
          viewerItem?.id ===
          item.id
        ) {

          closeViewer();
        }


        await loadContent();

      } catch (error) {

        console.error(
          "Delete error:",
          error
        );


        if (
          error.response?.status ===
          403
        ) {

          alert(
            "Admin access required."
          );

        } else {

          alert(
            error.response?.data
              ?.detail ||
              "Unable to delete content."
          );
        }
      }
    };


  // =====================================================
  // OPEN VIEWER
  // =====================================================

  const handleOpen =
    async (item) => {

      // Clean previous PDF URL

      if (pdfUrl) {

        URL.revokeObjectURL(
          pdfUrl
        );

        setPdfUrl(null);
      }


      setViewerItem(
        item
      );

      setViewerLoading(true);

      setHtmlContent("");

      setNumPages(null);

      setPdfError("");


      try {

        // =================================================
        // PDF
        // =================================================

        if (
          item.type === "PDF"
        ) {

          const response =
            await axios.get(
              `${API}/api/content/${item.id}/pdf`,
              {
                withCredentials:
                  true,

                responseType:
                  "blob",
              }
            );


          const contentType =
            response.headers[
              "content-type"
            ];


          console.log(
            "PDF content type:",
            contentType
          );


          const blob =
            new Blob(
              [response.data],
              {
                type:
                  "application/pdf",
              }
            );


          const objectUrl =
            URL.createObjectURL(
              blob
            );


          setPdfUrl(
            objectUrl
          );
        }


        // =================================================
        // HTML
        // =================================================

        if (
          item.type === "HTML"
        ) {

          const response =
            await axios.get(
              `${API}/api/content/${item.id}/html`,
              {
                withCredentials:
                  true,

                responseType:
                  "text",
              }
            );


          setHtmlContent(
            response.data
          );
        }


      } catch (error) {

        console.error(
          "Viewer error:",
          error
        );


        if (
          item.type === "PDF"
        ) {

          setPdfError(
            error.response?.data
              ?.detail ||
              "Unable to load PDF."
          );

        } else {

          alert(
            "Unable to load content."
          );

          setViewerItem(
            null
          );
        }

      } finally {

        setViewerLoading(
          false
        );


        setTimeout(() => {

          const viewer =
            document.getElementById(
              "content-viewer"
            );


          if (viewer) {

            viewer.scrollIntoView({
              behavior:
                "smooth",

              block:
                "start",
            });
          }

        }, 100);
      }
    };


  // =====================================================
  // CLOSE VIEWER
  // =====================================================

  const closeViewer =
    () => {

      if (pdfUrl) {

        URL.revokeObjectURL(
          pdfUrl
        );
      }

      setPdfUrl(null);

      setViewerItem(null);

      setHtmlContent("");

      setNumPages(null);

      setPdfError("");

      setViewerLoading(false);
    };


  // =====================================================
  // LOADING SCREEN
  // =====================================================

  if (loadingUser) {

    return (
      <div className="app">

        <main className="container">

          <section
            className="admin-panel"
          >

            <h3>
              Secure Content Portal
            </h3>

            <p>
              Loading portal...
            </p>

          </section>

        </main>

      </div>
    );
  }


  // =====================================================
  // MAIN UI
  // =====================================================

  return (

    <div className="app">


      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <header className="topbar">

        <div>

          <h1>
            Secure Content Portal
          </h1>

          <p>
            Training and reference
            content portal
          </p>

        </div>


        {user && (

          <div className="role-box">

            <span>
              Role:
            </span>

            <strong>
              {user.role ===
              "admin"
                ? "Admin"
                : "Viewer"}
            </strong>

          </div>
        )}

      </header>


      <main className="container">


        {/* ================================================= */}
        {/* HERO */}
        {/* ================================================= */}

        <section className="hero">

          <div>

            <span className="badge">
              Secure Portal
            </span>

            <h2>
              Training & Reference
              Content
            </h2>

            <p>
              Securely access
              organization videos,
              PDFs and HTML training
              resources.
            </p>

          </div>


          <div>

            {user ? (

              <div>

                {user.picture && (

                  <img
                    src={
                      user.picture
                    }

                    alt={
                      user.name ||
                      "Profile"
                    }

                    referrerPolicy="no-referrer"

                    width="52"

                    height="52"

                    style={{
                      borderRadius:
                        "50%",

                      objectFit:
                        "cover",

                      marginBottom:
                        "8px",
                    }}
                  />
                )}


                <p>

                  <strong>
                    {user.name}
                  </strong>

                </p>


                <p>
                  {user.email}
                </p>


                <p>

                  <strong>
                    {user.role ===
                    "admin"
                      ? "Administrator"
                      : "Viewer"}
                  </strong>

                </p>


                <button
                  className="google-btn"

                  onClick={
                    handleLogout
                  }
                >
                  Logout
                </button>

              </div>

            ) : (

              <button
                className="google-btn"

                onClick={
                  handleGoogleLogin
                }
              >
                Continue with Google
              </button>
            )}

          </div>

        </section>


        {/* ================================================= */}
        {/* NOT LOGGED IN */}
        {/* ================================================= */}

        {!user && (

          <section
            className="admin-panel"
          >

            <h3>
              Sign in required
            </h3>

            <p>
              Please continue with
              Google to access
              training and reference
              content.
            </p>

            {status && (

              <p className="status">
                {status}
              </p>
            )}

          </section>
        )}


        {/* ================================================= */}
        {/* ADMIN FORM */}
        {/* ================================================= */}

        {user?.role ===
          "admin" && (

          <section
            className="admin-panel"
          >

            <h3>

              {editingId
                ? "Edit Content"
                : "Upload Content"}

            </h3>


            <div
              className="form-grid"
            >


              <input
                type="text"

                placeholder="Title"

                value={title}

                onChange={(e) =>
                  setTitle(
                    e.target.value
                  )
                }
              />


              <input
                type="text"

                placeholder="Category / Tag"

                value={category}

                onChange={(e) =>
                  setCategory(
                    e.target.value
                  )
                }
              />


              <select
                value={type}

                disabled={
                  Boolean(
                    editingId
                  )
                }

                onChange={(e) => {

                  setType(
                    e.target.value
                  );

                  setFile(null);

                }}
              >

                <option value="PDF">
                  PDF
                </option>

                <option value="VIDEO">
                  Video
                </option>

                <option value="HTML">
                  HTML
                </option>

              </select>


              {!editingId && (

                <input
                  id="content-file"

                  type="file"

                  accept={
                    type === "PDF"
                      ? ".pdf"

                      : type ===
                        "VIDEO"
                      ? ".mp4,.webm"

                      : ".html,.htm"
                  }

                  onChange={(e) =>
                    setFile(
                      e.target
                        .files?.[0] ||
                        null
                    )
                  }
                />
              )}

            </div>


            <textarea
              rows="4"

              placeholder="Description"

              value={
                description
              }

              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
            />


            {!editingId &&
              file && (

              <p className="hint">

                Selected file:{" "}

                <strong>
                  {file.name}
                </strong>

              </p>
            )}


            <button
              className="primary"

              disabled={
                saving
              }

              onClick={
                handleSubmit
              }
            >

              {saving
                ? "Saving..."

                : editingId
                ? "Update Content"

                : "Upload Content"}

            </button>


            {editingId && (

              <button
                onClick={
                  resetForm
                }

                style={{
                  marginLeft:
                    "10px",
                }}
              >
                Cancel
              </button>
            )}

          </section>
        )}


        {/* ================================================= */}
        {/* CONTENT LIST */}
        {/* ================================================= */}

        {user && (

          <section>


            <div
              className="section-head"
            >

              <h3>
                Available Content
              </h3>

              <span>
                {items.length} item(s)
              </span>

            </div>


            {loadingContent && (

              <p className="status">
                Loading content...
              </p>
            )}


            {status &&
              !loadingContent && (

              <p className="status">
                {status}
              </p>
            )}


            {!loadingContent &&
              items.length === 0 &&
              !status && (

              <p className="status">
                No content uploaded yet.
              </p>
            )}


            <div className="cards">


              {items.map(
                (item) => (

                <article
                  className="card"

                  key={
                    item.id
                  }
                >


                  <div
                    className="card-top"
                  >

                    <span
                      className="type"
                    >
                      {item.type}
                    </span>


                    <span
                      className="tag"
                    >
                      {item.category}
                    </span>

                  </div>


                  <h4>
                    {item.title}
                  </h4>


                  <p>
                    {item.description}
                  </p>


                  <div
                    className="actions"
                  >


                    <button
                      className="primary"

                      onClick={() =>
                        handleOpen(
                          item
                        )
                      }
                    >
                      Open
                    </button>


                    {user.role ===
                      "admin" && (
                      <>


                        <button
                          onClick={() =>
                            handleEdit(
                              item
                            )
                          }
                        >
                          Edit
                        </button>


                        <button
                          className="danger"

                          onClick={() =>
                            handleDelete(
                              item
                            )
                          }
                        >
                          Delete
                        </button>


                      </>
                    )}

                  </div>

                </article>
              ))}

            </div>

          </section>
        )}


        {/* ================================================= */}
        {/* VIEWER */}
        {/* ================================================= */}

        {user &&
          viewerItem && (

          <section
            id="content-viewer"

            className="admin-panel"

            style={{
              marginTop:
                "30px",
            }}
          >


            <div
              style={{
                display: "flex",

                justifyContent:
                  "space-between",

                gap: "20px",

                alignItems:
                  "flex-start",

                flexWrap:
                  "wrap",

                marginBottom:
                  "20px",
              }}
            >


              <div>

                <span className="type">
                  {viewerItem.type}
                </span>


                <h3>
                  {viewerItem.title}
                </h3>


                <p>
                  {
                    viewerItem.description
                  }
                </p>


                <span className="tag">
                  {
                    viewerItem.category
                  }
                </span>

              </div>


              <button
                onClick={
                  closeViewer
                }
              >
                Close Viewer
              </button>


            </div>


            {/* ================================================= */}
            {/* LOADING */}
            {/* ================================================= */}

            {viewerLoading && (

              <p
                style={{
                  textAlign:
                    "center",
                }}
              >
                Loading content...
              </p>
            )}


            {/* ================================================= */}
            {/* PDF */}
            {/* ================================================= */}

            {!viewerLoading &&
              viewerItem.type ===
              "PDF" && (

              <div
                onContextMenu={
                  (e) =>
                    e.preventDefault()
                }

                style={{
                  maxHeight:
                    "750px",

                  overflow:
                    "auto",

                  textAlign:
                    "center",

                  padding:
                    "15px",

                  border:
                    "1px solid #ddd",

                  borderRadius:
                    "10px",
                }}
              >


                {pdfUrl ? (

                  <Document
                    file={
                      pdfUrl
                    }

                    onLoadSuccess={({
                      numPages,
                    }) => {

                      setNumPages(
                        numPages
                      );

                      setPdfError(
                        ""
                      );
                    }}

                    onLoadError={(
                      error
                    ) => {

                      console.error(
                        "PDF.js error:",
                        error
                      );

                      setPdfError(
                        "Unable to display this PDF."
                      );
                    }}

                    loading={
                      <p>
                        Rendering PDF...
                      </p>
                    }
                  >


                    {Array.from(
                      {
                        length:
                          numPages ||
                          0,
                      },

                      (_, index) => (

                        <div
                          key={
                            index
                          }

                          style={{
                            marginBottom:
                              "20px",
                          }}
                        >

                          <Page
                            pageNumber={
                              index +
                              1
                            }

                            width={
                              Math.min(
                                760,
                                window
                                  .innerWidth -
                                  100
                              )
                            }

                            renderAnnotationLayer={
                              false
                            }

                            renderTextLayer={
                              true
                            }
                          />

                        </div>
                      )
                    )}


                  </Document>

                ) : (

                  <p>
                    {pdfError ||
                      "Unable to load PDF."}
                  </p>
                )}


                {pdfError && (

                  <p className="status">
                    {pdfError}
                  </p>
                )}


              </div>
            )}


            {/* ================================================= */}
            {/* VIDEO */}
            {/* ================================================= */}

            {!viewerLoading &&
              viewerItem.type ===
              "VIDEO" && (

              <video
                key={
                  viewerItem.id
                }

                controls

                controlsList="nodownload"

                disablePictureInPicture

                preload="metadata"

                onContextMenu={
                  (e) =>
                    e.preventDefault()
                }

                style={{
                  width:
                    "100%",

                  maxHeight:
                    "650px",

                  background:
                    "#000",

                  borderRadius:
                    "10px",
                }}
              >

                <source
                  src={
                    `${API}/api/content/${viewerItem.id}/video`
                  }
                />

                Your browser does not
                support video playback.

              </video>
            )}


            {/* ================================================= */}
            {/* HTML */}
            {/* ================================================= */}

            {!viewerLoading &&
              viewerItem.type ===
              "HTML" && (

              <iframe
                title={
                  viewerItem.title
                }

                sandbox=""

                srcDoc={
                  htmlContent
                }

                referrerPolicy="no-referrer"

                style={{
                  width:
                    "100%",

                  height:
                    "650px",

                  border:
                    "1px solid #ddd",

                  borderRadius:
                    "10px",

                  background:
                    "#ffffff",
                }}
              />
            )}


          </section>
        )}


      </main>

    </div>
  );
}