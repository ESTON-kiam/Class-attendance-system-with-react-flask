import React, { useState, useEffect } from "react";
import axios from "axios";

export default function AttendanceLog() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState("default");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    axios.get("/api/attendance/sessions").then((res) => setSessions(res.data)).catch(() => {});
    axios.get("/api/students").then((res) => setTotalStudents(res.data.length)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`/api/attendance?sessionId=${selectedSession}&date=${date}`)
      .then((res) => setRecords(res.data.records || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [selectedSession, date]);

  const attendanceRate = totalStudents > 0 ? Math.round((records.length / totalStudents) * 100) : 0;

  const exportCSV = () => {
    if (!records.length) return;
    const headers = ["Student ID", "Name", "Course", "Time", "Date"];
    const rows = records.map((r) => [r.studentId, r.name, r.course, r.time, r.date]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${selectedSession}_${date}.csv`;
    a.click();
  };

  return (
    <div>
      {/* Controls */}
      <div className="card mb-6">
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group">
            <label>Session</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              style={{ width: "220px" }}
            >
              <option value="default">default</option>
              {sessions.filter((s) => s !== "default").map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: "180px" }}
            />
          </div>
          <button className="btn btn-secondary" onClick={exportCSV} disabled={!records.length}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row mb-6">
        <div className="stat-card">
          <div className="stat-value">{records.length}</div>
          <div className="stat-label">Present</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalStudents - records.length}</div>
          <div className="stat-label">Absent</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: attendanceRate >= 70 ? "var(--success)" : "var(--danger)" }}>
            {attendanceRate}%
          </div>
          <div className="stat-label">Attendance Rate</div>
        </div>
      </div>

      {/* Attendance bar */}
      {totalStudents > 0 && (
        <div className="card mb-6">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px" }}>
            <span style={{ color: "var(--text2)" }}>Attendance Progress</span>
            <span style={{ fontFamily: "Space Mono, monospace", color: "var(--accent)" }}>
              {records.length} / {totalStudents}
            </span>
          </div>
          <div style={{ background: "var(--bg3)", borderRadius: "8px", height: "10px", overflow: "hidden" }}>
            <div style={{
              width: `${attendanceRate}%`, height: "100%",
              background: `linear-gradient(90deg, var(--accent2), var(--accent))`,
              borderRadius: "8px",
              transition: "width 0.6s ease",
              boxShadow: "0 0 12px var(--glow)",
            }} />
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="card">
        <div className="card-title">📋 Attendance Records</div>

        {loading ? (
          <div className="loading"><span className="spinner" /> Loading...</div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <p>No attendance records for this session and date</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student ID</th>
                <th>Name</th>
                <th>Course</th>
                <th>Check-in Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "Space Mono, monospace", fontSize: "12px", color: "var(--text3)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td style={{ fontFamily: "Space Mono, monospace", fontSize: "13px", color: "var(--accent)" }}>
                    {r.studentId}
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--text)" }}>{r.name}</td>
                  <td>{r.course}</td>
                  <td style={{ fontFamily: "Space Mono, monospace", fontSize: "13px" }}>{r.time}</td>
                  <td><span className="badge badge-success">✓ Present</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
