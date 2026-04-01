#!/bin/bash
echo "=== FaceAttend Backend Setup ==="
python3 -m venv venv
source venv/bin/activate
echo "Installing dependencies (this may take a few minutes)..."
pip install flask flask-cors Pillow numpy
echo ""
echo "Installing face-recognition (requires cmake and dlib)..."
echo "If this fails, see manual instructions below."
pip install face-recognition || echo "⚠️  face-recognition install failed. Try: sudo apt-get install cmake libdlib-dev && pip install dlib face-recognition"
echo ""
echo "=== Setup complete. Run: python app.py ==="
