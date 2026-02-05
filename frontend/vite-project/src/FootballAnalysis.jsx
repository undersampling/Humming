import React, { useState, useRef, useEffect } from "react";
import "./FootballAnalysis.css";

// Football Pitch Component with trajectory visualization
const FootballPitch = ({ play, title, accentColor = "#22c55e" }) => {
    const canvasRef = useRef(null);

    // Pitch dimensions (actual football pitch is 105m x 68m)
    // Canvas coordinates: x from -52.5 to 52.5, y from -34 to 34
    const PITCH_LENGTH = 105;
    const PITCH_WIDTH = 68;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !play) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.fillStyle = '#1a472a';
        ctx.fillRect(0, 0, width, height);

        // Scale factors
        const scaleX = width / PITCH_LENGTH;
        const scaleY = height / PITCH_WIDTH;

        // Convert pitch coordinates to canvas coordinates
        const toCanvasX = (x) => (x + PITCH_LENGTH / 2) * scaleX;
        const toCanvasY = (y) => (PITCH_WIDTH / 2 - y) * scaleY;

        // Draw pitch markings
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;

        // Outer boundary
        ctx.strokeRect(5, 5, width - 10, height - 10);

        // Center line
        ctx.beginPath();
        ctx.moveTo(width / 2, 5);
        ctx.lineTo(width / 2, height - 5);
        ctx.stroke();

        // Center circle
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, height * 0.15, 0, 2 * Math.PI);
        ctx.stroke();

        // Penalty areas
        const penaltyWidth = height * 0.6;
        const penaltyDepth = width * 0.16;

        // Left penalty area
        ctx.strokeRect(5, (height - penaltyWidth) / 2, penaltyDepth, penaltyWidth);

        // Right penalty area
        ctx.strokeRect(width - penaltyDepth - 5, (height - penaltyWidth) / 2, penaltyDepth, penaltyWidth);

        // Goal areas
        const goalWidth = height * 0.3;
        const goalDepth = width * 0.05;

        ctx.strokeRect(5, (height - goalWidth) / 2, goalDepth, goalWidth);
        ctx.strokeRect(width - goalDepth - 5, (height - goalWidth) / 2, goalDepth, goalWidth);

        // Draw trajectory if we have one
        if (play.trajectory && play.trajectory.length > 0) {
            const trajectory = play.trajectory;

            // Draw trajectory line
            ctx.beginPath();
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            trajectory.forEach((point, i) => {
                const canvasX = toCanvasX(point.x);
                const canvasY = toCanvasY(point.y);

                if (i === 0) {
                    ctx.moveTo(canvasX, canvasY);
                } else {
                    ctx.lineTo(canvasX, canvasY);
                }
            });
            ctx.stroke();

            // Draw points with gradient from start to end
            trajectory.forEach((point, i) => {
                const canvasX = toCanvasX(point.x);
                const canvasY = toCanvasY(point.y);
                const progress = i / (trajectory.length - 1);

                // Point size (larger for first and last)
                const isEndpoint = i === 0 || i === trajectory.length - 1;
                const radius = isEndpoint ? 8 : 5;

                // Gradient color from green (start) to red (end)
                const r = Math.round(34 + progress * (239 - 34));
                const g = Math.round(197 - progress * (197 - 68));
                const b = Math.round(94 - progress * (94 - 68));

                ctx.beginPath();
                ctx.arc(canvasX, canvasY, radius, 0, 2 * Math.PI);
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fill();

                // Add white border for visibility
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Label first and last points
                if (isEndpoint) {
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    const label = i === 0 ? 'START' : 'END';
                    ctx.fillText(label, canvasX, canvasY - 12);
                }
            });
        } else {
            // No trajectory message
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No play selected', width / 2, height / 2);
        }

    }, [play, accentColor]);

    return (
        <div className="pitch-container">
            <h3 className="pitch-title">{title}</h3>
            {play && (
                <div className="pitch-info">
                    <span className="team-name">{play.team_name || play.team}</span>
                    <span className="play-events">{play.num_events} events</span>
                </div>
            )}
            <canvas
                ref={canvasRef}
                width={600}
                height={400}
                className="pitch-canvas"
            />
            {play && play.trajectory && (
                <div className="trajectory-legend">
                    <span className="legend-start">● Start</span>
                    <span className="legend-end">● End</span>
                </div>
            )}
        </div>
    );
};

export default function FootballAnalysis() {
    // Play similarity search state
    const [playId, setPlayId] = useState("");
    const [topK, setTopK] = useState(5);
    const [maxEventsInDescription, setMaxEventsInDescription] = useState(5);
    const [isLoading, setIsLoading] = useState(false);
    const [queryPlay, setQueryPlay] = useState(null);
    const [similarPlays, setSimilarPlays] = useState([]);
    const [selectedSimilarIdx, setSelectedSimilarIdx] = useState(0);
    const [error, setError] = useState(null);
    const [totalPlays, setTotalPlays] = useState(null);

    // Goal similarity search state
    const [countries, setCountries] = useState([]);
    const [selectedCountry, setSelectedCountry] = useState("");
    const [countryGoals, setCountryGoals] = useState([]);
    const [selectedGoalIndex, setSelectedGoalIndex] = useState("");
    const [isLoadingGoals, setIsLoadingGoals] = useState(false);
    const [queryGoal, setQueryGoal] = useState(null);
    const [similarGoals, setSimilarGoals] = useState([]);
    const [selectedSimilarGoalIdx, setSelectedSimilarGoalIdx] = useState(0);
    const [goalError, setGoalError] = useState(null);

    // Search mode: 'play' or 'goal'
    const [searchMode, setSearchMode] = useState('play');

    // Load countries on mount
    useEffect(() => {
        fetch("http://127.0.0.1:8000/api/football/goals/countries/")
            .then(res => res.json())
            .then(data => setCountries(data.countries || []))
            .catch(err => console.error("Failed to load countries:", err));
    }, []);

    // Load goals when country changes
    useEffect(() => {
        if (!selectedCountry) {
            setCountryGoals([]);
            setSelectedGoalIndex("");
            return;
        }

        setIsLoadingGoals(true);
        fetch(`http://127.0.0.1:8000/api/football/goals/country/${encodeURIComponent(selectedCountry)}/`)
            .then(res => res.json())
            .then(data => {
                setCountryGoals(data.goals || []);
                setSelectedGoalIndex("");
            })
            .catch(err => console.error("Failed to load goals:", err))
            .finally(() => setIsLoadingGoals(false));
    }, [selectedCountry]);

    const findSimilarPlays = async () => {
        if (!playId || playId === "") {
            setError("Please enter a play ID");
            return;
        }

        setIsLoading(true);
        setError(null);
        setQueryPlay(null);
        setSimilarPlays([]);
        setSelectedSimilarIdx(0);
        // Clear goal results
        setQueryGoal(null);
        setSimilarGoals([]);

        try {
            const response = await fetch("http://127.0.0.1:8000/api/football/analyze/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    play_id: parseInt(playId),
                    top_k: topK,
                    max_events_in_description: maxEventsInDescription,
                }),
            });

            const data = await response.json();

            if (data.error) {
                setError(data.error);
                if (data.total_plays) setTotalPlays(data.total_plays);
            } else {
                setQueryPlay(data.query_play);
                setSimilarPlays(data.similar_plays);
                setTotalPlays(data.total_plays);
                setSearchMode('play');
            }
        } catch (err) {
            setError("Failed to connect to server.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const findSimilarGoals = async () => {
        if (!selectedGoalIndex) {
            setGoalError("Please select a goal");
            return;
        }

        setIsLoading(true);
        setGoalError(null);
        setQueryGoal(null);
        setSimilarGoals([]);
        setSelectedSimilarGoalIdx(0);
        // Clear play results
        setQueryPlay(null);
        setSimilarPlays([]);

        try {
            const response = await fetch("http://127.0.0.1:8000/api/football/goals/similar/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    play_index: parseInt(selectedGoalIndex),
                    top_k: topK,
                    max_events_in_description: maxEventsInDescription,
                }),
            });

            const data = await response.json();

            if (data.error) {
                setGoalError(data.error);
            } else {
                setQueryGoal(data.query_goal);
                setSimilarGoals(data.similar_goals);
                setSearchMode('goal');
            }
        } catch (err) {
            setGoalError("Failed to connect to server.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const resetSearch = () => {
        setPlayId("");
        setQueryPlay(null);
        setSimilarPlays([]);
        setSelectedSimilarIdx(0);
        setError(null);
        setQueryGoal(null);
        setSimilarGoals([]);
        setSelectedSimilarGoalIdx(0);
        setGoalError(null);
        setSelectedCountry("");
        setSelectedGoalIndex("");
    };

    const PlayCard = ({ play, isQuery = false, isSelected = false, onClick }) => {
        const similarityClass = play.similarity >= 0.9 ? "high" : play.similarity >= 0.7 ? "medium" : "low";

        return (
            <div
                className={`play-card ${isQuery ? "query" : ""} ${isSelected ? "selected" : ""} ${onClick ? "clickable" : ""}`}
                onClick={onClick}
            >
                <div className="play-card-header">
                    <div className="play-index">#{play.index}</div>
                    {!isQuery && play.similarity !== undefined && (
                        <div className={`similarity-badge ${similarityClass}`}>
                            {(play.similarity * 100).toFixed(1)}% match
                        </div>
                    )}
                    {isQuery && <div className="query-badge">Query Play</div>}
                    {isSelected && <div className="selected-badge">📍 Viewing</div>}
                </div>
                <div className="play-card-body">
                    <div className="play-info-row">
                        <span className="play-team">{play.team_name}</span>
                        <span className="play-game">Game {play.game_id}</span>
                    </div>
                    <div className="play-meta">
                        <span>Period {play.period}</span>
                        <span>•</span>
                        <span>{play.num_events} events</span>
                        <span>•</span>
                        <span>{play.duration}s</span>
                        <span>•</span>
                        <span className="set-piece-type">{play.set_piece_type === "O" ? "Open Play" : play.set_piece_type}</span>
                    </div>
                    {play.description && (
                        <div className="play-description">{play.description}</div>
                    )}
                </div>
            </div>
        );
    };

    const GoalCard = ({ goal, isQuery = false, isSelected = false, onClick }) => {
        const similarityClass = goal.similarity >= 0.9 ? "high" : goal.similarity >= 0.7 ? "medium" : "low";

        return (
            <div
                className={`play-card goal-card ${isQuery ? "query" : ""} ${isSelected ? "selected" : ""} ${onClick ? "clickable" : ""}`}
                onClick={onClick}
            >
                <div className="play-card-header">
                    <div className="play-index">⚽ {goal.team} vs {goal.opponent}</div>
                    {!isQuery && goal.similarity !== undefined && (
                        <div className={`similarity-badge ${similarityClass}`}>
                            {(goal.similarity * 100).toFixed(1)}% match
                        </div>
                    )}
                    {isQuery && <div className="query-badge">Query Goal</div>}
                    {isSelected && <div className="selected-badge">📍 Viewing</div>}
                </div>
                <div className="play-card-body">
                    <div className="play-info-row">
                        <span className="play-team">{goal.team} Goal #{goal.goal_num}</span>
                        <span className="play-game">{goal.minute}'</span>
                    </div>
                    <div className="play-meta">
                        <span>Match {goal.match_id}</span>
                        <span>•</span>
                        <span>Period {goal.period}</span>
                        <span>•</span>
                        <span>{goal.num_events} events</span>
                        <span>•</span>
                        <span>{goal.duration}s</span>
                        <span>•</span>
                        <span className="set-piece-type">{goal.set_piece_name}</span>
                    </div>
                    {goal.description && (
                        <div className="play-description">{goal.description}</div>
                    )}
                </div>
            </div>
        );
    };

    // Determine what to show on pitches
    const getQueryData = () => {
        if (searchMode === 'goal' && queryGoal) return queryGoal;
        if (searchMode === 'play' && queryPlay) return queryPlay;
        return null;
    };

    const getSimilarData = () => {
        if (searchMode === 'goal' && similarGoals.length > 0) return similarGoals[selectedSimilarGoalIdx];
        if (searchMode === 'play' && similarPlays.length > 0) return similarPlays[selectedSimilarIdx];
        return null;
    };

    return (
        <div className="football-container">
            <div className="wave-bg"></div>

            <main className="main-content">
                {/* Left Panel - Controls and Results (Scrollable) */}
                <div className="left-panel">
                    {/* Header */}
                    <div className="header">
                        <h1 className="header-title">⚽ Football Analysis</h1>
                        <p className="header-subtitle">
                            Find similar plays and goals
                        </p>
                    </div>

                    {/* Play Search Form */}
                    <div className="search-form">
                        <h3 className="form-section-title">🔍 Search by Play Index</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="playId">Play Index</label>
                                <input
                                    type="number"
                                    id="playId"
                                    value={playId}
                                    onChange={(e) => setPlayId(e.target.value)}
                                    placeholder={totalPlays ? `0 - ${totalPlays - 1}` : "Enter index"}
                                    min="0"
                                    max={totalPlays ? totalPlays - 1 : undefined}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="topK">Results</label>
                                <select id="topK" value={topK} onChange={(e) => setTopK(parseInt(e.target.value))}>
                                    {[3, 5, 10, 15, 20].map((n) => (
                                        <option key={n} value={n}>Top {n}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="maxEventsInDescription">Events</label>
                                <select id="maxEventsInDescription" value={maxEventsInDescription} onChange={(e) => setMaxEventsInDescription(parseInt(e.target.value))}>
                                    {[3, 5, 8, 10, 15, 20].map((n) => (
                                        <option key={n} value={n}>First {n}</option>
                                    ))}
                                    <option value={999}>All</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button className="btn-primary" onClick={findSimilarPlays} disabled={isLoading}>
                                {isLoading && searchMode !== 'goal' ? "🔍 Searching..." : "🔍 Find Similar Plays"}
                            </button>
                        </div>
                    </div>

                    {/* Goal Search Form */}
                    <div className="search-form goal-search">
                        <h3 className="form-section-title">⚽ Search by Country Goal</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="country">Country</label>
                                <select
                                    id="country"
                                    value={selectedCountry}
                                    onChange={(e) => setSelectedCountry(e.target.value)}
                                >
                                    <option value="">Select country...</option>
                                    {countries.map((c) => (
                                        <option key={c.name} value={c.name}>
                                            {c.name} ({c.total_goals} goals)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="goal">Goal</label>
                                <select
                                    id="goal"
                                    value={selectedGoalIndex}
                                    onChange={(e) => setSelectedGoalIndex(e.target.value)}
                                    disabled={!selectedCountry || isLoadingGoals}
                                >
                                    <option value="">{isLoadingGoals ? "Loading..." : "Select goal..."}</option>
                                    {countryGoals.map((g) => (
                                        <option key={g.play_index} value={g.play_index}>
                                            #{g.goal_num} vs {g.opponent} ({g.minute}') - {g.set_piece_type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button className="btn-primary btn-goal" onClick={findSimilarGoals} disabled={isLoading || !selectedGoalIndex}>
                                {isLoading && searchMode === 'goal' ? "⚽ Searching..." : "⚽ Find Similar Goals"}
                            </button>
                            {(queryPlay || queryGoal || error || goalError) && (
                                <button className="btn-secondary" onClick={resetSearch}>↻ Reset</button>
                            )}
                        </div>
                    </div>

                    {/* Error Messages */}
                    {error && (
                        <div className="error-message">
                            <span>⚠️</span> {error}
                            {totalPlays && <p className="hint">Valid play indices: 0 to {totalPlays - 1}</p>}
                        </div>
                    )}
                    {goalError && (
                        <div className="error-message">
                            <span>⚠️</span> {goalError}
                        </div>
                    )}

                    {/* Play Results */}
                    {queryPlay && (
                        <div className="results-section">
                            <h2 className="section-title">Query Play</h2>
                            <PlayCard play={queryPlay} isQuery={true} />
                        </div>
                    )}

                    {similarPlays.length > 0 && (
                        <div className="results-section">
                            <h2 className="section-title">Similar Plays ({similarPlays.length}) - Click to visualize</h2>
                            <div className="similar-plays-list">
                                {similarPlays.map((play, index) => (
                                    <PlayCard
                                        key={index}
                                        play={play}
                                        isSelected={index === selectedSimilarIdx}
                                        onClick={() => setSelectedSimilarIdx(index)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Goal Results */}
                    {queryGoal && (
                        <div className="results-section">
                            <h2 className="section-title">Query Goal</h2>
                            <GoalCard goal={queryGoal} isQuery={true} />
                        </div>
                    )}

                    {similarGoals.length > 0 && (
                        <div className="results-section">
                            <h2 className="section-title">Similar Goals ({similarGoals.length}) - Click to visualize</h2>
                            <div className="similar-plays-list">
                                {similarGoals.map((goal, index) => (
                                    <GoalCard
                                        key={index}
                                        goal={goal}
                                        isSelected={index === selectedSimilarGoalIdx}
                                        onClick={() => setSelectedSimilarGoalIdx(index)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel - Pitches (Fixed, Stacked Vertically) */}
                <div className="right-panel">
                    {getQueryData() ? (
                        <>
                            <FootballPitch
                                play={getQueryData()}
                                title={searchMode === 'goal' ? "Query Goal" : "Query Play"}
                                accentColor="#8b5cf6"
                            />
                            <FootballPitch
                                play={getSimilarData() || null}
                                title={getSimilarData()
                                    ? (searchMode === 'goal'
                                        ? `Similar Goal #${selectedSimilarGoalIdx + 1}`
                                        : `Similar Play #${selectedSimilarIdx + 1}`)
                                    : "Select a result"}
                                accentColor="#22c55e"
                            />
                        </>
                    ) : (
                        <div className="pitch-placeholder">
                            <span>🏟️</span>
                            <p>Search by play index or select a country goal to visualize trajectories</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
