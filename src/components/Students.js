import React, { useState, useEffect } from 'react';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/students');
      const d = await r.json();
      setStudents(d.students || []);
    } catch { setToast({msg:'Could not load students',type:'error'}); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const remove = async (sid, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await fetch(`/api/students/${sid}`, {method:'DELETE'});
      setToast({msg:`${name} removed`, type:'success'});
      load();
    } catch { setToast({msg:'Error removing student', type:'error'}); }
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id.toLowerCase().includes(search.toLowerCase()) ||
    s.course.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-wide">
      <h1 className="page-title">Registered Students</h1>
      <p className="page-sub">Manage all students in the biometric attendance system.</p>

      <div className="stats">
        <div className="stat"><div className="stat-val" style={{color:'var(--accent)'}}>{students.length}</div><div className="stat-lbl">Total Students</div></div>
        <div className="stat"><div className="stat-val" style={{color:'var(--accent2)'}}>{[...new Set(students.map(s=>s.course))].length}</div><div className="stat-lbl">Courses</div></div>
        <div className="stat"><div className="stat-val" style={{color:'var(--yellow)'}}>{students.filter(s=>s.face_encoding).length || '—'}</div><div className="stat-lbl">With Face Data</div></div>
      </div>

      <div className="panel">
        <div style={{display:'flex', gap:12, marginBottom:20, alignItems:'center'}}>
          <input placeholder="🔍 Search by name, ID or course…" value={search}
            onChange={e=>setSearch(e.target.value)}
            style={{flex:1, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10,
              padding:'9px 14px', color:'var(--text)', fontFamily:'var(--font)', fontSize:'.9rem', outline:'none'}} />
          <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
        </div>

        {loading ? (
          <p style={{textAlign:'center', color:'var(--text2)', padding:'40px 0'}}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{textAlign:'center', color:'var(--text2)', padding:'40px 0'}}>
            {students.length === 0 ? 'No students registered yet.' : 'No matches found.'}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Course</th>
                  <th>Registered</th>
                  <th>Face</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.student_id}>
                    <td><span className="mono">{s.student_id}</span></td>
                    <td style={{fontWeight:500}}>{s.name}</td>
                    <td><span className="tag">{s.course}</span></td>
                    <td style={{color:'var(--text2)', fontSize:'.8rem'}}>
                      {s.registered_at ? new Date(s.registered_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <span style={{fontSize:'1rem'}}>{s.face_encoding ? '✅' : '⚠️'}</span>
                    </td>
                    <td>
                      <button className="btn btn-danger" style={{padding:'5px 12px', fontSize:'.8rem'}}
                        onClick={() => remove(s.student_id, s.name)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`} onClick={()=>setToast(null)}>{toast.msg}</div>}
    </div>
  );
}
