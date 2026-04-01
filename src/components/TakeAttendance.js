import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';

export default function TakeAttendance() {
  const [active, setActive] = useState(false);
  const [result, setResult] = useState(null);
  const [attended, setAttended] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [sessionId] = useState(`session_${Date.now()}`);
  const webcamRef = useRef(null);
  const intervalRef = useRef(null);

  const scan = useCallback(async () => {
    if (scanning) return;
    const img = webcamRef.current?.getScreenshot();
    if (!img) return;
    setScanning(true);
    try {
      const res = await fetch('/api/attendance/recognize', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({image: img, session_id: sessionId})
      });
      const d = await res.json();
      setResult(d);
      if (d.matched && !d.already_marked) {
        setAttended(prev => {
          const exists = prev.find(s => s.student_id === d.student.student_id);
          if (exists) return prev;
          return [{...d.student, time: d.time}, ...prev];
        });
      }
    } catch { /* network error */ }
    finally { setScanning(false); }
  }, [scanning, sessionId]);

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(scan, 2000);
    } else {
      clearInterval(intervalRef.current);
      setResult(null);
    }
    return () => clearInterval(intervalRef.current);
  }, [active, scan]);

  const stop = () => { setActive(false); };

  const ResultDisplay = () => {
    if (!result) return null;
    if (result.matched && result.already_marked)
      return <div className="result-card warning"><span className="result-icon">🔄</span><div className="result-info"><h3>{result.student?.name}</h3><p>Already marked present today</p></div></div>;
    if (result.matched)
      return <div className="result-card matched"><span className="result-icon">✅</span><div className="result-info"><h3>{result.student?.name}</h3><p>{result.student?.student_id} · {result.student?.course} · {result.time}</p></div></div>;
    if (result.reason === 'no_face')
      return <div className="result-card unmatched"><span className="result-icon">👁️</span><div className="result-info"><h3>No face detected</h3><p>Please look at the camera</p></div></div>;
    if (result.reason === 'face_recognition_unavailable')
      return <div className="result-card unmatched"><span className="result-icon">⚠️</span><div className="result-info"><h3>Library not installed</h3><p>Run: pip install face-recognition</p></div></div>;
    if (result.reason === 'no_students_registered')
      return <div className="result-card unmatched"><span className="result-icon">📭</span><div className="result-info"><h3>No students registered</h3><p>Register students first</p></div></div>;
    return <div className="result-card unmatched"><span className="result-icon">❌</span><div className="result-info"><h3>Student not recognised</h3><p>Not in the system or face unclear</p></div></div>;
  };

  return (
    <div className="page-wide">
      <h1 className="page-title">Take Attendance</h1>
      <p className="page-sub">Start the camera — students are recognised automatically every 2 seconds.</p>

      <div className="layout2">
        <div>
          <div className="panel">
            <div className="panel-title">
              📷 Live Camera
              {active && <span className="tag" style={{marginLeft:'auto'}}>🔴 LIVE</span>}
            </div>

            {active ? (
              <div>
                <div className="webcam-box" style={{maxWidth:'100%', marginBottom:12}}>
                  <Webcam ref={webcamRef} screenshotFormat="image/jpeg" style={{width:'100%'}} mirrored />
                  <div className="webcam-overlay">
                    <div className="scan-ring" style={{animationDuration: scanning?'.8s':'2s'}} />
                    <div className="corner tl"/><div className="corner tr"/>
                    <div className="corner bl"/><div className="corner br"/>
                    <div style={{position:'absolute',bottom:10,left:'50%',transform:'translateX(-50%)',
                      background:'rgba(0,0,0,.6)',borderRadius:20,padding:'4px 12px',
                      fontSize:'.75rem',color:'var(--accent)'}}>
                      {scanning ? '⚡ Scanning…' : '👁️ Watching…'}
                    </div>
                  </div>
                </div>
                <button className="btn btn-danger" onClick={stop} style={{width:'100%',justifyContent:'center'}}>
                  ⏹ Stop Session
                </button>
                <ResultDisplay />
              </div>
            ) : (
              <div style={{textAlign:'center', padding:'40px 0'}}>
                <div style={{fontSize:'4rem', marginBottom:16}}>📸</div>
                <p style={{color:'var(--text2)', marginBottom:20, fontSize:'.9rem'}}>
                  Camera will scan for registered faces automatically
                </p>
                <button className="btn btn-primary" style={{padding:'13px 32px'}}
                  onClick={() => { setActive(true); setAttended([]); setResult(null); }}>
                  ▶ Start Attendance Session
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="panel-title">
              ✅ Marked Present
              {attended.length > 0 && (
                <span style={{marginLeft:'auto', fontSize:'.85rem', color:'var(--accent)', fontWeight:700}}>
                  {attended.length}
                </span>
              )}
            </div>
            {attended.length === 0 ? (
              <p style={{color:'var(--text2)', fontSize:'.875rem', textAlign:'center', padding:'24px 0'}}>
                No one marked yet. Start the session and have students face the camera.
              </p>
            ) : (
              <div>
                {attended.map(s => (
                  <div key={s.student_id} className="attended-row">
                    <span style={{fontSize:'1.3rem'}}>✅</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600, fontSize:'.9rem'}}>{s.name}</div>
                      <div style={{fontSize:'.78rem', color:'var(--text2)'}}>{s.student_id} · {s.time}</div>
                    </div>
                    <span className="tag">{s.course.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel" style={{fontSize:'.83rem', color:'var(--text2)', lineHeight:1.7}}>
            <div className="panel-title">ℹ️ How it works</div>
            <ol style={{paddingLeft:16}}>
              <li>Click <strong style={{color:'var(--text)'}}>Start Attendance Session</strong></li>
              <li>Each student stands in front of the camera</li>
              <li>The system scans every 2 seconds</li>
              <li>A match marks the student present automatically</li>
              <li>Stop the session when done</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
