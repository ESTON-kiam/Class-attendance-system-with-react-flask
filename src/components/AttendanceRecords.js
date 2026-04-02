import React, { useState, useEffect } from 'react';

/* ── tiny SheetJS loader (CDN, no npm install needed) ── */
function loadXLSX() {
  return new Promise((resolve) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    document.head.appendChild(s);
  });
}

/* ── helpers ── */
const fmt = d => d ? new Date(d).toLocaleDateString() : '—';
const API = 'http://localhost:5000';

export default function AttendanceRecords() {
  /* daily view state */
  const [records,      setRecords]      = useState([]);
  const [sessions,     setSessions]     = useState([]);
  const [session,      setSession]      = useState('default');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading,      setLoading]      = useState(false);

  /* semester export state */
  const [showExport,   setShowExport]   = useState(false);
  const [expSession,   setExpSession]   = useState('all');
  const [expFrom,      setExpFrom]      = useState('');
  const [expTo,        setExpTo]        = useState('');
  const [expLoading,   setExpLoading]   = useState(false);
  const [expPreview,   setExpPreview]   = useState(null);   // {records, total, unique_students, sessions_covered}
  const [toast,        setToast]        = useState(null);

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  /* load sessions list */
  useEffect(() => {
    fetch(`${API}/api/attendance/sessions`)
      .then(r=>r.json()).then(d=>setSessions(Array.isArray(d)?d:[])).catch(()=>{});
  }, []);

  /* load daily records */
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/attendance?sessionId=${session}&date=${selectedDate}`)
      .then(r=>r.json())
      .then(d=>setRecords(d.records||[]))
      .catch(()=>setRecords([]))
      .finally(()=>setLoading(false));
  }, [session, selectedDate]);

  /* ── daily CSV ── */
  const exportDailyCSV = () => {
    const hdr  = 'Student ID,Name,Course,Time,Date\n';
    const rows = records.map(r=>`${r.studentId},"${r.name}","${r.course}",${r.time},${r.date}`).join('\n');
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([hdr+rows],{type:'text/csv'}));
    a.download = `attendance_${session}_${selectedDate}.csv`;
    a.click();
  };

  /* ── semester preview ── */
  const loadSemesterPreview = async () => {
    if (!expFrom || !expTo) { showToast('Select both start and end dates','error'); return; }
    if (expFrom > expTo)    { showToast('Start date must be before end date','error'); return; }
    setExpLoading(true);
    try {
      const r = await fetch(`${API}/api/attendance/export?date_from=${expFrom}&date_to=${expTo}&session=${expSession}`);
      const d = await r.json();
      if (!r.ok) { showToast(d.error||'Failed to load','error'); return; }
      setExpPreview(d);
    } catch { showToast('Network error','error'); }
    finally { setExpLoading(false); }
  };

  /* ── Excel export ── */
  const exportExcel = async () => {
    if (!expPreview || !expPreview.records.length) { showToast('No records to export','error'); return; }
    setExpLoading(true);
    try {
      const XLSX = await loadXLSX();
      const wb   = XLSX.utils.book_new();

      /* ── Sheet 1: Raw Records ── */
      const rawData = [
        ['Session','Date','Student ID','Name','Course','Time In'],
        ...expPreview.records.map(r=>[r.session, r.date, r.studentId, r.name, r.course, r.time])
      ];
      const wsRaw = XLSX.utils.aoa_to_sheet(rawData);
      wsRaw['!cols'] = [14,12,16,24,28,10].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb, wsRaw, 'All Records');

      /* ── Sheet 2: Attendance Matrix (student x date) ── */
      const records  = expPreview.records;
      const students = {};
      const dates    = [...new Set(records.map(r=>r.date))].sort();
      records.forEach(r => {
        if (!students[r.studentId]) students[r.studentId] = { name:r.name, course:r.course, dates:{} };
        students[r.studentId].dates[r.date] = '✓';
      });
      const matrixHeader = ['Student ID','Name','Course', ...dates, 'Days Present','Attendance %'];
      const matrixRows   = Object.entries(students).map(([sid,s]) => {
        const present = dates.filter(d=>s.dates[d]).length;
        const pct     = dates.length ? Math.round(present/dates.length*100)+'%' : '—';
        return [sid, s.name, s.course, ...dates.map(d=>s.dates[d]||''), present, pct];
      });
      const wsMatrix = XLSX.utils.aoa_to_sheet([matrixHeader, ...matrixRows]);
      wsMatrix['!cols'] = [16,24,24,...dates.map(()=>({wch:12})),14,16].map((w,i)=>typeof w==='number'?{wch:w}:w);
      XLSX.utils.book_append_sheet(wb, wsMatrix, 'Attendance Matrix');

      /* ── Sheet 3: Summary ── */
      const summaryData = [
        ['FaceTrack Semester Attendance Report'],
        [],
        ['Date Range', `${expFrom}  →  ${expTo}`],
        ['Session Filter', expSession==='all'?'All Sessions':expSession],
        ['Generated On', new Date().toLocaleString()],
        [],
        ['Total Records',       expPreview.total],
        ['Unique Students',     expPreview.unique_students],
        ['Days Covered',        dates.length],
        ['Sessions Covered',    expPreview.sessions_covered.join(', ')],
        [],
        ['--- Per-Session Breakdown ---'],
        ['Session','Date','Students Present'],
        ...[...new Set(records.map(r=>`${r.session}|${r.date}`))].sort().map(key => {
          const [sess,date] = key.split('|');
          const count = records.filter(r=>r.session===sess && r.date===date).length;
          return [sess, date, count];
        })
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{wch:28},{wch:40},{wch:20}];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      /* ── Write file ── */
      XLSX.writeFile(wb, `semester_attendance_${expFrom}_to_${expTo}.xlsx`);
      showToast(`✓ Excel exported! ${expPreview.total} records, ${expPreview.unique_students} students`);
    } catch(e) {
      showToast('Export failed: '+e.message,'error');
    } finally { setExpLoading(false); }
  };

  /* ── RENDER ── */
  return (
    <div className="page-wide">
      <h1 className="page-title">Attendance Records</h1>
      <p className="page-sub">View daily logs or export a full semester report as Excel.</p>

      {/* ── Tab switcher ── */}
      <div style={{display:'flex',gap:8,marginBottom:24}}>
        <button className={`btn ${!showExport?'btn-primary':'btn-secondary'}`} onClick={()=>setShowExport(false)}>
          📅 Daily View
        </button>
        <button className={`btn ${showExport?'btn-primary':'btn-secondary'}`} onClick={()=>setShowExport(true)}>
          📊 Semester Export
        </button>
      </div>

      {/* ════════════════ DAILY VIEW ════════════════ */}
      {!showExport && (<>
        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:24,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <label style={{fontSize:'.8rem',color:'var(--text2)',fontWeight:600}}>SESSION</label>
            <select value={session} onChange={e=>setSession(e.target.value)}
              style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,
                padding:'8px 12px',color:'var(--text)',fontFamily:'var(--font)',fontSize:'.9rem',outline:'none'}}>
              <option value="default">default</option>
              {sessions.filter(s=>s!=='default').map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <label style={{fontSize:'.8rem',color:'var(--text2)',fontWeight:600}}>DATE</label>
            <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}
              style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,
                padding:'8px 12px',color:'var(--text)',fontFamily:'var(--font)',fontSize:'.9rem',outline:'none'}} />
          </div>
          <button className="btn btn-secondary" onClick={exportDailyCSV} disabled={!records.length} style={{marginLeft:'auto'}}>
            ⬇ Export CSV
          </button>
        </div>

        <div className="stats">
          <div className="stat"><div className="stat-val">{records.length}</div><div className="stat-lbl">Present</div></div>
          <div className="stat"><div className="stat-val" style={{color:'var(--accent)',fontSize:16,paddingTop:6}}>{session}</div><div className="stat-lbl">Session</div></div>
          <div className="stat"><div className="stat-val" style={{color:'var(--yellow)',fontSize:16,paddingTop:6}}>{selectedDate}</div><div className="stat-lbl">Date</div></div>
        </div>

        <div className="panel">
          {loading ? (
            <p style={{textAlign:'center',color:'var(--text2)',padding:'40px 0'}}>Loading…</p>
          ) : records.length===0 ? (
            <p style={{textAlign:'center',color:'var(--text2)',padding:'40px 0'}}>No records for this session and date.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Course</th><th>Time</th><th>Status</th></tr></thead>
                <tbody>
                  {records.map((r,i) => (
                    <tr key={i}>
                      <td style={{color:'var(--text3)',fontSize:'.8rem'}}>{String(i+1).padStart(2,'0')}</td>
                      <td><span className="mono">{r.studentId}</span></td>
                      <td style={{fontWeight:500}}>{r.name}</td>
                      <td><span className="tag">{r.course}</span></td>
                      <td style={{color:'var(--text2)',fontSize:'.85rem',fontFamily:'monospace'}}>{r.time}</td>
                      <td><span className="badge badge-present">✓ Present</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>)}

      {/* ════════════════ SEMESTER EXPORT ════════════════ */}
      {showExport && (
        <div>
          <div className="panel">
            <div className="panel-title">📊 Semester / Date Range Export</div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:20}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label>From Date</label>
                <input type="date" value={expFrom} onChange={e=>setExpFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>To Date</label>
                <input type="date" value={expTo} onChange={e=>setExpTo(e.target.value)} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Session Filter</label>
                <select value={expSession} onChange={e=>setExpSession(e.target.value)}>
                  <option value="all">All Sessions</option>
                  {sessions.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Quick-pick semester buttons */}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
              {[
                {label:'This Month',   fn:()=>{ const n=new Date(); setExpFrom(n.toISOString().slice(0,8)+'01'); setExpTo(n.toISOString().slice(0,10)); }},
                {label:'Last 3 Months',fn:()=>{ const n=new Date(),f=new Date(n); f.setMonth(f.getMonth()-3); setExpFrom(f.toISOString().slice(0,10)); setExpTo(n.toISOString().slice(0,10)); }},
                {label:'Sem 1 (Jan–Jun)',fn:()=>{ const y=new Date().getFullYear(); setExpFrom(`${y}-01-01`); setExpTo(`${y}-06-30`); }},
                {label:'Sem 2 (Jul–Dec)',fn:()=>{ const y=new Date().getFullYear(); setExpFrom(`${y}-07-01`); setExpTo(`${y}-12-31`); }},
                {label:'Full Year',    fn:()=>{ const y=new Date().getFullYear(); setExpFrom(`${y}-01-01`); setExpTo(`${y}-12-31`); }},
              ].map(({label,fn})=>(
                <button key={label} className="btn btn-secondary" style={{padding:'6px 14px',fontSize:'.82rem'}} onClick={fn}>{label}</button>
              ))}
            </div>

            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-purple" onClick={loadSemesterPreview} disabled={expLoading||!expFrom||!expTo} style={{flex:1,justifyContent:'center'}}>
                {expLoading ? '⏳ Loading…' : '🔍 Preview Records'}
              </button>
              {expPreview && expPreview.records.length>0 && (
                <button className="btn btn-primary" onClick={exportExcel} disabled={expLoading} style={{flex:1,justifyContent:'center'}}>
                  {expLoading ? '⏳ Generating…' : '📥 Download Excel (.xlsx)'}
                </button>
              )}
            </div>
          </div>

          {/* Preview stats */}
          {expPreview && (
            <>
              <div className="stats">
                <div className="stat"><div className="stat-val">{expPreview.total}</div><div className="stat-lbl">Total Records</div></div>
                <div className="stat"><div className="stat-val" style={{color:'var(--accent)'}}>{expPreview.unique_students}</div><div className="stat-lbl">Unique Students</div></div>
                <div className="stat"><div className="stat-val" style={{color:'var(--purple)'}}>{expPreview.sessions_covered.length}</div><div className="stat-lbl">Sessions</div></div>
              </div>

              {expPreview.records.length===0 ? (
                <div className="panel" style={{textAlign:'center',color:'var(--text2)',padding:'40px'}}>
                  No records found for this date range.
                </div>
              ) : (
                <div className="panel">
                  <div className="panel-title">
                    Preview — {expPreview.total} records ({expPreview.date_from} → {expPreview.date_to})
                    <span style={{marginLeft:'auto',fontSize:12,color:'var(--text3)'}}>Excel will have 3 sheets: All Records · Attendance Matrix · Summary</span>
                  </div>
                  <div className="table-wrap" style={{maxHeight:360,overflowY:'auto'}}>
                    <table>
                      <thead><tr><th>Session</th><th>Date</th><th>Student ID</th><th>Name</th><th>Course</th><th>Time</th></tr></thead>
                      <tbody>
                        {expPreview.records.map((r,i)=>(
                          <tr key={i}>
                            <td><span className="tag">{r.session}</span></td>
                            <td style={{fontFamily:'monospace',fontSize:'.85rem'}}>{r.date}</td>
                            <td><span className="mono">{r.studentId}</span></td>
                            <td style={{fontWeight:500}}>{r.name}</td>
                            <td style={{color:'var(--text2)'}}>{r.course}</td>
                            <td style={{fontFamily:'monospace',fontSize:'.85rem',color:'var(--text2)'}}>{r.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`} onClick={()=>setToast(null)}>{toast.msg}</div>}
    </div>
  );
}
