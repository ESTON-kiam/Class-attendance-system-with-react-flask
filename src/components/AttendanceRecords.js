import React, { useState, useEffect } from 'react';

function loadXLSX() {
  return new Promise(resolve => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    document.head.appendChild(s);
  });
}

const API = 'http://localhost:5000';

export default function AttendanceRecords() {
  const [tab, setTab] = useState('daily');

  // shared data
  const [units,   setUnits]   = useState([]);
  const [weeks,   setWeeks]   = useState([]);
  const [sessions,setSessions]= useState([]);  // raw session names from CSV files

  // daily view
  const [dUnit,   setDUnit]   = useState('');
  const [dWeek,   setDWeek]   = useState('');
  const [dDate,   setDDate]   = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // semester export
  const [eUnit,   setEUnit]   = useState('');
  const [eFrom,   setEFrom]   = useState('');
  const [eTo,     setETo]     = useState('');
  const [preview, setPreview] = useState(null);
  const [exporting,setExporting]=useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  // Load units, weeks, sessions on mount
  useEffect(() => {
    fetch(`${API}/api/units`).then(r=>r.json()).then(d=>setUnits(Array.isArray(d)?d:[])).catch(()=>{});
    fetch(`${API}/api/weeks`).then(r=>r.json()).then(d=>setWeeks(Array.isArray(d)?d:[])).catch(()=>{});
    fetch(`${API}/api/attendance/sessions`).then(r=>r.json()).then(d=>setSessions(Array.isArray(d)?d:[])).catch(()=>{});
  }, []);

  // Daily: load records when unit/week/date changes
  useEffect(() => {
    if (!dUnit && !dWeek) { setRecords([]); return; }
    const sessionId = dWeek || dUnit;
    setLoading(true);
    fetch(`${API}/api/attendance?sessionId=${encodeURIComponent(sessionId)}&date=${dDate}`)
      .then(r=>r.json()).then(d=>setRecords(d.records||[]))
      .catch(()=>setRecords([])).finally(()=>setLoading(false));
  }, [dUnit, dWeek, dDate]);

  const exportDailyCSV = () => {
    if (!records.length) return;
    const hdr  = 'Student ID,Name,Course Unit,Time,Date\n';
    const rows = records.map(r=>`${r.studentId},"${r.name}","${r.course}",${r.time},${r.date}`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([hdr+rows],{type:'text/csv'}));
    a.download = `attendance_${dUnit}_${dWeek}_${dDate}.csv`;
    a.click();
  };

  // Semester: load preview
  const loadPreview = async () => {
    if (!eUnit) { showToast('Select a course unit first','error'); return; }
    if (!eFrom||!eTo) { showToast('Select date range','error'); return; }
    if (eFrom>eTo)    { showToast('Start must be before end','error'); return; }
    setExporting(true);
    try {
      const r = await fetch(`${API}/api/attendance/export?date_from=${eFrom}&date_to=${eTo}&session=all`);
      const d = await r.json();
      if (!r.ok) { showToast(d.error||'Error','error'); return; }
      // Filter to selected course unit only
      const filtered = d.records.filter(rec => rec.course === eUnit);
      setPreview({ ...d, records: filtered, total: filtered.length,
        unique_students: new Set(filtered.map(r=>r.studentId)).size });
    } catch { showToast('Network error','error'); }
    finally { setExporting(false); }
  };

  // Excel export — one sheet per week, rows = students, cols = dates within that week
  const exportExcel = async () => {
    if (!preview?.records?.length) { showToast('No records to export','error'); return; }
    setExporting(true);
    try {
      const XLSX = await loadXLSX();
      const wb   = XLSX.utils.book_new();
      const recs = preview.records;

      // All unique sorted dates
      const allDates = [...new Set(recs.map(r=>r.date))].sort();

      // All unique students
      const studentsMap = {};
      recs.forEach(r => {
        if (!studentsMap[r.studentId])
          studentsMap[r.studentId] = { name:r.name, course:r.course, dates:{} };
        studentsMap[r.studentId].dates[r.date] = r.time || '✓';
      });

      // Group dates by week label (match to weeks from backend)
      // Each "session" in recs corresponds to a week label
      const weekLabels = [...new Set(recs.map(r=>r.session))].sort();

      // ── Sheet 1: Full Attendance Matrix (all weeks combined) ──
      const header = ['#','Student ID','Name','Course Unit', ...allDates, 'Days Present','Attendance %'];
      const rows = Object.entries(studentsMap)
        .sort((a,b)=>a[1].name.localeCompare(b[1].name))
        .map(([sid,s],i)=>{
          const present = allDates.filter(d=>s.dates[d]).length;
          const pct = allDates.length ? Math.round(present/allDates.length*100)+'%' : '0%';
          return [i+1, sid, s.name, s.course, ...allDates.map(d=>s.dates[d]?'✓':''), present, pct];
        });

      const wsAll = XLSX.utils.aoa_to_sheet([header,...rows]);
      wsAll['!cols'] = [
        {wch:4},{wch:16},{wch:26},{wch:28},
        ...allDates.map(()=>({wch:11})),
        {wch:14},{wch:14}
      ];
      XLSX.utils.book_append_sheet(wb, wsAll, 'Full Semester');

      // ── One sheet per week ──
      weekLabels.forEach(weekLabel => {
        const weekRecs  = recs.filter(r=>r.session===weekLabel);
        const weekDates = [...new Set(weekRecs.map(r=>r.date))].sort();
        const weekStudents = {};
        weekRecs.forEach(r => {
          if (!weekStudents[r.studentId])
            weekStudents[r.studentId] = { name:r.name, course:r.course, dates:{} };
          weekStudents[r.studentId].dates[r.date] = '✓';
        });

        const wHeader = ['#','Student ID','Name','Course Unit', ...weekDates, 'Days Present'];
        const wRows = Object.entries(weekStudents)
          .sort((a,b)=>a[1].name.localeCompare(b[1].name))
          .map(([sid,s],i)=>{
            const present = weekDates.filter(d=>s.dates[d]).length;
            return [i+1, sid, s.name, s.course, ...weekDates.map(d=>s.dates[d]?'✓':''), present];
          });

        const ws = XLSX.utils.aoa_to_sheet([wHeader,...wRows]);
        ws['!cols'] = [{wch:4},{wch:16},{wch:26},{wch:28},...weekDates.map(()=>({wch:11})),{wch:12}];
        // Sheet name: clean up label to be Excel-safe (max 31 chars)
        const sheetName = weekLabel.replace(/[\\/:*?[\]]/g,'').slice(0,31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      // ── Summary sheet ──
      const summaryRows = [
        [`${eUnit} — Semester Attendance Report`],
        [],
        ['Course Unit',   eUnit],
        ['Period',        `${eFrom}  to  ${eTo}`],
        ['Generated On',  new Date().toLocaleString()],
        [],
        ['Total Records',   preview.total],
        ['Unique Students', preview.unique_students],
        ['Class Days',      allDates.length],
        ['Weeks Covered',   weekLabels.join(', ')],
        [],
        ['Week', 'Dates', 'Students Present'],
        ...weekLabels.map(w => {
          const wr    = recs.filter(r=>r.session===w);
          const dates = [...new Set(wr.map(r=>r.date))].sort();
          return [w, dates.join(', '), new Set(wr.map(r=>r.studentId)).size];
        })
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary['!cols'] = [{wch:28},{wch:40},{wch:18}];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      XLSX.writeFile(wb, `${eUnit.replace(/\s+/g,'_')}_Attendance_${eFrom}_to_${eTo}.xlsx`);
      showToast(`✓ Excel downloaded! ${preview.unique_students} students, ${weekLabels.length} weeks`);
    } catch(e) {
      showToast('Export failed: '+e.message, 'error');
    } finally { setExporting(false); }
  };

  // Helper: sessions that match a unit name (for daily view dropdown)
  const unitSessions = sessions.filter(s =>
    dUnit ? s.toLowerCase().includes(dUnit.toLowerCase()) || weeks.some(w=>w.label===s) : true
  );

  return (
    <div className="page-wide">
      <h1 className="page-title">Attendance Records</h1>
      <p className="page-sub">View daily logs or export a full semester report as Excel.</p>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:24}}>
        <button className={`btn ${tab==='daily'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('daily')}>📅 Daily View</button>
        <button className={`btn ${tab==='export'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('export')}>📊 Semester Export</button>
      </div>

      {/* ══════════ DAILY VIEW ══════════ */}
      {tab==='daily' && (<>
        <div className="panel">
          <div className="panel-title">🔍 Filter Records</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
            <div className="form-group" style={{marginBottom:0}}>
              <label>Course Unit</label>
              <select value={dUnit} onChange={e=>{setDUnit(e.target.value);setDWeek('');}}>
                <option value="">— All Units —</option>
                {units.map(u=><option key={u.id} value={u.name}>{u.code} — {u.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label>Week / Session</label>
              <select value={dWeek} onChange={e=>setDWeek(e.target.value)}>
                <option value="">— All Weeks —</option>
                {weeks.map(w=>(
                  <option key={w.id} value={w.label}>{w.label}{w.dates?` (${w.dates})`:''}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label>Date</label>
              <input type="date" value={dDate} onChange={e=>setDDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="stats">
          <div className="stat"><div className="stat-val">{records.length}</div><div className="stat-lbl">Present</div></div>
          <div className="stat"><div className="stat-val" style={{color:'var(--accent)',fontSize:15,paddingTop:8}}>{dUnit||'All Units'}</div><div className="stat-lbl">Course Unit</div></div>
          <div className="stat"><div className="stat-val" style={{color:'var(--purple)',fontSize:15,paddingTop:8}}>{dWeek||'All Weeks'}</div><div className="stat-lbl">Week</div></div>
        </div>

        <div className="panel">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div className="panel-title" style={{marginBottom:0}}>📋 Records</div>
            <button className="btn btn-secondary" style={{padding:'7px 16px',fontSize:'.85rem'}}
              onClick={exportDailyCSV} disabled={!records.length}>⬇ Export CSV</button>
          </div>
          {loading ? (
            <p style={{textAlign:'center',color:'var(--text2)',padding:'40px 0'}}>Loading…</p>
          ) : records.length===0 ? (
            <p style={{textAlign:'center',color:'var(--text2)',padding:'40px 0'}}>No records found for the selected filters.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Course Unit</th><th>Session</th><th>Time</th><th>Status</th></tr></thead>
                <tbody>
                  {records.map((r,i)=>(
                    <tr key={i}>
                      <td style={{color:'var(--text3)',fontSize:'.8rem'}}>{String(i+1).padStart(2,'0')}</td>
                      <td><span className="mono">{r.studentId}</span></td>
                      <td style={{fontWeight:500}}>{r.name}</td>
                      <td><span className="tag">{r.course}</span></td>
                      <td style={{color:'var(--text2)',fontSize:'.85rem'}}>{r.date}</td>
                      <td style={{fontFamily:'monospace',fontSize:'.85rem',color:'var(--text2)'}}>{r.time}</td>
                      <td><span className="badge badge-present">✓ Present</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>)}

      {/* ══════════ SEMESTER EXPORT ══════════ */}
      {tab==='export' && (
        <div>
          <div className="panel">
            <div className="panel-title">📊 Semester Export</div>

            {/* Step 1: Pick course unit */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:'.78rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'.7px',color:'var(--text2)',marginBottom:8}}>
                STEP 1 — Select Course Unit to Export
              </div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                {units.length===0 && <p style={{color:'var(--text3)',fontSize:'.85rem'}}>No units added yet.</p>}
                {units.map(u=>(
                  <button key={u.id}
                    onClick={()=>setEUnit(u.name)}
                    style={{
                      padding:'8px 18px', borderRadius:10, border:'none', cursor:'pointer',
                      fontFamily:'var(--font)', fontSize:'.85rem', fontWeight:600,
                      background: eUnit===u.name ? 'linear-gradient(135deg,var(--accent),#00b894)' : 'var(--bg3)',
                      color: eUnit===u.name ? '#000' : 'var(--text2)',
                      border: eUnit===u.name ? 'none' : '1px solid var(--border)',
                      transition:'all .18s',
                    }}>
                    {u.code} — {u.name}
                  </button>
                ))}
              </div>
              {eUnit && (
                <div style={{marginTop:10,fontSize:'.82rem',color:'var(--accent)'}}>
                  ✓ Exporting: <strong>{eUnit}</strong>
                </div>
              )}
            </div>

            {/* Step 2: Date range */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:'.78rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'.7px',color:'var(--text2)',marginBottom:8}}>
                STEP 2 — Select Date Range
              </div>
              <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap'}}>
                <div className="form-group" style={{marginBottom:0}}>
                  <label>From</label>
                  <input type="date" value={eFrom} onChange={e=>setEFrom(e.target.value)} />
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label>To</label>
                  <input type="date" value={eTo} onChange={e=>setETo(e.target.value)} />
                </div>
                {/* Quick picks */}
                <div style={{display:'flex',gap:8,flexWrap:'wrap',paddingBottom:2}}>
                  {[
                    {label:'This Month',    fn:()=>{const n=new Date();setEFrom(n.toISOString().slice(0,8)+'01');setETo(n.toISOString().slice(0,10));}},
                    {label:'Last 3 Months',fn:()=>{const n=new Date(),f=new Date(n);f.setMonth(f.getMonth()-3);setEFrom(f.toISOString().slice(0,10));setETo(n.toISOString().slice(0,10));}},
                    {label:'Sem 1 Jan–Jun',fn:()=>{const y=new Date().getFullYear();setEFrom(`${y}-01-01`);setETo(`${y}-06-30`);}},
                    {label:'Sem 2 Jul–Dec',fn:()=>{const y=new Date().getFullYear();setEFrom(`${y}-07-01`);setETo(`${y}-12-31`);}},
                  ].map(({label,fn})=>(
                    <button key={label} className="btn btn-secondary" style={{padding:'6px 12px',fontSize:'.8rem'}} onClick={fn}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-purple" onClick={loadPreview} disabled={exporting||!eUnit||!eFrom||!eTo}
                style={{flex:1,justifyContent:'center'}}>
                {exporting?'⏳ Loading…':'🔍 Preview Records'}
              </button>
              {preview?.records?.length>0 && (
                <button className="btn btn-primary" onClick={exportExcel} disabled={exporting}
                  style={{flex:1,justifyContent:'center'}}>
                  {exporting?'⏳ Generating…':'📥 Download Excel (.xlsx)'}
                </button>
              )}
            </div>
          </div>

          {/* Excel structure preview */}
          <div className="panel" style={{background:'rgba(124,106,247,.05)',border:'1px solid rgba(124,106,247,.15)'}}>
            <div className="panel-title" style={{color:'var(--purple)'}}>📋 Excel Sheets Structure</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
              {[
                {icon:'📊',title:'Full Semester',  desc:'All weeks combined — students × all dates with ✓ ticks'},
                {icon:'📅',title:'Week 1, Week 2…',desc:'One sheet per week — students × dates of that week'},
                {icon:'📋',title:'Summary',         desc:'Totals, weeks covered, per-week student count'},
              ].map(s=>(
                <div key={s.title} style={{background:'var(--bg2)',borderRadius:10,padding:'14px 16px',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
                  <div style={{fontWeight:600,fontSize:'.9rem',marginBottom:4}}>{s.title}</div>
                  <div style={{fontSize:'.78rem',color:'var(--text3)',lineHeight:1.5}}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview results */}
          {preview && (<>
            <div className="stats">
              <div className="stat"><div className="stat-val">{preview.unique_students}</div><div className="stat-lbl">Students</div></div>
              <div className="stat"><div className="stat-val" style={{color:'var(--accent)'}}>{[...new Set(preview.records.map(r=>r.date))].length}</div><div className="stat-lbl">Class Days</div></div>
              <div className="stat"><div className="stat-val" style={{color:'var(--purple)'}}>{[...new Set(preview.records.map(r=>r.session))].length}</div><div className="stat-lbl">Weeks</div></div>
              <div className="stat"><div className="stat-val" style={{color:'var(--yellow)'}}>{preview.total}</div><div className="stat-lbl">Records</div></div>
            </div>

            {preview.records.length===0 ? (
              <div className="panel" style={{textAlign:'center',color:'var(--text2)',padding:'40px'}}>
                No records found for <strong>{eUnit}</strong> in this date range.
              </div>
            ) : (
              <div className="panel">
                <div className="panel-title">
                  Preview — {eUnit}
                  <span style={{marginLeft:'auto',fontSize:12,color:'var(--text3)'}}>{eFrom} → {eTo}</span>
                </div>
                <div className="table-wrap" style={{maxHeight:320,overflowY:'auto'}}>
                  <table>
                    <thead><tr><th>Week/Session</th><th>Date</th><th>Student ID</th><th>Name</th><th>Time</th></tr></thead>
                    <tbody>
                      {preview.records.map((r,i)=>(
                        <tr key={i}>
                          <td><span className="tag">{r.session}</span></td>
                          <td style={{fontFamily:'monospace',fontSize:'.85rem'}}>{r.date}</td>
                          <td><span className="mono">{r.studentId}</span></td>
                          <td style={{fontWeight:500}}>{r.name}</td>
                          <td style={{fontFamily:'monospace',fontSize:'.85rem',color:'var(--text2)'}}>{r.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>)}
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`} onClick={()=>setToast(null)}>{toast.msg}</div>}
    </div>
  );
}
