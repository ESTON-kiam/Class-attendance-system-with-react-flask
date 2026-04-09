import React, { useState, useEffect } from 'react';

const API = 'http://localhost:5000';

export default function Units() {
  const [tab, setTab] = useState('units');

  // Units state
  const [units,     setUnits]     = useState([]);
  const [uLoading,  setULoading]  = useState(true);
  const [uForm,     setUForm]     = useState({ code:'', name:'', lecturer:'' });
  const [uEditing,  setUEditing]  = useState(null);
  const [uShowForm, setUShowForm] = useState(false);
  const [uSaving,   setUSaving]   = useState(false);

  // Weeks state
  const [weeks,     setWeeks]     = useState([]);
  const [wLoading,  setWLoading]  = useState(true);
  const [wForm,     setWForm]     = useState({ label:'', dates:'', notes:'' });
  const [wEditing,  setWEditing]  = useState(null);
  const [wShowForm, setWShowForm] = useState(false);
  const [wSaving,   setWSaving]   = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  const loadUnits = async () => {
    setULoading(true);
    try { const r=await fetch(`${API}/api/units`); setUnits(await r.json()); }
    catch { showToast('Could not load units','error'); }
    finally { setULoading(false); }
  };

  const loadWeeks = async () => {
    setWLoading(true);
    try { const r=await fetch(`${API}/api/weeks`); setWeeks(await r.json()); }
    catch { showToast('Could not load weeks','error'); }
    finally { setWLoading(false); }
  };

  useEffect(() => { loadUnits(); loadWeeks(); }, []);

  // ── Units CRUD ──
  const openAddUnit = () => { setUEditing(null); setUForm({code:'',name:'',lecturer:''}); setUShowForm(true); };
  const openEditUnit = u => { setUEditing(u); setUForm({code:u.code,name:u.name,lecturer:u.lecturer||''}); setUShowForm(true); };
  const cancelUnit   = () => { setUShowForm(false); setUEditing(null); };

  const saveUnit = async () => {
    if (!uForm.code.trim()||!uForm.name.trim()) { showToast('Code and name required','error'); return; }
    setUSaving(true);
    try {
      const url    = uEditing ? `${API}/api/units/${uEditing.id}` : `${API}/api/units`;
      const method = uEditing ? 'PUT' : 'POST';
      const res    = await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(uForm)});
      const d      = await res.json();
      if (!res.ok) { showToast(d.error||'Failed','error'); return; }
      showToast(uEditing ? 'Unit updated!' : d.message);
      cancelUnit(); loadUnits();
    } catch { showToast('Network error','error'); }
    finally { setUSaving(false); }
  };

  const deleteUnit = async u => {
    if (!window.confirm(`Delete "${u.name}"?`)) return;
    await fetch(`${API}/api/units/${u.id}`,{method:'DELETE'});
    showToast(`"${u.name}" deleted`); loadUnits();
  };

  // ── Weeks CRUD ──
  const openAddWeek  = () => { setWEditing(null); setWForm({label:'',dates:'',notes:''}); setWShowForm(true); };
  const openEditWeek = w => { setWEditing(w); setWForm({label:w.label,dates:w.dates||'',notes:w.notes||''}); setWShowForm(true); };
  const cancelWeek   = () => { setWShowForm(false); setWEditing(null); };

  const saveWeek = async () => {
    if (!wForm.label.trim()) { showToast('Week label required','error'); return; }
    setWSaving(true);
    try {
      const url    = wEditing ? `${API}/api/weeks/${wEditing.id}` : `${API}/api/weeks`;
      const method = wEditing ? 'PUT' : 'POST';
      const res    = await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(wForm)});
      const d      = await res.json();
      if (!res.ok) { showToast(d.error||'Failed','error'); return; }
      showToast(wEditing ? 'Week updated!' : d.message);
      cancelWeek(); loadWeeks();
    } catch { showToast('Network error','error'); }
    finally { setWSaving(false); }
  };

  const deleteWeek = async w => {
    if (!window.confirm(`Delete "${w.label}"?`)) return;
    await fetch(`${API}/api/weeks/${w.id}`,{method:'DELETE'});
    showToast(`"${w.label}" deleted`); loadWeeks();
  };

  // Quick-generate weeks
  const generateWeeks = async (count) => {
    for (let i=1; i<=count; i++) {
      const label = `Week ${i}`;
      if (weeks.find(w=>w.label===label)) continue;
      await fetch(`${API}/api/weeks`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({label, dates:'', notes:''})
      });
    }
    showToast(`Generated ${count} weeks!`); loadWeeks();
  };

  return (
    <div className="page-wide">
      <h1 className="page-title">Course Units & Weeks</h1>
      <p className="page-sub">Manage course units and semester weeks used for attendance sessions.</p>

      {/* Tab switcher */}
      <div style={{display:'flex',gap:8,marginBottom:24}}>
        <button className={`btn ${tab==='units'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('units')}>📚 Course Units</button>
        <button className={`btn ${tab==='weeks'?'btn-primary':'btn-secondary'}`} onClick={()=>setTab('weeks')}>📅 Semester Weeks</button>
      </div>

      {/* ══ UNITS TAB ══ */}
      {tab==='units' && (<>
        <div className="stats">
          <div className="stat"><div className="stat-val" style={{color:'var(--accent)'}}>{units.length}</div><div className="stat-lbl">Total Units</div></div>
          <div className="stat"><div className="stat-val" style={{color:'var(--purple)'}}>{[...new Set(units.map(u=>u.lecturer).filter(Boolean))].length}</div><div className="stat-lbl">Lecturers</div></div>
          <div className="stat"><div className="stat-val" style={{color:'var(--yellow)'}}>{new Date().getFullYear()}</div><div className="stat-lbl">Academic Year</div></div>
        </div>

        {uShowForm && (
          <div className="panel" style={{border:'1px solid rgba(0,212,170,.25)',marginBottom:20}}>
            <div className="panel-title">{uEditing?'✏️ Edit Unit':'➕ Add New Unit'}</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Unit Code *</label>
                <input value={uForm.code} onChange={e=>setUForm({...uForm,code:e.target.value})} placeholder="e.g. CS301, SE204" />
              </div>
              <div className="form-group">
                <label>Unit Name *</label>
                <input value={uForm.name} onChange={e=>setUForm({...uForm,name:e.target.value})} placeholder="e.g. Software Engineering" />
              </div>
              <div className="form-group full">
                <label>Lecturer Name</label>
                <input value={uForm.lecturer} onChange={e=>setUForm({...uForm,lecturer:e.target.value})} placeholder="e.g. Dr. Jane Wanjiru" />
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:8}}>
              <button className="btn btn-primary" onClick={saveUnit} disabled={uSaving} style={{flex:1,justifyContent:'center'}}>
                {uSaving?'⏳ Saving…':uEditing?'💾 Save Changes':'✓ Add Unit'}
              </button>
              <button className="btn btn-secondary" onClick={cancelUnit}>✕ Cancel</button>
            </div>
          </div>
        )}

        <div className="panel">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <div className="panel-title" style={{marginBottom:0}}>📚 All Units</div>
            {!uShowForm && <button className="btn btn-primary" onClick={openAddUnit} style={{padding:'8px 18px'}}>➕ Add Unit</button>}
          </div>
          {uLoading ? (
            <p style={{textAlign:'center',color:'var(--text2)',padding:'40px 0'}}>Loading…</p>
          ) : units.length===0 ? (
            <div style={{textAlign:'center',padding:'48px 0'}}>
              <div style={{fontSize:48,marginBottom:16}}>📚</div>
              <p style={{color:'var(--text2)',marginBottom:20}}>No units added yet</p>
              <button className="btn btn-primary" onClick={openAddUnit}>➕ Add First Unit</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Code</th><th>Unit Name</th><th>Lecturer</th><th>Added</th><th></th></tr></thead>
                <tbody>
                  {units.map(u=>(
                    <tr key={u.id}>
                      <td><span style={{background:'rgba(124,106,247,.12)',color:'var(--purple)',padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700,fontFamily:'monospace'}}>{u.code}</span></td>
                      <td style={{fontWeight:600,color:'var(--text)'}}>{u.name}</td>
                      <td style={{color:'var(--text2)'}}>{u.lecturer||<span style={{color:'var(--text3)'}}>—</span>}</td>
                      <td style={{color:'var(--text3)',fontSize:'.8rem'}}>{u.createdAt?new Date(u.createdAt).toLocaleDateString():'—'}</td>
                      <td><div style={{display:'flex',gap:8}}>
                        <button className="btn btn-secondary" style={{padding:'5px 12px',fontSize:'.8rem'}} onClick={()=>openEditUnit(u)}>✏️ Edit</button>
                        <button className="btn btn-danger"    style={{padding:'5px 12px',fontSize:'.8rem'}} onClick={()=>deleteUnit(u)}>Remove</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>)}

      {/* ══ WEEKS TAB ══ */}
      {tab==='weeks' && (<>
        <div className="stats">
          <div className="stat"><div className="stat-val" style={{color:'var(--accent)'}}>{weeks.length}</div><div className="stat-lbl">Weeks Added</div></div>
          <div className="stat"><div className="stat-val" style={{color:'var(--purple)'}}>{new Date().getFullYear()}</div><div className="stat-lbl">Academic Year</div></div>
          <div className="stat"><div className="stat-val" style={{color:'var(--yellow)'}}>14</div><div className="stat-lbl">Typical Semester</div></div>
        </div>

        {/* Quick generate */}
        {weeks.length===0 && (
          <div className="panel" style={{background:'rgba(0,212,170,.05)',border:'1px solid rgba(0,212,170,.2)',marginBottom:16}}>
            <div className="panel-title" style={{marginBottom:10}}>⚡ Quick Generate Weeks</div>
            <p style={{fontSize:'.85rem',color:'var(--text2)',marginBottom:14}}>Generate week labels automatically for the whole semester:</p>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {[10,12,14,16,18].map(n=>(
                <button key={n} className="btn btn-secondary" style={{padding:'7px 16px'}} onClick={()=>generateWeeks(n)}>
                  Generate {n} Weeks
                </button>
              ))}
            </div>
          </div>
        )}

        {wShowForm && (
          <div className="panel" style={{border:'1px solid rgba(124,106,247,.3)',marginBottom:20}}>
            <div className="panel-title" style={{color:'var(--purple)'}}>{wEditing?'✏️ Edit Week':'➕ Add Week'}</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Week Label *</label>
                <input value={wForm.label} onChange={e=>setWForm({...wForm,label:e.target.value})} placeholder="e.g. Week 1, Week 2" />
              </div>
              <div className="form-group">
                <label>Date Range (optional)</label>
                <input value={wForm.dates} onChange={e=>setWForm({...wForm,dates:e.target.value})} placeholder="e.g. Apr 7 – Apr 11, 2026" />
              </div>
              <div className="form-group full">
                <label>Notes (optional)</label>
                <input value={wForm.notes} onChange={e=>setWForm({...wForm,notes:e.target.value})} placeholder="e.g. Introduction to OOP, CAT 1 week" />
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:8}}>
              <button className="btn btn-purple" onClick={saveWeek} disabled={wSaving} style={{flex:1,justifyContent:'center'}}>
                {wSaving?'⏳ Saving…':wEditing?'💾 Save Changes':'✓ Add Week'}
              </button>
              <button className="btn btn-secondary" onClick={cancelWeek}>✕ Cancel</button>
            </div>
          </div>
        )}

        <div className="panel">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <div className="panel-title" style={{marginBottom:0}}>📅 Semester Weeks</div>
            <div style={{display:'flex',gap:8}}>
              {weeks.length>0 && !wShowForm && (
                <button className="btn btn-secondary" style={{padding:'8px 14px',fontSize:'.85rem'}} onClick={()=>generateWeeks(14)}>
                  ⚡ Re-generate
                </button>
              )}
              {!wShowForm && <button className="btn btn-purple" onClick={openAddWeek} style={{padding:'8px 18px'}}>➕ Add Week</button>}
            </div>
          </div>

          {wLoading ? (
            <p style={{textAlign:'center',color:'var(--text2)',padding:'40px 0'}}>Loading…</p>
          ) : weeks.length===0 ? (
            <div style={{textAlign:'center',padding:'48px 0'}}>
              <div style={{fontSize:48,marginBottom:16}}>📅</div>
              <p style={{color:'var(--text2)',marginBottom:20}}>No weeks added yet. Use Quick Generate above or add manually.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Week Label</th><th>Date Range</th><th>Notes</th><th></th></tr></thead>
                <tbody>
                  {weeks.map((w,i)=>(
                    <tr key={w.id}>
                      <td style={{color:'var(--text3)',fontSize:'.8rem'}}>{String(i+1).padStart(2,'0')}</td>
                      <td>
                        <span style={{background:'rgba(124,106,247,.12)',color:'var(--purple)',padding:'4px 12px',borderRadius:20,fontSize:13,fontWeight:700}}>
                          {w.label}
                        </span>
                      </td>
                      <td style={{color:'var(--text2)',fontSize:'.85rem'}}>{w.dates||<span style={{color:'var(--text3)'}}>—</span>}</td>
                      <td style={{color:'var(--text3)',fontSize:'.82rem'}}>{w.notes||'—'}</td>
                      <td><div style={{display:'flex',gap:8}}>
                        <button className="btn btn-secondary" style={{padding:'5px 12px',fontSize:'.8rem'}} onClick={()=>openEditWeek(w)}>✏️ Edit</button>
                        <button className="btn btn-danger"    style={{padding:'5px 12px',fontSize:'.8rem'}} onClick={()=>deleteWeek(w)}>Remove</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel" style={{background:'rgba(124,106,247,.05)',border:'1px solid rgba(124,106,247,.15)'}}>
          <div className="panel-title" style={{color:'var(--purple)',marginBottom:8}}>💡 How Weeks Work</div>
          <ul style={{paddingLeft:16,color:'var(--text2)',fontSize:'.85rem',lineHeight:1.9}}>
            <li>When taking attendance, the lecturer selects a <strong>Week</strong> as the session name</li>
            <li>Each day's attendance within that week is recorded under that week label</li>
            <li>When exporting Excel, each week becomes a <strong>separate sheet</strong> in the file</li>
            <li>The Full Semester sheet shows all weeks combined in one matrix</li>
          </ul>
        </div>
      </>)}

      {toast && <div className={`toast ${toast.type}`} onClick={()=>setToast(null)}>{toast.msg}</div>}
    </div>
  );
}
