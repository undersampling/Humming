import React, { useState, useRef, useEffect } from "react";
import "./App.css";

export default function HummingSearch() {
  // Input state
  const [inputMode, setInputMode] = useState("record");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Options state
  const [resultCount, setResultCount] = useState(5);
  const [useAiModel, setUseAiModel] = useState(false);

  // Results state
  const [isSearching, setIsSearching] = useState(false);
  const [dspResults, setDspResults] = useState([]);
  const [aiResults, setAiResults] = useState([]);

  // Recording state
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, []);

  const hasAudio = inputMode === "record" ? audioBlob : uploadedFile;

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }
      console.log('Recording with mimeType:', mimeType);

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        console.log('Recording complete, blob size:', blob.size, 'type:', blob.type);
        setAudioBlob(blob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingTime(elapsed);
      }, 100);

      const updateAudioLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();
    } catch (err) {
      alert("Please allow microphone access to use this feature");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (recordingTime < 10) {
        alert(`Please record at least 10 seconds. Current: ${recordingTime}s`);
        return;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }

      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // File upload functions
  const handleFileSelect = (file) => {
    if (file && (file.type.startsWith("audio/") || file.name.match(/\.(mp3|wav|webm|m4a|ogg|flac|mp4)$/i))) {
      setUploadedFile(file);
    } else {
      alert("Please upload a valid audio file (MP3, WAV, WEBM, M4A, OGG, FLAC)");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Search function
  const searchSong = async () => {
    const audioSource = inputMode === "record" ? audioBlob : uploadedFile;
    if (!audioSource) return;

    setIsSearching(true);
    setDspResults([]);
    setAiResults([]);

    const formData = new FormData();
    let filename = uploadedFile?.name || "recording.webm";
    if (inputMode === "record" && audioBlob) {
      const ext = audioBlob.type.split('/')[1]?.split(';')[0] || 'webm';
      filename = `recording.${ext}`;
      console.log('Sending recording with filename:', filename);
    }
    formData.append("audio", audioSource, filename);
    formData.append("method", useAiModel ? "both" : "dsp");
    formData.append("top_n", resultCount.toString());

    try {
      const response = await fetch("http://127.0.0.1:8000/api/search/", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      console.log("API Response:", data);

      if (data.dsp) {
        console.log("Setting DSP results:", data.dsp.length, "items");
        setDspResults(data.dsp);
      }
      if (data.ai) {
        console.log("Setting AI results:", data.ai.length, "items");
        setAiResults(data.ai);
      }
      
      if ((!data.dsp || data.dsp.length === 0) && (!data.ai || data.ai.length === 0)) {
        alert("No results found. The recording may not contain detectable melody.");
      }
    } catch (error) {
      console.error("Error searching song:", error);
      alert("Failed to connect to server. Ensure Django is running on port 8000.");
    } finally {
      setIsSearching(false);
    }
  };

  const resetSearch = () => {
    setAudioBlob(null);
    setUploadedFile(null);
    setDspResults([]);
    setAiResults([]);
    setRecordingTime(0);
  };

  // Result card component
  const ResultCard = ({ song, rank }) => {
    const confidenceClass = song.confidence >= 0.5 ? "high" : song.confidence >= 0.3 ? "medium" : "low";
    
    return (
      <div className="result-card">
        <div className="result-card-left">
          <div className="result-rank">{rank}</div>
          <div className="result-info">
            <h3>{song.title}</h3>
            <p>{song.artist}</p>
          </div>
        </div>
        <div className="result-card-right">
          <div className={`result-confidence ${confidenceClass}`}>
            {Math.round(song.confidence * 100)}%
          </div>
          <div className="result-match-label">MATCH</div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <div className="wave-bg"></div>

      <main className="main-content">
        {/* Header */}
        <div className="header">
          <h1 className="header-title">HumFind</h1>
          <p className="header-subtitle">Discover songs by humming or uploading audio</p>
        </div>

        {/* Main Card */}
        <div className="main-card">
          {/* Mode Toggle */}
          <div className="mode-toggle-container">
            <div className="mode-toggle">
              <button
                className={`mode-btn ${inputMode === "record" ? "active" : ""}`}
                onClick={() => { setInputMode("record"); resetSearch(); }}
              >
                🎤 Record
              </button>
              <button
                className={`mode-btn ${inputMode === "upload" ? "active" : ""}`}
                onClick={() => { setInputMode("upload"); resetSearch(); }}
              >
                📁 Upload File
              </button>
            </div>
          </div>

          {/* Input Area */}
          <div className="input-area">
            {inputMode === "record" ? (
              <div className="recording-container">
                {!audioBlob ? (
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`record-button ${isRecording ? "recording" : "idle"}`}
                  >
                    <span className="record-button-icon">
                      {isRecording ? "⏹" : "🎤"}
                    </span>
                    <span className="record-button-text">
                      {isRecording
                        ? recordingTime < 10
                          ? `${10 - recordingTime}s LEFT`
                          : "STOP"
                        : "TAP TO HUM"}
                    </span>
                  </button>
                ) : (
                  <div className="recording-complete">
                    <span className="recording-complete-icon">✅</span>
                    <p className="recording-complete-text">Recording captured!</p>
                    <p className="recording-complete-duration">Duration: {recordingTime}s</p>
                    <audio
                      controls
                      src={audioBlob ? URL.createObjectURL(audioBlob) : ""}
                      className="audio-player"
                    />
                    <button onClick={() => setAudioBlob(null)} className="record-again-btn">
                      🔄 Record Again
                    </button>
                  </div>
                )}

                {isRecording && (
                  <div className="recording-timer">
                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.webm,.m4a,.ogg,.flac,.mp4"
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  style={{ display: "none" }}
                />

                {!uploadedFile ? (
                  <div
                    className={`dropzone ${isDragging ? "dragging" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <span className="dropzone-icon">📂</span>
                    <p className="dropzone-text">Drag & drop your audio file here</p>
                    <p className="dropzone-hint">or click to browse (MP3, WAV, WEBM, M4A)</p>
                  </div>
                ) : (
                  <div
                    onDoubleClick={() => fileInputRef.current?.click()}
                    className="file-uploaded"
                    title="Double-click to choose another file"
                  >
                    <span className="file-uploaded-icon">🎵</span>
                    <p className="file-uploaded-name">{uploadedFile.name}</p>
                    <p className="file-uploaded-size">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <p className="file-uploaded-hint">Double-click to choose another file</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Options Section */}
          <div className="options-section">
            <div className="option-group">
              <label className="option-label">Results:</label>
              <select
                className="select-styled"
                value={resultCount}
                onChange={(e) => setResultCount(parseInt(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} song{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="option-group">
              <label className="option-label">Compare with AI Model:</label>
              <div
                className={`toggle-switch ${useAiModel ? "active" : ""}`}
                onClick={() => setUseAiModel(!useAiModel)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={searchSong}
              disabled={!hasAudio || isSearching}
              className="btn-primary"
            >
              {isSearching ? "🔍 Processing..." : "🚀 Start Processing"}
            </button>

            {hasAudio && (
              <button
                onClick={resetSearch}
                disabled={isSearching}
                className="btn-secondary"
              >
                ↻ Reset
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        {(dspResults.length > 0 || aiResults.length > 0) && (
          <div className={`results-section ${useAiModel ? "comparison" : "single"}`}>
            {useAiModel ? (
              <div className="results-grid">
                {/* DSP Results */}
                <div>
                  <h2 className="results-column-title">
                    <span className="results-badge dsp">DSP</span>
                    Signal Processing Results
                  </h2>
                  {dspResults.length > 0 ? (
                    dspResults.map((song, i) => (
                      <ResultCard key={i} song={song} rank={i + 1} />
                    ))
                  ) : (
                    <p className="no-results">No matches found</p>
                  )}
                </div>

                {/* AI Results */}
                <div>
                  <h2 className="results-column-title">
                    <span className="results-badge ai">AI</span>
                    AI Model Results
                  </h2>
                  {aiResults.length > 0 ? (
                    aiResults.map((song, i) => (
                      <ResultCard key={i} song={song} rank={i + 1} />
                    ))
                  ) : (
                    <p className="no-results">No matches found (AI model may not be available)</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="results-single-title">🎵 Results Found</h2>
                {dspResults.map((song, i) => (
                  <ResultCard key={i} song={song} rank={i + 1} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
