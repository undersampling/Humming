import React, { useState, useRef, useEffect } from "react";

export default function HummingSearch() {
  // Input state
  const [inputMode, setInputMode] = useState("record"); // 'record' | 'upload'
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
      // Cleanup on unmount
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Get current audio source
  const hasAudio = inputMode === "record" ? audioBlob : uploadedFile;

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // Store stream reference

      audioContextRef.current = new (
        window.AudioContext || window.webkitAudioContext
      )();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      startTimeRef.current = Date.now(); // Use Date.now for accuracy

      // Use Date.now for more accurate timing
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingTime(elapsed);
      }, 100); // Update more frequently for accuracy

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
      // Minimum 10 seconds recording
      if (recordingTime < 10) {
        alert(`Please record at least 10 seconds. Current: ${recordingTime}s`);
        return;
      }

      // Stop timer first
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Close audio context
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }

      // Stop the media recorder (this triggers onstop which stops the stream)
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // File upload functions
  const handleFileSelect = (file) => {
    if (
      file &&
      (file.type.startsWith("audio/") ||
        file.name.match(/\.(mp3|wav|webm|m4a|ogg|flac)$/i))
    ) {
      setUploadedFile(file);
    } else {
      alert(
        "Please upload a valid audio file (MP3, WAV, WEBM, M4A, OGG, FLAC)",
      );
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
    const filename =
      inputMode === "record" ? "recording.webm" : uploadedFile.name;
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

      if (data.dsp) setDspResults(data.dsp);
      if (data.ai) setAiResults(data.ai);
    } catch (error) {
      console.error("Error searching song:", error);
      alert(
        "Failed to connect to server. Ensure Django is running on port 8000.",
      );
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
  const ResultCard = ({ song, rank }) => (
    <div
      className="result-card"
      style={{
        background: "rgba(255,255,255,0.05)",
        padding: "24px",
        borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        transition: "0.3s",
        marginBottom: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "1.2rem",
          }}
        >
          {rank}
        </div>
        <div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "1.3rem" }}>
            {song.title}
          </h3>
          <p style={{ margin: 0, color: "#a5b4fc", fontSize: "1rem" }}>
            {song.artist}
          </p>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: "1.8rem",
            fontWeight: "bold",
            color:
              song.confidence >= 0.5
                ? "#10b981"
                : song.confidence >= 0.3
                  ? "#f59e0b"
                  : "#ef4444",
          }}
        >
          {Math.round(song.confidence * 100)}%
        </div>
        <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>MATCH</div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: "#0f0c29",
        backgroundImage:
          "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        color: "white",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        body { margin: 0; padding: 0; overflow-x: hidden; }
        @keyframes wave {
          0%, 100% { transform: translateX(-25%) translateY(0); }
          50% { transform: translateX(-25%) translateY(-30px); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { transform: scale(1.02); box-shadow: 0 0 30px 10px rgba(239, 68, 68, 0.2); }
        }
        .wave-bg {
          position: fixed;
          bottom: -50px;
          left: 0;
          width: 200%;
          height: 300px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%);
          animation: wave 8s ease-in-out infinite;
          pointer-events: none;
          z-index: 0;
        }
        .result-card:hover {
          transform: scale(1.02);
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .mode-toggle {
          display: flex;
          background: rgba(255,255,255,0.1);
          border-radius: 50px;
          padding: 6px;
          gap: 4px;
        }
        .mode-btn {
          padding: 12px 28px;
          border-radius: 50px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          font-size: 1rem;
          transition: all 0.3s ease;
          background: transparent;
          color: rgba(255,255,255,0.6);
        }
        .mode-btn.active {
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
        }
        .dropzone {
          border: 2px dashed rgba(255,255,255,0.3);
          border-radius: 24px;
          padding: 60px 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          background: rgba(255,255,255,0.02);
        }
        .dropzone.dragging {
          border-color: #a855f7;
          background: rgba(168, 85, 247, 0.1);
        }
        .dropzone:hover {
          border-color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.05);
        }
        .toggle-switch {
          position: relative;
          width: 56px;
          height: 28px;
          background: rgba(255,255,255,0.2);
          border-radius: 50px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .toggle-switch.active {
          background: linear-gradient(135deg, #6366f1, #a855f7);
        }
        .toggle-switch::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 22px;
          height: 22px;
          background: white;
          border-radius: 50%;
          transition: all 0.3s ease;
        }
        .toggle-switch.active::after {
          left: 31px;
        }
        .select-styled {
          appearance: none;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          padding: 12px 40px 12px 16px;
          color: white;
          font-size: 1rem;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 20px;
        }
        .select-styled:focus {
          outline: none;
          border-color: #a855f7;
        }
        .select-styled option {
          background: #302b63;
          color: white;
        }
      `}</style>

      <div className="wave-bg"></div>

      <main
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          minHeight: "100vh",
          padding: "60px 20px",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1
            style={{
              fontSize: "4rem",
              fontWeight: "900",
              margin: 0,
              letterSpacing: "-2px",
              background: "linear-gradient(to right, #fff, #a5b4fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            HumFind
          </h1>
          <p style={{ fontSize: "1.3rem", opacity: 0.7, fontWeight: "300" }}>
            Discover songs by humming or uploading audio
          </p>
        </div>

        {/* Main Card */}
        <div
          style={{
            width: "90%",
            maxWidth: "900px",
            background: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(20px)",
            borderRadius: "32px",
            padding: "50px 40px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
          }}
        >
          {/* Mode Toggle */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "40px",
            }}
          >
            <div className="mode-toggle">
              <button
                className={`mode-btn ${inputMode === "record" ? "active" : ""}`}
                onClick={() => {
                  setInputMode("record");
                  resetSearch();
                }}
              >
                🎤 Record
              </button>
              <button
                className={`mode-btn ${inputMode === "upload" ? "active" : ""}`}
                onClick={() => {
                  setInputMode("upload");
                  resetSearch();
                }}
              >
                📁 Upload File
              </button>
            </div>
          </div>

          {/* Input Area */}
          <div style={{ marginBottom: "40px" }}>
            {inputMode === "record" ? (
              // Recording UI
              <div
                style={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                {!audioBlob ? (
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    style={{
                      width: "200px",
                      height: "200px",
                      borderRadius: "50%",
                      border: "none",
                      background: isRecording
                        ? "#ef4444"
                        : "linear-gradient(135deg, #6366f1, #a855f7)",
                      cursor: "pointer",
                      boxShadow: isRecording
                        ? "0 0 50px rgba(239, 68, 68, 0.5)"
                        : "0 20px 50px rgba(99, 102, 241, 0.3)",
                      transition:
                        "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      animation: isRecording ? "pulse 1.5s infinite" : "none",
                    }}
                  >
                    <span style={{ fontSize: "3.5rem" }}>
                      {isRecording ? "⏹" : "🎤"}
                    </span>
                    <span
                      style={{
                        fontWeight: "bold",
                        marginTop: "10px",
                        letterSpacing: "1px",
                        fontSize: "0.9rem",
                      }}
                    >
                      {isRecording
                        ? recordingTime < 10
                          ? `${10 - recordingTime}s LEFT`
                          : "STOP"
                        : "TAP TO HUM"}
                    </span>
                  </button>
                ) : (
                  <div
                    onDoubleClick={() => setAudioBlob(null)}
                    style={{
                      padding: "30px",
                      background: "rgba(16, 185, 129, 0.1)",
                      borderRadius: "20px",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      cursor: "pointer",
                    }}
                    title="Double-click to record again"
                  >
                    <span style={{ fontSize: "2.5rem" }}>✅</span>
                    <p style={{ margin: "10px 0 0 0", fontSize: "1.1rem" }}>
                      Recording captured!
                    </p>
                    <p style={{ margin: "5px 0 0 0", opacity: 0.6 }}>
                      Duration: {recordingTime}s
                    </p>
                    <p
                      style={{
                        margin: "10px 0 0 0",
                        opacity: 0.4,
                        fontSize: "0.85rem",
                      }}
                    >
                      Double-click to re-record
                    </p>
                  </div>
                )}

                {isRecording && (
                  <div
                    style={{
                      fontSize: "2.5rem",
                      fontFamily: "monospace",
                      color: "#a5b4fc",
                      marginTop: "20px",
                    }}
                  >
                    {Math.floor(recordingTime / 60)}:
                    {(recordingTime % 60).toString().padStart(2, "0")}
                  </div>
                )}
              </div>
            ) : (
              // Upload UI
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.webm,.m4a,.ogg,.flac"
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
                    <span
                      style={{
                        fontSize: "3rem",
                        display: "block",
                        marginBottom: "16px",
                      }}
                    >
                      📂
                    </span>
                    <p style={{ fontSize: "1.2rem", margin: "0 0 8px 0" }}>
                      Drag & drop your audio file here
                    </p>
                    <p style={{ opacity: 0.5, margin: 0 }}>
                      or click to browse (MP3, WAV, WEBM, M4A)
                    </p>
                  </div>
                ) : (
                  <div
                    onDoubleClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "30px",
                      background: "rgba(16, 185, 129, 0.1)",
                      borderRadius: "20px",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      textAlign: "center",
                      cursor: "pointer",
                    }}
                    title="Double-click to choose another file"
                  >
                    <span style={{ fontSize: "2.5rem" }}>🎵</span>
                    <p
                      style={{
                        margin: "10px 0 0 0",
                        fontSize: "1.1rem",
                        wordBreak: "break-all",
                      }}
                    >
                      {uploadedFile.name}
                    </p>
                    <p style={{ margin: "5px 0 0 0", opacity: 0.6 }}>
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <p
                      style={{
                        margin: "10px 0 0 0",
                        opacity: 0.4,
                        fontSize: "0.85rem",
                      }}
                    >
                      Double-click to choose another file
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Options Section */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "30px",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: "40px",
              padding: "24px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: "20px",
            }}
          >
            {/* Result Count */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label style={{ opacity: 0.8, fontSize: "0.95rem" }}>
                Results:
              </label>
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

            {/* AI Model Toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label style={{ opacity: 0.8, fontSize: "0.95rem" }}>
                Compare with AI Model:
              </label>
              <div
                className={`toggle-switch ${useAiModel ? "active" : ""}`}
                onClick={() => setUseAiModel(!useAiModel)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              gap: "16px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={searchSong}
              disabled={!hasAudio || isSearching}
              style={{
                padding: "20px 50px",
                borderRadius: "100px",
                border: "none",
                background:
                  !hasAudio || isSearching
                    ? "#4b5563"
                    : "linear-gradient(135deg, #10b981, #059669)",
                color: "white",
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: !hasAudio || isSearching ? "not-allowed" : "pointer",
                boxShadow:
                  hasAudio && !isSearching
                    ? "0 10px 30px rgba(16, 185, 129, 0.3)"
                    : "none",
                transition: "all 0.3s ease",
              }}
            >
              {isSearching ? "🔍 Processing..." : "🚀 Start Processing"}
            </button>

            {hasAudio && (
              <button
                onClick={resetSearch}
                disabled={isSearching}
                style={{
                  padding: "20px 40px",
                  borderRadius: "100px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "white",
                  fontSize: "1.1rem",
                  cursor: isSearching ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                ↻ Reset
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        {(dspResults.length > 0 || aiResults.length > 0) && (
          <div
            style={{
              width: "90%",
              maxWidth: useAiModel ? "1400px" : "900px",
              marginTop: "50px",
            }}
          >
            {useAiModel ? (
              // Side by side comparison
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
                  gap: "30px",
                }}
              >
                {/* DSP Results */}
                <div>
                  <h2
                    style={{
                      fontSize: "1.5rem",
                      marginBottom: "20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                        padding: "8px 16px",
                        borderRadius: "10px",
                        fontSize: "0.9rem",
                      }}
                    >
                      DSP
                    </span>
                    Signal Processing Results
                  </h2>
                  {dspResults.length > 0 ? (
                    dspResults.map((song, i) => (
                      <ResultCard key={i} song={song} rank={i + 1} />
                    ))
                  ) : (
                    <p style={{ opacity: 0.5 }}>No matches found</p>
                  )}
                </div>

                {/* AI Results */}
                <div>
                  <h2
                    style={{
                      fontSize: "1.5rem",
                      marginBottom: "20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                        padding: "8px 16px",
                        borderRadius: "10px",
                        fontSize: "0.9rem",
                      }}
                    >
                      AI
                    </span>
                    AI Model Results
                  </h2>
                  {aiResults.length > 0 ? (
                    aiResults.map((song, i) => (
                      <ResultCard key={i} song={song} rank={i + 1} />
                    ))
                  ) : (
                    <p style={{ opacity: 0.5 }}>
                      No matches found (AI model may not be available)
                    </p>
                  )}
                </div>
              </div>
            ) : (
              // Single column DSP results
              <div>
                <h2
                  style={{
                    fontSize: "1.8rem",
                    marginBottom: "24px",
                    opacity: 0.9,
                  }}
                >
                  🎵 Results Found
                </h2>
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
