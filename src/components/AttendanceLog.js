import React, { useState, useEffect } from "react";
import api from "../api";

export default function AttendanceLog() {
  const [sessions,   setSessions]   = useState([]);
  const [session,    setSession]    = useState("default");
  const [date,       setDate]       = useState(new Date().toISOString().split("T")[0]);
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [totalStudents, setTotal]   = useState(0);

  useEffect(() => {
    api.get("/api/attendance/sessions").then(r => setSessions(r.data)).catch(()=>{});
    api.get("/api/students").then(r => setTotal(r.data.length)).catch(()=>{});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/attendance?sessionId=${session}&date=${date}`)
      .then(r => setRecords(r.data.records || []))
      .catch(()=>setRecords([]))
      .finally(()=>setLoading(false));
  }, [session, date]);

  const rate = totalStudents > 0 ? Math.round((records.length / totalStudents) * 100) : 0;

  const exportCSV = () => {
    if (!records.length) return;
    const rows = [["Student ID","Name","Course","Time","Date"], ...records.map(r=>[r.studentId,r.name,r.course,r.time,r.date])];
    const csv  = rows.map(r=>r.join(",")).join("\n");
    const a    = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv],{type:"text/csv"})), download:`attendance_${session}_${date}.csv` });
    a.click();
  };

  return (
    <div className="page-wrap">
      <div className="page-wrap-header">
        <span className="page-wrap-icon">📋</span>
        <span className="page-wrap-title">Attendance Log</span>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div style={{ display:"flex", gap:"16px", alignItems:"flex-end", flexWrap:"wrap" }}>
          <div className="form-group">
            <label>Session</label>
            <select value={session} onChange={e=>setSession(e.target.value)} style={{width:"200px"}}>
              <option value="default">default</option>
              {sessions.filter(s=>s!=="default").map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:"170px"}}/>
          </div>
          <button className="btn btn-secondary" onClick={exportCSV} disabled={!records.length}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card"><div className="stat-value">{records.length}</div><div className="stat-label">Present</div></div>
        <div className="stat-card"><div className="stat-value">{Math.max(0, totalStudents - records.length)}</div><div className="stat-label">Absent</div></div>
        <div className="stat-card"><div className="stat-value" style={{color: rate>=70?"var(--success)":"var(--danger)"}}>{rate}%</div><div className="stat-label">Attendance Rate</div></div>
      </div>

      {/* Progress bar */}
      {totalStudents > 0 && (
        <div className="card mb-6">
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"10px",fontSize:"14px"}}>
            <span style={{color:"var(--text2)"}}>Attendance Progress</span>
            <span style={{fontFamily:"monospace",color:"var(--accent)"}}>{records.length} / {totalStudents}</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{width:`${rate}%`}}/></div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="card-title">📋 Records</div>
        {loading ? (
          <div className="loading"><span className="spinner"/>Loading...</div>
        ) : records.length === 0 ? (
          <div className="empty-state"><div className="icon">📭</div><p>No records for this session and date</p></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Course</th><th>Time</th><th>Status</th></tr></thead>
            <tbody>
              {records.map((r,i)=>(
                <tr key={i}>
                  <td style={{fontFamily:"monospace",fontSize:"12px",color:"var(--text3)"}}>{String(i+1).padStart(2,"0")}</td>
                  <td style={{fontFamily:"monospace",fontSize:"13px",color:"var(--accent)"}}>{r.studentId}</td>
                  <td style={{fontWeight:600,color:"var(--text)"}}>{r.name}</td>
                  <td>{r.course}</td>
                  <td style={{fontFamily:"monospace",fontSize:"13px"}}>{r.time}</td>
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
