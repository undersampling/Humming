# HumFind - Song Recognition by Humming

A web application that identifies songs from humming using both DSP (Digital Signal Processing) and AI (Basic Pitch) methods.

## 📁 Project Structure

```
Humming/
├── backend/          # Django REST API
│   ├── humming/      # Main app (views, processing)
│   ├── config/       # Django settings
│   └── requirements.txt
├── frontend/         # React + Vite
│   └── vite-project/
├── dataset/          # Audio files (MP3/WAV)
└── README.md
```

## ⚠️ Prerequisites

### 1. FFmpeg (Required)

FFmpeg is required for audio processing (MP3 reading, webm conversion).

**Windows Installation:**
```bash
# Option 1: Using winget
winget install ffmpeg

# Option 2: Using chocolatey
choco install ffmpeg

# Option 3: Manual
# Download from https://ffmpeg.org/download.html
# Extract and add the bin folder to your system PATH
```

**Verify installation:**
```bash
ffmpeg -version
```

### 2. Python 3.10+ (Backend)
### 3. Node.js 18+ (Frontend)

## 🚀 Quick Start

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations (optional, for admin)
python manage.py migrate

# Start server
python manage.py runserver
```

**Backend runs at:** http://127.0.0.1:8000

### Frontend Setup

```bash
cd frontend/vite-project

# Install dependencies
npm install

# Start dev server
npm run dev
```

**Frontend runs at:** http://localhost:5173

## 📦 Dependencies

### Backend (Python)
| Package | Purpose |
|---------|---------|
| Django | Web framework |
| librosa | Audio processing (DSP) |
| basic-pitch | AI melody detection |
| onnxruntime | AI model runtime (required!) |

### Frontend (Node.js)
| Package | Purpose |
|---------|---------|
| React 19 | UI framework |
| Vite 7 | Build tool |

## 🎵 How It Works

1. **Record** your humming or **upload** an audio file
2. Choose **DSP** (signal processing) or **AI** (neural network) method
3. Get matched songs ranked by confidence score

### DSP Method
- Extracts pitch histogram and chroma features
- Fast, works offline

### AI Method  
- Uses Basic Pitch neural network for note detection
- More accurate for complex melodies

## ⚠️ Troubleshooting

### "No module named 'basic_pitch'" or AI not working
```bash
pip install basic-pitch onnxruntime
```

### "Could not load audio file" or MP3 errors
Install FFmpeg (see Prerequisites above)

### Python 3.12+ compatibility
- Do NOT install tensorflow
- Use onnxruntime instead (already in requirements.txt)