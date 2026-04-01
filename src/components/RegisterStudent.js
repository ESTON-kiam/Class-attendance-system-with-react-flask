import React, { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import toast from "react-hot-toast";

const COURSES = [
  "Computer Science", "Information Technology", "Software Engineering",
  "Data Science", "Electrical Engineering", "Mechanical Engineering",
  "Business Administration", "Accounting", "Medicine", "Law",
];

export default function RegisterStudent() {
  const webcamRef = useRef(null);
  const [form, setForm] = useState({ studentId: "", name: "", course: "" });
  const [snapshot, setSnapshot] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const capturePhoto = useCallback(() => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    setSnapshot(imageSrc);
    setCameraOn(false);
    toast.success("Photo captured!");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!snapshot) return toast.error("Please capture a face photo first");
    if (!form.studentId || !form.name || !form.course) return toast.error("Fill in all fields");

    setLoading(true);
    try {
      const res = await axios.post("/api/students/register", { ...form, image: snapshot });
      toast.success(res.data.message);
      setForm({ studentId: "", name: "", course: "" });
      setSnapshot(null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="two-col">
      {/* Left: Form */}
      <div className="card">
        <div className="card-title">✏️ Student Information</div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Student ID / Reg Number</label>
              <input
                name="studentId"
                value={form.studentId}
                onChange={handleChange}
                placeholder="e.g. CS/2023/001"
                required
              />
            </div>

            <div className="form-group">
              <label>Full Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. John Doe"
                required
              />
            </div>

            <div className="form-group full">
              <label>Course / Programme</label>
              <select name="course" value={form.course} onChange={handleChange} required>
                <option value="">Select a course</option>
                {COURSES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <hr className="divider" />

          <div className="section-label">Biometric Photo</div>

          {!cameraOn && !snapshot && (
            <div className="empty-state" style={{ padding: "32px", background: "var(--bg3)", borderRadius: "12px", marginBottom: "16px" }}>
              <div className="icon">📷</div>
              <p>Camera not active — click below to start</p>
            </div>
          )}

          {cameraOn && (
            <div className="webcam-wrapper mb-4">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
                style={{ width: "100%", borderRadius: "12px" }}
              />
              <div className="webcam-overlay">
                <div className="scan-line" />
                {/* Face guide box */}
                <div style={{
                  position: "absolute", top: "15%", left: "25%", right: "25%", bottom: "15%",
                  border: "2px dashed rgba(0,229,255,0.5)", borderRadius: "8px",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <span style={{ color: "rgba(0,229,255,0.6)", fontSize: "11px", background: "rgba(0,0,0,0.5)", padding: "4px 8px", borderRadius: "4px" }}>
                    Center face here
                  </span>
                </div>
              </div>
            </div>
          )}

          {snapshot && (
            <div className="snapshot-preview mb-4">
              <img src={snapshot} alt="Captured face" />
              <div style={{ background: "rgba(16,185,129,0.1)", padding: "8px 12px", fontSize: "13px", color: "var(--success)", display: "flex", alignItems: "center", gap: "6px" }}>
                ✅ Face photo ready
              </div>
            </div>
          )}

          <div className="flex-row mb-4">
            {!cameraOn && (
              <button type="button" className="btn btn-secondary" onClick={() => { setCameraOn(true); setSnapshot(null); }}>
                📷 {snapshot ? "Retake" : "Open Camera"}
              </button>
            )}
            {cameraOn && (
              <>
                <button type="button" className="btn btn-primary" onClick={capturePhoto}>
                  📸 Capture Photo
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setCameraOn(false)}>
                  ✕ Cancel
                </button>
              </>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? <><span className="spinner" /> Registering...</> : "✅ Register Student"}
          </button>
        </form>
      </div>

      {/* Right: Info Panel */}
      <div>
        <div className="card mb-4">
          <div className="card-title">📌 Registration Tips</div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              ["💡", "Ensure the student faces the camera directly"],
              ["💡", "Use a well-lit area for clearer recognition"],
              ["💡", "Only one person should be in the frame"],
              ["💡", "Remove glasses or hats if possible"],
              ["💡", "Look straight at the camera, not down"],
            ].map(([icon, text], i) => (
              <li key={i} style={{ display: "flex", gap: "10px", color: "var(--text2)", fontSize: "14px" }}>
                <span>{icon}</span><span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="card-title">🔐 How It Works</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { step: "01", title: "Fill Details", desc: "Enter the student's ID, name and course" },
              { step: "02", title: "Capture Face", desc: "Take a clear photo for biometric registration" },
              { step: "03", title: "Register", desc: "Face encoding is extracted and saved securely" },
              { step: "04", title: "Auto Attend", desc: "Student is recognized instantly during class" },
            ].map((s) => (
              <div key={s.step} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{
                  fontFamily: "Space Mono, monospace", fontSize: "11px", color: "var(--accent)",
                  background: "rgba(0,229,255,0.1)", padding: "4px 8px", borderRadius: "6px", flexShrink: 0
                }}>{s.step}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{s.title}</div>
                  <div style={{ color: "var(--text3)", fontSize: "13px", marginTop: "2px" }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
