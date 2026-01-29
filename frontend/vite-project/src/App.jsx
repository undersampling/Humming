import React, { useState, useRef, useEffect } from 'react';

export default function HummingSearch() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      // Use standard webm mime type
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
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
      alert('Please allow microphone access to use this feature');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    }
  };

  // --- CONNECTED TO BACKEND ---
  const searchSong = async () => {
    if (!audioBlob) return;
    setIsSearching(true);

    const formData = new FormData();
    // 'audio' matches the key in Django views.py: request.FILES.get('audio')
    formData.append('audio', audioBlob, 'recording.webm'); 

    try {
      // Assuming Django runs on port 8000
      const response = await fetch('http://127.0.0.1:8000/api/search/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching song:', error);
      alert('Failed to connect to server. Ensure Django is running on port 8000.');
    } finally {
      setIsSearching(false);
    }
  };

  const resetSearch = () => {
    setAudioBlob(null);
    setSearchResults([]);
    setRecordingTime(0);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: '#0f0c29', 
      backgroundImage: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      color: 'white',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <style>{`
        body { margin: 0; padding: 0; overflow-x: hidden; }
        @keyframes wave {
          0%, 100% { transform: translateX(-25%) translateY(0); }
          50% { transform: translateX(-25%) translateY(-30px); }
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
      `}</style>

      <div className="wave-bg"></div>

      <main style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        minHeight: '100vh',
        padding: '60px 0'
      }}>
        
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '5rem', fontWeight: '900', margin: 0, letterSpacing: '-2px', background: 'linear-gradient(to right, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            HumFind
          </h1>
          <p style={{ fontSize: '1.5rem', opacity: 0.7, fontWeight: '300' }}>Discover songs by humming the melody</p>
        </div>

        <div style={{
          width: '90%',
          maxWidth: '1400px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          borderRadius: '40px',
          padding: '80px 40px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 40px 100px rgba(0,0,0,0.5)'
        }}>
          
          <div style={{ marginBottom: '40px', textAlign: 'center' }}>
            {!audioBlob ? (
               <button
               onClick={isRecording ? stopRecording : startRecording}
               style={{
                 width: '240px',
                 height: '240px',
                 borderRadius: '50%',
                 border: 'none',
                 background: isRecording ? '#ef4444' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                 cursor: 'pointer',
                 boxShadow: isRecording ? '0 0 50px rgba(239, 68, 68, 0.5)' : '0 20px 50px rgba(99, 102, 241, 0.3)',
                 transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                 display: 'flex',
                 flexDirection: 'column',
                 alignItems: 'center',
                 justifyContent: 'center',
                 color: 'white'
               }}
             >
               <span style={{ fontSize: '4rem' }}>{isRecording ? '⏹' : '🎤'}</span>
               <span style={{ fontWeight: 'bold', marginTop: '10px', letterSpacing: '2px' }}>
                 {isRecording ? 'FINISH' : 'TAP TO HUM'}
               </span>
             </button>
            ) : (
              <div style={{ display: 'flex', gap: '20px' }}>
                <button onClick={searchSong} disabled={isSearching} style={{ padding: '25px 60px', borderRadius: '100px', border: 'none', background: isSearching ? '#6b7280' : '#10b981', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: isSearching ? 'not-allowed' : 'pointer' }}>
                  {isSearching ? '🔍 ANALYZING...' : '🔍 FIND SONG'}
                </button>
                <button onClick={resetSearch} disabled={isSearching} style={{ padding: '25px 60px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>
                  ↻ TRY AGAIN
                </button>
              </div>
            )}
          </div>

          {isRecording && (
            <div style={{ fontSize: '3rem', fontFamily: 'monospace', color: '#a5b4fc' }}>
              {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>

        {searchResults.length > 0 && (
          <div style={{ width: '90%', maxWidth: '1400px', marginTop: '60px' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '30px', opacity: 0.9 }}>Results Found</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
              gap: '25px' 
            }}>
              {searchResults.map((song, i) => (
                <div key={i} className="result-card" style={{
                  background: 'rgba(255,255,255,0.05)',
                  padding: '30px',
                  borderRadius: '24px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: '0.3s'
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.5rem' }}>{song.title}</h3>
                    <p style={{ margin: 0, color: '#a5b4fc', fontSize: '1.1rem' }}>{song.artist}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{Math.round(song.confidence * 100)}%</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>MATCH</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}