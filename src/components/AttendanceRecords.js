import React, { useState, useEffect } from 'react';

export default function AttendanceRecords() {
  const [records, setRecords] = useState([]);
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/attendance/dates').then(r=>r.json()).then(d=>setDates(d.dates||[]));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/attendance?date=${selectedDate}`)
      .then(r=>r.json())
      .then(d=>setRecords(d.records||[]))
      .finally(()=>setLoading(false));
  }, [selectedDate]);

  const shown = records.filter(r => filter==='all' || r.status===filter);
  const present = records.filter(r=>r.status==='present').length;
  const absent = records.filter(r=>r.status==='absent').length;
  const pct = records.length ? Math.round(present/records.length*100) : 0;

  const exportCSV = () => {
    const hdr = 'Student ID,Name,Course,Time,Status\n';
    const rows = records.map(r=>`${r.student_id},"${r.name}","${r.course}",${r.time||'—'},${r.status}`).join('\n');
    const blob = new Blob([hdr+rows], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_${selectedDate}.csv`;
    a.click();
  };

  return (
    <div className="page-wide">
      <h1 className="page-title">Attendance Records</h1>
      <p className="page-sub">View and export daily attendance logs.</p>

      <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:24, flexWrap:'wrap'}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <label style={{fontSize:'.8rem', color:'var(--text2)', fontWeight:600}}>DATE</label>
          <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}
            style={{background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10,
              padding:'8px 12px', color:'var(--text)', fontFamily:'var(--font)', fontSize:'.9rem', outline:'none'}} />
        </div>
        {dates.length>0 && (
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            {dates.slice(0,5).map(d => (
              <button key={d} onClick={()=>setSelectedDate(d)}
                className={`btn ${d===selectedDate?'btn-primary':'btn-secondary'}`}
                style={{padding:'6px 12px', fontSize:'.8rem'}}>
                {d}
              </button>
            ))}
          </div>
        )}
        <button className="btn btn-secondary" onClick={exportCSV} style={{marginLeft:'auto'}}>⬇ Export CSV</button>
      </div>

      <div className="stats">
        <div className="stat"><div className="stat-val">{records.length}</div><div className="stat-lbl">Total Students</div></div>
        <div className="stat"><div className="stat-val" style={{color:'var(--accent)'}}>{present}</div><div className="stat-lbl">Present</div></div>
        <div className="stat"><div className="stat-val" style={{color:'var(--red)'}}>{absent}</div><div className="stat-lbl">Absent</div></div>
        <div className="stat">
          <div className="stat-val" style={{color: pct>=75?'var(--accent)':pct>=50?'var(--yellow)':'var(--red)'}}>{pct}%</div>
          <div className="stat-lbl">Attendance Rate</div>
        </div>
      </div>

      <div className="panel">
        <div style={{display:'flex', gap:8, marginBottom:16}}>
          {['all','present','absent'].map(f => (
            <button key={f} className={`btn ${filter===f?'btn-primary':'btn-secondary'}`}
              style={{padding:'6px 16px', fontSize:'.85rem', textTransform:'capitalize'}}
              onClick={()=>setFilter(f)}>
              {f} {f!=='all' && `(${records.filter(r=>r.status===f).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{textAlign:'center', color:'var(--text2)', padding:'40px 0'}}>Loading…</p>
        ) : shown.length === 0 ? (
          <p style={{textAlign:'center', color:'var(--text2)', padding:'40px 0'}}>No records for this date.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student ID</th><th>Name</th><th>Course</th><th>Time</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.student_id}>
                    <td><span className="mono">{r.student_id}</span></td>
                    <td style={{fontWeight:500}}>{r.name}</td>
                    <td><span className="tag">{r.course}</span></td>
                    <td style={{color:'var(--text2)', fontSize:'.85rem', fontFamily:'var(--mono)'}}>
                      {r.time ? new Date(r.time).toLocaleTimeString() : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${r.status}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
