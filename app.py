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
CORS(app)

STUDENTS_DB = "data/students.json"
ATTENDANCE_DIR = "data/attendance"
FACES_DIR = "data/students"

os.makedirs(FACES_DIR, exist_ok=True)
os.makedirs(ATTENDANCE_DIR, exist_ok=True)

# ── Lazy-load heavy models ────────────────────────────────────────────────────
_mtcnn = None
_resnet = None

def get_models():
    global _mtcnn, _resnet
    if _mtcnn is None:
        from facenet_pytorch import MTCNN, InceptionResnetV1
        import torch
        _mtcnn  = MTCNN(image_size=160, margin=20, keep_all=False, post_process=True)
        _resnet = InceptionResnetV1(pretrained='vggface2').eval()
        print("[FaceTrack] Models loaded (MTCNN + InceptionResnetV1)")
    return _mtcnn, _resnet

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_students():
    if not os.path.exists(STUDENTS_DB):
        return []
    with open(STUDENTS_DB, "r") as f:
        return json.load(f)

def save_students(students):
    with open(STUDENTS_DB, "w") as f:
        json.dump(students, f, indent=2)

def b64_to_pil(b64):
    if "," in b64:
        b64 = b64.split(",")[1]
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")

def get_embedding(pil_img):
    """
    Returns (embedding_np, error_string).
    embedding_np is a 512-d numpy array, or None on failure.
    """
    import torch
    mtcnn, resnet = get_models()

    # Detect & crop face
    face_tensor = mtcnn(pil_img)          # returns (160,160,3) tensor or None
    if face_tensor is None:
        return None, "No face detected. Please retake the photo in good lighting, facing the camera directly."

    with torch.no_grad():
        embedding = resnet(face_tensor.unsqueeze(0))  # (1, 512)
    return embedding[0].numpy(), None

def cosine_sim(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

def quick_face_check(pil_img):
    """Fast OpenCV check before running the heavy model."""
    arr = np.array(pil_img)
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
    return len(faces)

def mark_attendance(student, session_id):
    today = datetime.now().strftime("%Y-%m-%d")
    path  = os.path.join(ATTENDANCE_DIR, f"{session_id}_{today}.csv")

    existing = set()
    if os.path.exists(path):
        with open(path, "r") as f:
            for row in csv.DictReader(f):
                existing.add(row.get("studentId", ""))

    if student["studentId"] in existing:
        return True

    new_file = not os.path.exists(path)
    with open(path, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["studentId","name","course","time","date"])
        if new_file:
            w.writeheader()
        w.writerow({
            "studentId": student["studentId"],
            "name":      student["name"],
            "course":    student["course"],
            "time":      datetime.now().strftime("%H:%M:%S"),
            "date":      today,
        })
    return False

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "FaceTrack attendance system running"})

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
        return jsonify({"error": f"Student ID '{student_id}' is already registered"}), 409

    try:
        img = b64_to_pil(image_b64)
        embedding, err = get_embedding(img)
        if err:
            return jsonify({"error": err}), 400

        uid = str(uuid.uuid4())[:8]
        np.save(os.path.join(FACES_DIR, f"{uid}.npy"), embedding)

        student = {
            "id": uid, "studentId": student_id,
            "name": name, "course": course,
            "registeredAt": datetime.now().isoformat()
        }
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
    if os.path.exists(p):
        os.remove(p)
    return jsonify({"success": True})

@app.route("/api/attendance/recognize", methods=["POST"])
def recognize_face():
    data       = request.json or {}
    image_b64  = data.get("image","")
    session_id = data.get("sessionId","default")

    if not image_b64:
        return jsonify({"error": "No image provided"}), 400

    try:
        img = b64_to_pil(image_b64)

        # Fast check first
        if quick_face_check(img) == 0:
            return jsonify({"recognized": False, "message": "No face detected"})

        students = load_students()
        if not students:
            return jsonify({"recognized": False, "message": "No students registered yet"})

        embedding, err = get_embedding(img)
        if err or embedding is None:
            return jsonify({"recognized": False, "message": err or "Could not extract face"})

        best_student, best_sim = None, -1
        for s in students:
            p = os.path.join(FACES_DIR, f"{s['id']}.npy")
            if not os.path.exists(p):
                continue
            stored = np.load(p)
            sim = cosine_sim(embedding, stored)
            if sim > best_sim:
                best_sim = sim
                best_student = s

        THRESHOLD = 0.7   # facenet-pytorch cosine: 0.7+ is a solid match
        if best_student and best_sim >= THRESHOLD:
            confidence    = round(best_sim * 100, 1)
            already_marked = mark_attendance(best_student, session_id)
            return jsonify({
                "recognized": True,
                "student": best_student,
                "confidence": confidence,
                "alreadyMarked": already_marked,
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
        with open(path, "r") as f:
            records = list(csv.DictReader(f))
    return jsonify({"date": date, "session": session_id, "records": records, "count": len(records)})

@app.route("/api/attendance/sessions")
def get_sessions():
    sessions = set()
    for fn in os.listdir(ATTENDANCE_DIR):
        if fn.endswith(".csv"):
            parts = fn.replace(".csv","").rsplit("_",1)
            if len(parts) == 2:
                sessions.add(parts[0])
    return jsonify(list(sessions))

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 55)
    print("  FaceTrack Attendance System")
    print("  Pre-loading face recognition models...")
    print("=" * 55)
    try:
        get_models()
        print("  Models ready! Starting server...")
    except Exception as e:
        print(f"  Warning: Could not pre-load models: {e}")
    print("  Backend  ->  http://localhost:5000")
    print("  Frontend ->  http://localhost:3000")
    print("=" * 55)
    app.run(debug=False, port=5000)
