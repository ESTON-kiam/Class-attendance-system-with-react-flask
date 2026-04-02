import React, { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import api from "../api";
import toast from "react-hot-toast";

const COURSES = [
  "Computer Science","Information Technology","Software Engineering",
  "Data Science","Electrical Engineering","Mechanical Engineering",
  "Business Administration","Accounting","Medicine","Law",
];

export default function RegisterStudent() {
  const webcamRef  = useRef(null);
  const [studentId, setStudentId] = useState("");
  const [name,      setName]      = useState("");
  const [course,    setCourse]    = useState("");
  const [snapshot,  setSnapshot]  = useState(null);
  const [cameraOn,  setCameraOn]  = useState(false);
  const [loading,   setLoading]   = useState(false);

  const capturePhoto = useCallback(() => {
    if (!webcamRef.current) return toast.error("Camera not ready");
    const img = webcamRef.current.getScreenshot({ width: 640, height: 480 });
    if (!img) return toast.error("Could not capture — allow camera access and try again");
    setSnapshot(img);
    setCameraOn(false);
    toast.success("Photo captured!");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return toast.error("Student ID is required");
    if (!name.trim())       return toast.error("Name is required");
    if (!course)            return toast.error("Please select a course");
    if (!snapshot)          return toast.error("Please capture a face photo first");

    setLoading(true);
    try {
      const res = await api.post("/api/students/register", {
        studentId: studentId.trim(),
        name: name.trim(),
        course,
        image: snapshot,
      });
      toast.success(res.data.message || "Registered!");
      setStudentId(""); setName(""); setCourse(""); setSnapshot(null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="two-col">
      <div className="panel">
        <div className="panel-title">✏️ Student Information</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Student ID / Reg Number</label>
            <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="e.g. CS/2023/001" />
          </div>
          <div className="form-group">
            <label>Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Doe" />
          </div>
          <div className="form-group">
            <label>Course / Programme</label>
            <select value={course} onChange={e => setCourse(e.target.value)}>
              <option value="">— Select a course —</option>
              {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <hr className="divider" />
          <div className="section-label">Biometric Face Photo</div>

          {!cameraOn && !snapshot && (
            <div className="empty-state mb-4" style={{ background: "var(--bg3)", borderRadius: "10px", padding: "24px" }}>
              <div className="icon">📷</div>
              <p>Click "Open Camera" to capture the student's face</p>
            </div>
          )}

          {cameraOn && (
            <div className="webcam-wrapper">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.92}
                videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
                mirrored={false}
                style={{ width: "100%", display: "block" }}
                onUserMediaError={() => toast.error("Camera access denied")}
              />
              <div className="webcam-overlay">
                <div className="scan-line" />
                <div className="face-guide"><span>Center face here</span></div>
              </div>
            </div>
          )}

          {snapshot && (
            <div className="snapshot-preview">
              <img src={snapshot} alt="Captured face" />
              <div className="snapshot-label">✅ Face photo captured — ready to register</div>
            </div>
          )}

          <div className="flex-row mb-4">
            {!cameraOn && (
              <button type="button" className="btn btn-secondary" onClick={() => { setCameraOn(true); setSnapshot(null); }}>
                📷 {snapshot ? "Retake Photo" : "Open Camera"}
              </button>
            )}
            {cameraOn && (
              <>
                <button type="button" className="btn btn-primary" onClick={capturePhoto}>📸 Capture</button>
                <button type="button" className="btn btn-secondary" onClick={() => setCameraOn(false)}>✕ Cancel</button>
              </>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <><span className="spinner" /> Registering...</> : "✅ Register Student"}
          </button>
        </form>
      </div>

      <div>
        <div className="panel mb-4">
          <div className="panel-title">📌 Tips for Best Results</div>
          {[
            ["💡","Student faces the camera directly"],
            ["💡","Good even lighting — avoid backlighting"],
            ["💡","Only one person in the frame"],
            ["💡","Remove glasses or hats if possible"],
            ["💡","Neutral expression, eyes open"],
          ].map(([icon, text], i) => (
            <div key={i} style={{ display:"flex", gap:"10px", color:"var(--text2)", fontSize:"14px", marginBottom:"10px" }}>
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-title">🔐 How It Works</div>
          {[
            { step:"01", title:"Fill Details",    desc:"Enter Student ID, name and course" },
            { step:"02", title:"Capture Face",    desc:"Open camera and take a clear photo" },
            { step:"03", title:"Register",        desc:"Face encoding is saved securely" },
            { step:"04", title:"Auto Attendance", desc:"Student recognised instantly in class" },
          ].map(s => (
            <div key={s.step} style={{ display:"flex", gap:"12px", marginBottom:"14px", alignItems:"flex-start" }}>
              <div style={{ background:"rgba(88,166,255,0.1)", color:"var(--accent)", padding:"3px 8px", borderRadius:"5px", fontSize:"11px", fontFamily:"monospace", flexShrink:0 }}>{s.step}</div>
              <div>
                <div style={{ fontWeight:600, fontSize:"14px" }}>{s.title}</div>
                <div style={{ color:"var(--text3)", fontSize:"13px", marginTop:"2px" }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
