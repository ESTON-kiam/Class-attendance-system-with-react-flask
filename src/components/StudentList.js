import React, { useState, useEffect } from "react";
import api from "../api";
import toast from "react-hot-toast";

export default function StudentList() {
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  const load = async () => {
    setLoading(true);
    try { const r = await api.get("/api/students"); setStudents(r.data); }
    catch { toast.error("Failed to load students"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (uid, name) => {
    if (!window.confirm(`Remove ${name} from the system?`)) return;
    try {
      await api.delete(`/api/students/${uid}`);
      toast.success(`${name} removed`);
      load();
    } catch { toast.error("Failed to remove student"); }
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.studentId.toLowerCase().includes(search.toLowerCase()) ||
    s.course.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-wrap">
      <div className="page-wrap-header">
        <span className="page-wrap-icon">🎓</span>
        <span className="page-wrap-title">Registered Students</span>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-value">{students.length}</div><div className="stat-label">Total Students</div></div>
        <div className="stat-card"><div className="stat-value">{[...new Set(students.map(s=>s.course))].length}</div><div className="stat-label">Courses</div></div>
        <div className="stat-card"><div className="stat-value">{filtered.length}</div><div className="stat-label">Showing</div></div>
      </div>

      <div className="card">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <div className="card-title" style={{marginBottom:0}}>👥 All Students</div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search name, ID, course..."
            style={{ width:"260px", fontSize:"13px" }}
          />
        </div>

        {loading ? (
          <div className="loading"><span className="spinner"/>Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="icon">🎓</div><p>{search ? "No students match your search" : "No students registered yet"}</p></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Course</th><th>Registered</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id}>
                  <td style={{color:"var(--text3)",fontFamily:"monospace",fontSize:"12px"}}>{String(i+1).padStart(2,"0")}</td>
                  <td style={{fontFamily:"monospace",fontSize:"13px",color:"var(--accent)"}}>{s.studentId}</td>
                  <td style={{fontWeight:600,color:"var(--text)"}}>{s.name}</td>
                  <td>{s.course}</td>
                  <td style={{fontSize:"12px"}}>{new Date(s.registeredAt).toLocaleDateString("en-US",{day:"numeric",month:"short",year:"numeric"})}</td>
                  <td><span className="badge badge-success">✓ Active</span></td>
                  <td><button className="btn btn-danger" style={{padding:"6px 12px",fontSize:"12px"}} onClick={()=>remove(s.id,s.name)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
