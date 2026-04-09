import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

const API = 'http://localhost:5000';

export default function TakeAttendance() {
  const webcamRef   = useRef(null);
  const intervalRef = useRef(null);

  const [courses,    setCourses]    = useState([]);
  const [weeks,      setWeeks]      = useState([]);
  const [courseUnit, setCourseUnit] = useState('');
  const [sessionId,  setSessionId]  = useState('');   // will be a week label
  const [isRunning,  setIsRunning]  = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [marked,     setMarked]     = useState([]);
  const [scanStatus, setScanStatus] = useState('idle');
  const [scanCount,  setScanCount]  = useState(0);

  useEffect(() => {
    fetch(`${API}/api/units`)
      .then(r => r.json())
      .then(units => setCourses(Array.isArray(units) ? units : []))
      .catch(() => {});
    fetch(`${API}/api/weeks`)
      .then(r => r.json())
      .then(weeks => setWeeks(Array.isArray(weeks) ? weeks : []))
      .catch(() => {});
  }, []);

  const scan = useCallback(async () => {
    if (!webcamRef.current) return;
    const img = webcamRef.current.getScreenshot();
    if (!img) return;
    setScanStatus('scanning');
    setScanCount(c => c + 1);
    try {
      const res = await fetch(`${API}/api/attendance/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: img, sessionId: sessionId || 'default', courseUnit })
      });
      const d = await res.json();

      if (d.recognized && d.student) {
        setLastResult(d);
        if (d.alreadyMarked) {
          // Already recorded today — show clear dedicated message
          setScanStatus('alreadymarked');
          setTimeout(() => setScanStatus('idle'), 3000);
        } else {
          setScanStatus('found');
          setMarked(prev =>
            prev.find(s => s.studentId === d.student.studentId)
              ? prev
              : [{ ...d.student, time: new Date().toLocaleTimeString(), confidence: d.confidence }, ...prev]
          );
          setTimeout(() => setScanStatus('idle'), 2500);
        }

      } else if (d.wrongUnit) {
        setScanStatus('wrongunit');
        setLastResult(d);
        setTimeout(() => setScanStatus('idle'), 2500);

      } else {
        setScanStatus('notfound');
        setLastResult(d);
        setTimeout(() => setScanStatus('idle'), 1500);
      }
    } catch { setScanStatus('idle'); }
  }, [sessionId, courseUnit]);

  useEffect(() => {
    if (isRunning) { intervalRef.current = setInterval(scan, 2500); }
    else { clearInterval(intervalRef.current); }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, scan]);

  const startSession = () => {
    if (!courseUnit || !sessionId.trim()) return;
    setIsRunning(true);
    setMarked([]);
    setScanCount(0);
    setLastResult(null);
  };

  const stopSession = () => {
    setIsRunning(false);
    setScanStatus('idle');
  };

  // colours per scan status
  const statusColor = {
    idle:         'var(--text2)',
    scanning:     'var(--purple)',
    found:        'var(--success)',
    notfound:     'var(--danger)',
    wrongunit:    'var(--warning)',
    alreadymarked:'var(--yellow)',
  }[scanStatus];

  const borderColor = {
    idle:         'var(--border)',
    scanning:     'rgba(124,106,247,.5)',
    found:        'rgba(0,212,170,.6)',
    notfound:     'rgba(247,106,138,.4)',
    wrongunit:    'rgba(247,200,106,.5)',
    alreadymarked:'rgba(247,200,106,.6)',
  }[scanStatus];

  const glowColor = {
    idle:         'none',
    scanning:     '0 0 28px rgba(124,106,247,.2)',
    found:        '0 0 36px rgba(0,212,170,.25)',
    notfound:     '0 0 28px rgba(247,106,138,.2)',
    wrongunit:    '0 0 28px rgba(247,200,106,.2)',
    alreadymarked:'0 0 36px rgba(247,200,106,.25)',
  }[scanStatus];

  const statusLabel = {
    scanning:     <><span className="spinner" style={{width:12,height:12}}/>Scanning…</>,
    found:        <>✅ Attendance Recorded!</>,
    notfound:     <>❓ No match found</>,
    wrongunit:    <>⚠️ Wrong course unit</>,
    alreadymarked:<>🔁 Already Recorded Today</>,
    idle:         isRunning ? <>👁 Watching for faces…</> : <>📷 Camera ready</>,
  }[scanStatus];

  return (
    <div className="page-wide">
      <h1 className="page-title">Take Attendance</h1>
      <p className="page-sub">Select the course unit, start a session, and let the camera do the rest.</p>

      <div className="two-col">

        {/* ── LEFT ── */}
        <div>
          {/* Session setup */}
          {!isRunning && (
            <div className="panel">
              <div className="panel-title">🚀 Start Session</div>

              <div className="form-group">
                <label>Course Unit</label>
                <select value={courseUnit} onChange={e => setCourseUnit(e.target.value)}>
                  <option value="">— Select course unit —</option>
                  {courses.map(u => (
                    <option key={u.id} value={u.name}>
                      {u.code} — {u.name}{u.lecturer ? ` (${u.lecturer})` : ''}
                    </option>
                  ))}
                </select>
                {courses.length === 0 && (
                  <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:4}}>No units added yet. Go to Course Units tab first.</p>
                )}
              </div>

              <div className="form-group">
                <label>Session Week</label>
                <select value={sessionId} onChange={e => setSessionId(e.target.value)}>
                  <option value="">— Select week —</option>
                  {weeks.map(w => (
                    <option key={w.id} value={w.label}>
                      {w.label}{w.dates ? ` (${w.dates})` : ''}{w.notes ? ` — ${w.notes}` : ''}
                    </option>
                  ))}
                </select>
                {weeks.length === 0 && (
                  <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:4}}>
                    No weeks added yet. Go to <strong>Course Units &amp; Weeks</strong> tab first.
                  </p>
                )}
              </div>

              {courseUnit && (
                <div style={{background:'rgba(0,212,170,.07)',border:'1px solid rgba(0,212,170,.2)',
                  borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:'.83rem',color:'var(--accent)'}}>
                  ✓ Only <strong>{courseUnit}</strong> students will be marked present
                </div>
              )}

              <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}}
                disabled={!courseUnit || !sessionId.trim()} onClick={startSession}>
                ▶ Start Attendance Session
              </button>
            </div>
          )}

          {/* Running banner */}
          {isRunning && (
            <div style={{background:'rgba(0,212,170,.07)',border:'1px solid rgba(0,212,170,.25)',
              borderRadius:12,padding:'12px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:'var(--accent)',
                boxShadow:'0 0 8px var(--accent)',animation:'pulse 1.5s infinite',flexShrink:0}} />
              <div>
                <div style={{fontWeight:600,fontSize:'.9rem'}}>📚 {courseUnit}</div>
                <div style={{fontSize:'.78rem',color:'var(--text3)'}}>Session: {sessionId} · {scanCount} scans</div>
              </div>
            </div>
          )}

          {/* Camera */}
          <div className="panel">
            <div className="panel-title">
              📸 Live Camera
              {isRunning && <span style={{marginLeft:'auto',fontSize:12,color:'var(--accent)',fontFamily:'monospace'}}>LIVE · {scanCount} scans</span>}
            </div>

            <div className="webcam-box" style={{
              marginBottom:14,
              border:`2px solid ${borderColor}`,
              boxShadow:glowColor,
              transition:'all .35s',
            }}>
              <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                videoConstraints={{facingMode:'user',width:640,height:480}}
                style={{width:'100%'}} />
              <div className="webcam-overlay">
                {/* same scan-ring as registration */}
                <div className="scan-ring" style={{
                  borderColor: scanStatus==='found'         ? 'rgba(0,212,170,.7)'   :
                               scanStatus==='alreadymarked' ? 'rgba(247,200,106,.7)' :
                               scanStatus==='wrongunit'     ? 'rgba(247,200,106,.7)' :
                               scanStatus==='scanning'      ? 'rgba(124,106,247,.7)' :
                               'rgba(0,212,170,.5)',
                }} />
                {/* same corner brackets as registration — color changes with status */}
                <div className="corner tl" style={{borderColor: scanStatus==='found'?'var(--success)':scanStatus==='alreadymarked'||scanStatus==='wrongunit'?'var(--yellow)':'var(--accent)'}}/> 
                <div className="corner tr" style={{borderColor: scanStatus==='found'?'var(--success)':scanStatus==='alreadymarked'||scanStatus==='wrongunit'?'var(--yellow)':'var(--accent)'}}/>
                <div className="corner bl" style={{borderColor: scanStatus==='found'?'var(--success)':scanStatus==='alreadymarked'||scanStatus==='wrongunit'?'var(--yellow)':'var(--accent)'}}/>
                <div className="corner br" style={{borderColor: scanStatus==='found'?'var(--success)':scanStatus==='alreadymarked'||scanStatus==='wrongunit'?'var(--yellow)':'var(--accent)'}}/>
                {/* scan line when running */}
                {isRunning && <div className="scan-line" />}
                {/* status label at bottom */}
                <div style={{
                  position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',
                  background:'rgba(0,0,0,.65)',borderRadius:20,padding:'5px 16px',
                  fontSize:13,fontWeight:600,whiteSpace:'nowrap',
                  color:statusColor,display:'flex',alignItems:'center',gap:6,
                }}>
                  {statusLabel}
                </div>
              </div>
            </div>

            {isRunning
              ? <button className="btn btn-danger" style={{width:'100%',justifyContent:'center'}} onClick={stopSession}>⏹ End Session</button>
              : <p style={{textAlign:'center',color:'var(--text3)',fontSize:13}}>Fill in session details above and click Start</p>
            }
          </div>

          {/* Result card */}
          {lastResult && isRunning && (
            <div style={{marginTop:12}}>

              {/* ── Already recorded today ── */}
              {lastResult.alreadyMarked && lastResult.student && (
                <div style={{
                  borderRadius:14,padding:'16px 20px',
                  background:'rgba(247,200,106,.08)',border:'2px solid rgba(247,200,106,.35)',
                  display:'flex',alignItems:'center',gap:14,
                }}>
                  <div style={{fontSize:32,flexShrink:0}}>🔁</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:15,color:'var(--yellow)'}}>
                      Attendance Already Recorded
                    </div>
                    <div style={{fontWeight:600,fontSize:14,marginTop:3}}>{lastResult.student.name}</div>
                    <div style={{fontSize:13,color:'var(--text2)'}}>
                      {lastResult.student.studentId} · {lastResult.student.course}
                    </div>
                    <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>
                      This student has already been marked present today in this session.
                    </div>
                  </div>
                </div>
              )}

              {/* ── New attendance marked ── */}
              {!lastResult.alreadyMarked && lastResult.recognized && lastResult.student && (
                <div className="rec-card success">
                  <div className="rec-avatar">{lastResult.student.name?.[0]?.toUpperCase()}</div>
                  <div>
                    <div className="rec-name">{lastResult.student.name}</div>
                    <div className="rec-meta">{lastResult.student.studentId} · {lastResult.student.course}</div>
                  </div>
                  <div className="rec-conf">{lastResult.confidence}%</div>
                </div>
              )}

              {/* ── Wrong course unit ── */}
              {lastResult.wrongUnit && (
                <div style={{
                  borderRadius:14,padding:'16px 20px',
                  background:'rgba(247,200,106,.08)',border:'1px solid rgba(247,200,106,.3)',
                  display:'flex',alignItems:'center',gap:14,
                }}>
                  <div style={{fontSize:28,flexShrink:0}}>⚠️</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:'var(--warning)'}}>{lastResult.student?.name}</div>
                    <div style={{fontSize:13,color:'var(--text2)',marginTop:3}}>
                      Enrolled in <strong>{lastResult.studentCourse}</strong> — not in <strong>{courseUnit}</strong>
                    </div>
                    <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>Attendance not recorded.</div>
                  </div>
                </div>
              )}

              {/* ── Unknown ── */}
              {!lastResult.recognized && !lastResult.wrongUnit && (
                <div className="rec-card error">
                  <div className="rec-avatar" style={{background:'rgba(247,106,138,.3)'}}>?</div>
                  <div>
                    <div className="rec-name" style={{color:'var(--danger)'}}>Unknown Person</div>
                    <div className="rec-meta">{lastResult.message || 'Not registered in system'}</div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ── RIGHT: marked list ── */}
        <div className="panel" style={{alignSelf:'flex-start'}}>
          <div className="panel-title">
            ✅ Marked Present
            <span style={{marginLeft:'auto',background:'rgba(0,212,170,.1)',color:'var(--accent)',padding:'2px 10px',borderRadius:20,fontSize:14}}>{marked.length}</span>
          </div>

          {courseUnit && (
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:14}}>
              Unit: <span style={{color:'var(--accent)',fontWeight:600}}>{courseUnit}</span>
            </div>
          )}

          {marked.length === 0 ? (
            <div className="empty-state" style={{padding:'28px 0'}}>
              <div className="icon">👥</div>
              <p>No students marked yet</p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:520,overflowY:'auto'}}>
              {marked.map((s,i) => (
                <div key={i} style={{
                  display:'flex',alignItems:'center',gap:12,padding:12,
                  borderRadius:10,background:'var(--bg3)',border:'1px solid var(--border)',
                }}>
                  <div style={{
                    width:38,height:38,borderRadius:'50%',
                    background:`hsl(${i*53},55%,38%)`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontWeight:700,color:'#fff',flexShrink:0,
                  }}>
                    {s.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</div>
                    <div style={{color:'var(--text3)',fontSize:12}}>{s.studentId}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{color:'var(--success)',fontSize:11,fontFamily:'monospace'}}>{s.time}</div>
                    <div style={{color:'var(--text3)',fontSize:11}}>{s.confidence}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
