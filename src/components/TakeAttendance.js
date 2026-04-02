import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

export default function TakeAttendance() {
  const webcamRef   = useRef(null);
  const intervalRef = useRef(null);
  const [sessionId,  setSessionId]  = useState('');
  const [isRunning,  setIsRunning]  = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [marked,     setMarked]     = useState([]);
  const [scanStatus, setScanStatus] = useState('idle');
  const [scanCount,  setScanCount]  = useState(0);

  const scan = useCallback(async () => {
    if (!webcamRef.current) return;
    const img = webcamRef.current.getScreenshot();
    if (!img) return;
    setScanStatus('scanning');
    setScanCount(c => c + 1);
    try {
      const res = await fetch('http://localhost:5000/api/attendance/recognize', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ image: img, sessionId: sessionId || 'default' })
      });
      const d = await res.json();
      if (d.recognized && d.student) {
        setScanStatus('found');
        setLastResult(d);
        if (!d.alreadyMarked) {
          setMarked(prev => prev.find(s => s.studentId===d.student.studentId) ? prev
            : [{ ...d.student, time: new Date().toLocaleTimeString(), confidence: d.confidence }, ...prev]);
        }
        setTimeout(() => setScanStatus('idle'), 2000);
      } else {
        setScanStatus('notfound');
        setLastResult(d);
        setTimeout(() => setScanStatus('idle'), 1200);
      }
    } catch { setScanStatus('idle'); }
  }, [sessionId]);

  useEffect(() => {
    if (isRunning) { intervalRef.current = setInterval(scan, 2500); }
    else { clearInterval(intervalRef.current); }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, scan]);

  const borderColor = {
    idle:'var(--border)', scanning:'rgba(124,106,247,.5)',
    found:'rgba(0,212,170,.6)', notfound:'rgba(247,106,138,.4)'
  }[scanStatus];
  const glowColor = {
    idle:'none', scanning:'0 0 28px rgba(124,106,247,.2)',
    found:'0 0 36px rgba(0,212,170,.25)', notfound:'0 0 28px rgba(247,106,138,.2)'
  }[scanStatus];

  return (
    <div className="page-wide">
      <h1 className="page-title">Take Attendance</h1>
      <p className="page-sub">Start a session and let the camera recognise students automatically.</p>

      <div className="two-col">
        {/* LEFT: camera */}
        <div>
          {!isRunning && (
            <div className="panel">
              <div className="panel-title">🚀 Start Session</div>
              <div className="form-group">
                <label>Session / Class Name</label>
                <input value={sessionId} onChange={e=>setSessionId(e.target.value)}
                  placeholder="e.g. CS101-Monday, DataStructures-Lab" />
              </div>
              <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginTop:4}}
                disabled={!sessionId.trim()}
                onClick={()=>{ setIsRunning(true); setMarked([]); setScanCount(0); setLastResult(null); }}>
                ▶ Start Attendance Session
              </button>
            </div>
          )}

          <div className="panel">
            <div className="panel-title">
              📸 Live Camera
              {isRunning && <span style={{marginLeft:'auto',fontSize:12,color:'var(--accent)',fontFamily:'monospace'}}>LIVE · {scanCount} scans</span>}
            </div>

            <div className="webcam-wrapper" style={{border:`2px solid ${borderColor}`,boxShadow:glowColor,transition:'all .35s',marginBottom:14}}>
              <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                videoConstraints={{facingMode:'user', width:640, height:480}}
                style={{width:'100%', display:'block'}} />
              <div className="webcam-overlay">
                {isRunning && <div className="scan-line" />}
                <div style={{
                  position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)',
                  background:'rgba(0,0,0,.65)', borderRadius:20, padding:'5px 16px',
                  fontSize:13, fontWeight:600, whiteSpace:'nowrap',
                  color:{idle:'var(--text2)',scanning:'var(--purple)',found:'var(--success)',notfound:'var(--danger)'}[scanStatus],
                  display:'flex', alignItems:'center', gap:6,
                }}>
                  {scanStatus==='scanning' && <><span className="spinner" style={{width:12,height:12}}/>Scanning…</>}
                  {scanStatus==='found'    && <>✅ Recognized!</>}
                  {scanStatus==='notfound' && <>❓ No match</>}
                  {scanStatus==='idle'     && (isRunning ? <>👁 Watching for faces…</> : <>📷 Camera ready</>)}
                </div>
                {isRunning && (
                  <div style={{
                    position:'absolute', top:'10%', left:'20%', right:'20%', bottom:'15%',
                    border:`2px dashed ${scanStatus==='found'?'var(--success)':'rgba(124,106,247,.4)'}`,
                    borderRadius:12, transition:'border-color .3s', pointerEvents:'none',
                  }} />
                )}
              </div>
            </div>

            {isRunning
              ? <button className="btn btn-danger" style={{width:'100%',justifyContent:'center'}}
                  onClick={()=>{ setIsRunning(false); setScanStatus('idle'); }}>⏹ End Session</button>
              : <p style={{textAlign:'center',color:'var(--text3)',fontSize:13}}>Enter a session name above and click Start</p>
            }
          </div>

          {lastResult && isRunning && (
            <div style={{marginTop:12}}>
              {lastResult.recognized && lastResult.student ? (
                <div className={`rec-card ${lastResult.alreadyMarked?'warning':'success'}`}>
                  <div className="rec-avatar">{lastResult.student.name?.[0]?.toUpperCase()}</div>
                  <div>
                    <div className="rec-name">{lastResult.student.name}</div>
                    <div className="rec-meta">{lastResult.student.studentId} · {lastResult.student.course}
                      {lastResult.alreadyMarked && <span style={{color:'var(--warning)',marginLeft:8}}>· Already marked</span>}
                    </div>
                  </div>
                  <div className="rec-conf">{lastResult.confidence}%</div>
                </div>
              ) : (
                <div className="rec-card error">
                  <div className="rec-avatar" style={{background:'rgba(247,106,138,.3)'}}>?</div>
                  <div><div className="rec-name" style={{color:'var(--danger)'}}>Unknown Person</div><div className="rec-meta">Not registered in system</div></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: marked list */}
        <div className="panel" style={{alignSelf:'flex-start'}}>
          <div className="panel-title">
            ✅ Marked Today
            <span style={{marginLeft:'auto',background:'rgba(0,212,170,.1)',color:'var(--accent)',padding:'2px 10px',borderRadius:20,fontSize:14}}>{marked.length}</span>
          </div>
          {sessionId && <div style={{fontSize:12,color:'var(--text3)',marginBottom:14}}>Session: <span style={{color:'var(--accent)',fontFamily:'monospace'}}>{sessionId}</span></div>}
          {marked.length===0
            ? <div className="empty-state" style={{padding:'28px 0'}}><div className="icon">👥</div><p>No students marked yet</p></div>
            : <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:480,overflowY:'auto'}}>
                {marked.map((s,i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:12,borderRadius:10,background:'var(--bg3)',border:'1px solid var(--border)'}}>
                    <div style={{width:38,height:38,borderRadius:'50%',background:`hsl(${i*53},55%,38%)`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#fff',flexShrink:0}}>
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
          }
        </div>
      </div>
    </div>
  );
}
