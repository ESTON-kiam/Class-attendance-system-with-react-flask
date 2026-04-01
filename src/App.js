import React, { useState, useEffect } from 'react';
import Register from './components/Register';
import TakeAttendance from './components/TakeAttendance';
import AttendanceRecords from './components/AttendanceRecords';
import Students from './components/Students';
import './App.css';

export default function App() {
  const [page, setPage] = useState('home');
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => setBackendStatus(d.face_recognition_available ? 'full' : 'partial'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  const nav = [
    { id: 'register', label: 'Register Student', icon: '👤' },
    { id: 'attendance', label: 'Take Attendance', icon: '📸' },
    { id: 'students', label: 'Students', icon: '🎓' },
    { id: 'records', label: 'Records', icon: '📊' },
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⬡</span>
            <span className="logo-text">FaceAttend</span>
          </div>
          <nav className="nav">
            {nav.map(n => (
              <button key={n.id} className={`nav-btn ${page===n.id?'active':''}`} onClick={() => setPage(n.id)}>
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
          <div className={`status-badge status-${backendStatus}`}>
            <span className="status-dot" />
            {backendStatus === 'full' ? 'Face AI Ready' : backendStatus === 'partial' ? 'Limited Mode' : 'Backend Offline'}
          </div>
        </div>
      </header>

      {page === 'home' && <HomePage setPage={setPage} backendStatus={backendStatus} />}
      {page === 'register' && <Register />}
      {page === 'attendance' && <TakeAttendance />}
      {page === 'students' && <Students />}
      {page === 'records' && <AttendanceRecords />}
    </div>
  );
}

function HomePage({ setPage, backendStatus }) {
  const cards = [
    { id:'register', icon:'👤', title:'Register Student', desc:'Add a new student with their ID, name, course, and biometric photo.', color:'#00d4aa' },
    { id:'attendance', icon:'📸', title:'Take Attendance', desc:'Point the camera — students are recognised automatically in real time.', color:'#7c6af7' },
    { id:'students', icon:'🎓', title:'View Students', desc:'Browse all registered students and manage the database.', color:'#f7c76a' },
    { id:'records', icon:'📊', title:'Attendance Records', desc:'View detailed attendance logs by date and export reports.', color:'#f76a8a' },
  ];
  return (
    <main className="home">
      <div className="hero">
        <h1>Smart Attendance<br /><span className="accent">Powered by Facial Recognition</span></h1>
        <p>Register once. Attend automatically. No manual roll calls — just look at the camera.</p>
        {backendStatus === 'partial' && (
          <div className="alert-banner">
            ⚠️ <strong>face_recognition</strong> library not detected. Install it on the backend for live recognition.<br/>
            <code>pip install face-recognition cmake dlib</code>
          </div>
        )}
        {backendStatus === 'offline' && (
          <div className="alert-banner error">
            🔴 Backend is offline. Start Flask: <code>python app.py</code>
          </div>
        )}
      </div>
      <div className="cards">
        {cards.map(c => (
          <button key={c.id} className="card" onClick={() => setPage(c.id)} style={{'--card-accent': c.color}}>
            <span className="card-icon">{c.icon}</span>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
            <span className="card-arrow">→</span>
          </button>
        ))}
      </div>
    </main>
  );
}
