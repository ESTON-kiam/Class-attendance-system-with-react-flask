from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import base64
import json
import os
import csv
import uuid
from datetime import datetime
from PIL import Image
import io
import cv2

app = Flask(__name__)
CORS(app)   # allow ALL origins on ALL routes

STUDENTS_DB   = "data/students.json"
ATTENDANCE_DIR = "data/attendance"
FACES_DIR     = "data/students"

os.makedirs(FACES_DIR,     exist_ok=True)
os.makedirs(ATTENDANCE_DIR, exist_ok=True)

# ── Lazy-load face models ─────────────────────────────────────────────────────
_mtcnn  = None
_resnet = None

def get_models():
    global _mtcnn, _resnet
    if _mtcnn is None:
        from facenet_pytorch import MTCNN, InceptionResnetV1
        _mtcnn  = MTCNN(image_size=160, margin=20, keep_all=False, post_process=True)
        _resnet = InceptionResnetV1(pretrained='vggface2').eval()
        print("[FaceTrack] Models loaded.")
    return _mtcnn, _resnet

# ── Helpers ───────────────────────────────────────────────────────────────────
def load_students():
    if not os.path.exists(STUDENTS_DB):
        return []
    with open(STUDENTS_DB) as f:
        return json.load(f)

def save_students(students):
    with open(STUDENTS_DB, "w") as f:
        json.dump(students, f, indent=2)

def b64_to_pil(b64):
    if "," in b64:
        b64 = b64.split(",")[1]
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")

def get_embedding(pil_img):
    import torch
    mtcnn, resnet = get_models()
    face = mtcnn(pil_img)
    if face is None:
        return None, "No face detected. Please retake the photo in good lighting."
    with torch.no_grad():
        emb = resnet(face.unsqueeze(0))
    return emb[0].numpy(), None

def cosine_sim(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

def quick_face_check(pil_img):
    arr  = np.array(pil_img)
    bgr  = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cc   = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    return len(cc.detectMultiScale(gray, 1.1, 5, minSize=(60, 60)))

def mark_attendance(student, session_id):
    today = datetime.now().strftime("%Y-%m-%d")
    path  = os.path.join(ATTENDANCE_DIR, f"{session_id}_{today}.csv")
    existing = set()
    if os.path.exists(path):
        with open(path) as f:
            for row in csv.DictReader(f):
                existing.add(row.get("studentId", ""))
    if student["studentId"] in existing:
        return True
    new_file = not os.path.exists(path)
    with open(path, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["studentId","name","course","time","date"])
        if new_file:
            w.writeheader()
        w.writerow({"studentId": student["studentId"], "name": student["name"],
                    "course": student["course"], "time": datetime.now().strftime("%H:%M:%S"),
                    "date": today})
    return False

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "FaceTrack running"})

@app.route("/api/students")
def get_students():
    return jsonify(load_students())

@app.route("/api/students/register", methods=["POST"])
def register_student():
    data       = request.json or {}
    student_id = data.get("studentId","").strip()
    name       = data.get("name","").strip()
    course     = data.get("course","").strip()
    image_b64  = data.get("image","")
    if not all([student_id, name, course, image_b64]):
        return jsonify({"error": "All fields including face image are required"}), 400
    students = load_students()
    if any(s["studentId"] == student_id for s in students):
        return jsonify({"error": f"Student ID '{student_id}' already registered"}), 409
    try:
        img = b64_to_pil(image_b64)
        embedding, err = get_embedding(img)
        if err:
            return jsonify({"error": err}), 400
        uid = str(uuid.uuid4())[:8]
        np.save(os.path.join(FACES_DIR, f"{uid}.npy"), embedding)
        student = {"id": uid, "studentId": student_id, "name": name, "course": course,
                   "registeredAt": datetime.now().isoformat()}
        students.append(student)
        save_students(students)
        return jsonify({"success": True, "message": f"{name} registered successfully!", "student": student})
    except Exception as e:
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500

@app.route("/api/students/<uid>", methods=["DELETE"])
def delete_student(uid):
    students = [s for s in load_students() if s["id"] != uid]
    save_students(students)
    p = os.path.join(FACES_DIR, f"{uid}.npy")
    if os.path.exists(p): os.remove(p)
    return jsonify({"success": True})

@app.route("/api/attendance/recognize", methods=["POST"])
def recognize_face():
    data        = request.json or {}
    image_b64   = data.get("image","")
    session_id  = data.get("sessionId","default")
    course_unit = data.get("courseUnit","").strip()   # the unit the lecturer selected

    if not image_b64:
        return jsonify({"error": "No image provided"}), 400
    try:
        img = b64_to_pil(image_b64)
        if quick_face_check(img) == 0:
            return jsonify({"recognized": False, "message": "No face detected"})

        all_students = load_students()
        if not all_students:
            return jsonify({"recognized": False, "message": "No students registered yet"})

        # Filter to only students enrolled in this course unit
        # If no course unit specified, use all students (fallback)
        if course_unit:
            unit_students = [s for s in all_students if s.get("course","").strip().lower() == course_unit.lower()]
        else:
            unit_students = all_students

        if not unit_students:
            return jsonify({
                "recognized": False,
                "message": f"No students registered for '{course_unit}'"
            })

        embedding, err = get_embedding(img)
        if err or embedding is None:
            return jsonify({"recognized": False, "message": err or "Could not extract face"})

        # Compare only against students in this course unit
        best_student, best_sim = None, -1
        for s in unit_students:
            p = os.path.join(FACES_DIR, f"{s['id']}.npy")
            if not os.path.exists(p): continue
            sim = cosine_sim(embedding, np.load(p))
            if sim > best_sim:
                best_sim     = sim
                best_student = s

        if best_student and best_sim >= 0.7:
            already = mark_attendance(best_student, session_id)
            return jsonify({
                "recognized":   True,
                "student":      best_student,
                "confidence":   round(best_sim*100,1),
                "alreadyMarked": already
            })

        # Face recognized but NOT in this course unit — check if they exist in another unit
        best_other, best_other_sim = None, -1
        other_students = [s for s in all_students if s not in unit_students]
        for s in other_students:
            p = os.path.join(FACES_DIR, f"{s['id']}.npy")
            if not os.path.exists(p): continue
            sim = cosine_sim(embedding, np.load(p))
            if sim > best_other_sim:
                best_other_sim = sim
                best_other     = s

        if best_other and best_other_sim >= 0.7:
            # Person is registered but in a different course unit
            return jsonify({
                "recognized":    False,
                "wrongUnit":     True,
                "message":       f"Not enrolled in {course_unit}",
                "student":       best_other,
                "studentCourse": best_other.get("course",""),
            })

        return jsonify({"recognized": False, "message": "Face not recognized"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/attendance")
def get_attendance():
    session_id = request.args.get("sessionId","default")
    date       = request.args.get("date", datetime.now().strftime("%Y-%m-%d"))
    path       = os.path.join(ATTENDANCE_DIR, f"{session_id}_{date}.csv")
    records    = []
    if os.path.exists(path):
        with open(path) as f:
            records = list(csv.DictReader(f))
    return jsonify({"date": date, "session": session_id, "records": records, "count": len(records)})

@app.route("/api/attendance/sessions")
def get_sessions():
    sessions = set()
    for fn in os.listdir(ATTENDANCE_DIR):
        if fn.endswith(".csv"):
            parts = fn.replace(".csv","").rsplit("_",1)
            if len(parts)==2:
                sessions.add(parts[0])
    return jsonify(list(sessions))

@app.route("/api/attendance/export")
def export_attendance():
    date_from      = request.args.get("date_from","")
    date_to        = request.args.get("date_to","")
    session_filter = request.args.get("session","all")

    if not date_from or not date_to:
        return jsonify({"error": "date_from and date_to are required"}), 400

    try:
        from_dt = datetime.strptime(date_from, "%Y-%m-%d").date()
        to_dt   = datetime.strptime(date_to,   "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    all_records  = []
    students_map = {}

    for filename in sorted(os.listdir(ATTENDANCE_DIR)):
        if not filename.endswith(".csv"):
            continue
        parts = filename.replace(".csv","").rsplit("_",1)
        if len(parts) != 2:
            continue
        sess_name, file_date = parts[0], parts[1]
        try:
            file_dt = datetime.strptime(file_date, "%Y-%m-%d").date()
        except ValueError:
            continue
        if not (from_dt <= file_dt <= to_dt):
            continue
        if session_filter != "all" and sess_name != session_filter:
            continue

        with open(os.path.join(ATTENDANCE_DIR, filename)) as f:
            for row in csv.DictReader(f):
                rec = {"session": sess_name, "date": file_date,
                       "studentId": row.get("studentId",""), "name": row.get("name",""),
                       "course": row.get("course",""), "time": row.get("time","")}
                all_records.append(rec)
                sid = rec["studentId"]
                if sid not in students_map:
                    students_map[sid] = {"name": rec["name"], "course": rec["course"]}

    return jsonify({
        "records":          all_records,
        "total":            len(all_records),
        "unique_students":  len(students_map),
        "date_from":        date_from,
        "date_to":          date_to,
        "sessions_covered": list({r["session"] for r in all_records}),
    })

# ── Start ─────────────────────────────────────────────────────────────────────
# ── Course Units Management ───────────────────────────────────────────────────
UNITS_DB = "data/units.json"

def load_units():
    if not os.path.exists(UNITS_DB):
        return []
    with open(UNITS_DB) as f:
        return json.load(f)

def save_units(units):
    with open(UNITS_DB, "w") as f:
        json.dump(units, f, indent=2)

@app.route("/api/units", methods=["GET"])
def get_units():
    return jsonify(load_units())

@app.route("/api/units", methods=["POST"])
def add_unit():
    data     = request.json or {}
    code     = data.get("code", "").strip()
    name     = data.get("name", "").strip()
    lecturer = data.get("lecturer", "").strip()
    if not code or not name:
        return jsonify({"error": "Unit code and name are required"}), 400
    units = load_units()
    if any(u["code"].lower() == code.lower() for u in units):
        return jsonify({"error": f"Unit code '{code}' already exists"}), 409
    unit = {
        "id":       str(uuid.uuid4())[:8],
        "code":     code,
        "name":     name,
        "lecturer": lecturer,
        "createdAt": datetime.now().isoformat()
    }
    units.append(unit)
    save_units(units)
    return jsonify({"success": True, "message": f"Unit '{name}' added!", "unit": unit})

@app.route("/api/units/<uid>", methods=["DELETE"])
def delete_unit(uid):
    units = [u for u in load_units() if u["id"] != uid]
    save_units(units)
    return jsonify({"success": True})

@app.route("/api/units/<uid>", methods=["PUT"])
def update_unit(uid):
    data  = request.json or {}
    units = load_units()
    for u in units:
        if u["id"] == uid:
            u["code"]     = data.get("code",     u["code"]).strip()
            u["name"]     = data.get("name",     u["name"]).strip()
            u["lecturer"] = data.get("lecturer", u["lecturer"]).strip()
            break
    save_units(units)
    return jsonify({"success": True})

# ── Weeks Management ─────────────────────────────────────────────────────────
WEEKS_DB = "data/weeks.json"

def load_weeks():
    if not os.path.exists(WEEKS_DB):
        return []
    with open(WEEKS_DB) as f:
        return json.load(f)

def save_weeks(weeks):
    with open(WEEKS_DB, "w") as f:
        json.dump(weeks, f, indent=2)

@app.route("/api/weeks", methods=["GET"])
def get_weeks():
    return jsonify(load_weeks())

@app.route("/api/weeks", methods=["POST"])
def add_week():
    data  = request.json or {}
    label = data.get("label", "").strip()   # e.g. "Week 1"
    dates = data.get("dates", "").strip()   # e.g. "Apr 7 – Apr 11"
    notes = data.get("notes", "").strip()   # optional
    if not label:
        return jsonify({"error": "Week label is required"}), 400
    weeks = load_weeks()
    if any(w["label"].lower() == label.lower() for w in weeks):
        return jsonify({"error": f"'{label}' already exists"}), 409
    week = {
        "id":        str(uuid.uuid4())[:8],
        "label":     label,
        "dates":     dates,
        "notes":     notes,
        "createdAt": datetime.now().isoformat()
    }
    weeks.append(week)
    save_weeks(weeks)
    return jsonify({"success": True, "message": f"'{label}' added!", "week": week})

@app.route("/api/weeks/<wid>", methods=["DELETE"])
def delete_week(wid):
    weeks = [w for w in load_weeks() if w["id"] != wid]
    save_weeks(weeks)
    return jsonify({"success": True})

@app.route("/api/weeks/<wid>", methods=["PUT"])
def update_week(wid):
    data  = request.json or {}
    weeks = load_weeks()
    for w in weeks:
        if w["id"] == wid:
            w["label"] = data.get("label", w["label"]).strip()
            w["dates"] = data.get("dates", w["dates"]).strip()
            w["notes"] = data.get("notes", w["notes"]).strip()
            break
    save_weeks(weeks)
    return jsonify({"success": True})

# ── End weeks ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("="*50)
    print("  FaceTrack  →  http://localhost:5000")
    print("="*50)
    try:
        get_models()
    except Exception as e:
        print(f"  Warning: {e}")
    app.run(debug=False, port=5000, host="0.0.0.0")
