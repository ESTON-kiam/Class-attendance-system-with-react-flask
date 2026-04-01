@echo off
echo ============================================
echo  FaceTrack - Windows Setup Script
echo ============================================
echo.

REM Check Python version
python --version
echo.

REM Step 1: Upgrade pip
echo [1/5] Upgrading pip...
python -m pip install --upgrade pip
echo.

REM Step 2: Install numpy first (required by dlib)
echo [2/5] Installing numpy...
pip install numpy==1.26.4
echo.

REM Step 3: Install dlib pre-built wheel (avoids needing Visual Studio)
echo [3/5] Installing dlib (pre-built wheel for Python 3.13 Windows)...
pip install dlib==19.24.6 --find-links https://github.com/z-mahmud22/Dlib_Windows_Python3.x/releases/download/v1.0/dlib-19.24.6-cp313-cp313-win_amd64.whl
IF ERRORLEVEL 1 (
    echo.
    echo [!] Pre-built dlib failed. Trying alternative source...
    pip install https://github.com/z-mahmud22/Dlib_Windows_Python3.x/releases/download/v1.0/dlib-19.24.6-cp313-cp313-win_amd64.whl
)
echo.

REM Step 4: Install remaining dependencies
echo [4/5] Installing Flask, Pillow, face_recognition...
pip install flask==3.0.0 flask-cors==4.0.0 Pillow==10.4.0 face-recognition-models==0.3.0 face-recognition==1.3.0
echo.

REM Step 5: Start the server
echo [5/5] Starting Flask server...
echo.
python app.py

pause
