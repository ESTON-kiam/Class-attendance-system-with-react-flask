import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';

const API = 'http://localhost:5000';

export default function Register() {
  const [units,   setUnits]   = useState([]);
  const [form,    setForm]    = useState({ studentId:'', name:'', course:'' });
  const [image,   setImage]   = useState(null);
  const [camOpen, setCamOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState(null);
  const webcamRef = useRef(null);

  const showToast = (msg, type='success') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 4000);
  };

  // Load units from backend
  useEffect(() => {
    fetch(`${API}/api/units`)
      .then(r => r.json())
      .then(d => setUnits(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const capture = useCallback(() => {
    const src = webcamRef.current?.getScreenshot();
    if (src) { setImage(src); setCamOpen(false); }
    else showToast('Could not capture — allow camera access', 'error');
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!form.studentId || !form.name || !form.course || !image) {
      showToast('Please fill all fields and provide a photo', 'error'); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/students/register`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ studentId: form.studentId, name: form.name, course: form.course, image })
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || 'Registration failed', 'error'); return; }
      showToast(`✓ ${form.name} registered successfully!`);
      setForm({ studentId:'', name:'', course:'' });
      setImage(null);
    } catch {
      showToast('Network error — is the backend running?', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Register Student</h1>
      <p className="page-sub">Add a new student with their biometric photo for automatic attendance.</p>

      <div className="layout2">
        {/* LEFT: form */}
        <div>
          <div className="panel">
            <div className="panel-title">📋 Student Information</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Student ID / Reg. Number</label>
                <input placeholder="e.g. SCT211-0001/2022" value={form.studentId}
                  onChange={e => setForm({...form, studentId: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Full Name</label>
                <input placeholder="e.g. Jane Wanjiru Kamau" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})} />
              </div>
            </div>

            <div className="form-group">
              <label>Course Unit</label>
              {units.length > 0 ? (
                <select value={form.course} onChange={e => setForm({...form, course: e.target.value})}>
                  <option value="">— Select course unit —</option>
                  {units.map(u => (
                    <option key={u.id} value={u.name}>
                      {u.code} — {u.name}{u.lecturer ? ` (${u.lecturer})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{
                  background:'rgba(247,200,106,.08)', border:'1px solid rgba(247,200,106,.25)',
                  borderRadius:10, padding:'12px 14px',
                  fontSize:'.85rem', color:'var(--yellow)',
                }}>
                  ⚠️ No course units added yet.{' '}
                  <span style={{color:'var(--text2)'}}>Go to <strong>Course Units</strong> tab to add units first.</span>
                </div>
              )}
            </div>
          </div>

          <button className="btn btn-primary"
            style={{width:'100%', justifyContent:'center', padding:'13px'}}
            onClick={handleSubmit} disabled={loading || !units.length}>
            {loading ? '⏳ Registering…' : '✓ Register Student'}
          </button>
        </div>

        {/* RIGHT: camera */}
        <div>
          <div className="panel">
            <div className="panel-title">📸 Biometric Photo</div>

            {!camOpen && !image && (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                <button className="btn btn-purple" onClick={() => setCamOpen(true)} style={{width:'100%',justifyContent:'center'}}>
                  📷 Open Camera
                </button>
                <label className="btn btn-secondary" style={{width:'100%',justifyContent:'center',cursor:'pointer'}}>
                  🖼️ Upload Photo
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{display:'none'}} />
                </label>
              </div>
            )}

            {camOpen && (
              <div>
                <div className="webcam-box" style={{marginBottom:12}}>
                  <Webcam ref={webcamRef} screenshotFormat="image/jpeg" style={{width:'100%'}} mirrored />
                  <div className="webcam-overlay">
                    <div className="scan-ring" />
                    <div className="corner tl"/><div className="corner tr"/>
                    <div className="corner bl"/><div className="corner br"/>
                  </div>
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button className="btn btn-primary" onClick={capture} style={{flex:1,justifyContent:'center'}}>📸 Capture</button>
                  <button className="btn btn-secondary" onClick={() => setCamOpen(false)}>✕ Cancel</button>
                </div>
              </div>
            )}

            {image && !camOpen && (
              <div>
                <div className="webcam-box" style={{marginBottom:12}}>
                  <img src={image} alt="captured" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button className="btn btn-secondary" onClick={() => { setImage(null); setCamOpen(true); }} style={{flex:1,justifyContent:'center'}}>
                    🔄 Retake
                  </button>
                  <label className="btn btn-secondary" style={{flex:1,justifyContent:'center',cursor:'pointer'}}>
                    📁 Change
                    <input type="file" accept="image/*" onChange={handleFileUpload} style={{display:'none'}} />
                  </label>
                </div>
                <p style={{fontSize:'.78rem', color:'var(--accent)', marginTop:8, textAlign:'center'}}>✓ Photo captured</p>
              </div>
            )}
          </div>

          <div className="panel" style={{fontSize:'.83rem', color:'var(--text2)', lineHeight:1.6}}>
            <div className="panel-title" style={{marginBottom:8}}>💡 Tips for best results</div>
            <ul style={{paddingLeft:16}}>
              <li>Ensure good lighting on the face</li>
              <li>Look directly at the camera</li>
              <li>Avoid covering the face</li>
              <li>Use a clear, frontal photo</li>
            </ul>
          </div>
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
