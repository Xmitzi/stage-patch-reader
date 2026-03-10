import { useState, useRef } from "react";

const MODEL = "claude-sonnet-4-20250514";
const CONSOLE_TYPES = ["Any", "Avid SC48", "Avid S6L", "Yamaha CL5", "Yamaha QL5", "DiGiCo SD9", "DiGiCo SD12", "Allen & Heath dLive", "Midas PRO2", "SSL Live L500", "Soundcraft Vi7000"];
const MIC_BRANDS = ["Any", "Shure", "Sennheiser", "AKG", "Neumann", "DPA", "Audix", "Electro-Voice", "Beyerdynamic"];
const STAND_TYPES = ["Boom", "Short Boom", "Straight", "Low Profile", "Clip/Clamp", "No Stand (DI)", "No Stand (In-Ear)"];

function buildPrompt({ stageboxes, consoleType, micBrand, numMonitors, customNotes }) {
  const sbDesc = stageboxes.map((sb, i) => `Stagebox ${i + 1}: ${sb.channels} channels`).join(", ");
  return {
    system: `You are an expert live sound engineer with 20+ years of experience.
You will receive a band rider (as an image or PDF page) and stagebox configuration.
Your job is to generate a complete professional patch list assigning each input to a specific stagebox and channel.

Settings:
- Console: ${consoleType !== "Any" ? consoleType : "any console"}
- Preferred mic brand: ${micBrand !== "Any" ? micBrand + " (use their catalog)" : "any brand, best for each source"}
- Monitor mixes to generate: ${numMonitors}
- Stagebox layout: ${sbDesc}
${customNotes ? `- Engineer notes: ${customNotes}` : ""}

Assignment rules:
- Drums and backline go first (lowest channel numbers)
- Assign inputs sequentially within each stagebox
- Don't exceed the channel count of each stagebox
- Move to next stagebox when current is full

Return a JSON object ONLY — no markdown, no explanation:
{
  "patch": [
    {
      "channel": 1,
      "stagebox": 1,
      "input": 1,
      "source": "Kick In",
      "instrument": "Kick Drum",
      "inputType": "XLR",
      "mic": "Shure Beta 52A",
      "stand": "Low Profile",
      "notes": "Inside kick, angled toward beater"
    }
  ],
  "monitorMixes": [
    { "mix": "Mon 1", "who": "Lead Vocalist", "channels": [1,2,5,6] }
  ],
  "generalNotes": "Any important observations"
}`,
    user: `Stagebox layout: ${sbDesc}\n\nRead the rider and generate the complete patch. Assign every input to a stagebox and input number.`
  };
}

export default function App() {
  // Rider file
  const [riderFile, setRiderFile] = useState(null);
  const [riderBase64, setRiderBase64] = useState(null);
  const [riderMediaType, setRiderMediaType] = useState(null);
  const [riderDragOver, setRiderDragOver] = useState(false);
  const riderRef = useRef();

  // Stageboxes
  const [stageboxes, setStageboxes] = useState([{ channels: 16 }, { channels: 8 }]);

  // AI settings
  const [showSettings, setShowSettings] = useState(false);
  const [consoleType, setConsoleType] = useState("Any");
  const [micBrand, setMicBrand] = useState("Any");
  const [numMonitors, setNumMonitors] = useState(4);
  const [customNotes, setCustomNotes] = useState("");

  // Results
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRiderUpload = (file) => {
    if (!file) return;
    const isPDF = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPDF && !isImage) { setError("Please upload a PDF or image file."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      setRiderFile({ name: file.name, type: file.type, url: isPDF ? null : e.target.result });
      setRiderBase64(e.target.result.split(",")[1]);
      setRiderMediaType(isPDF ? "application/pdf" : file.type);
    };
    reader.readAsDataURL(file);
  };

  const addStagebox = () => setStageboxes(s => [...s, { channels: 16 }]);
  const removeStagebox = (i) => setStageboxes(s => s.filter((_, idx) => idx !== i));
  const updateChannels = (i, val) => setStageboxes(s => s.map((sb, idx) => idx === i ? { channels: Math.max(1, Math.min(64, Number(val))) } : sb));

  const totalChannels = stageboxes.reduce((acc, sb) => acc + sb.channels, 0);

  const handleGenerate = async () => {
    if (!riderBase64) { setError("Please upload a band rider (PDF or image)."); return; }
    if (stageboxes.length === 0) { setError("Please add at least one stagebox."); return; }
    setError(null);
    setLoading(true);
    setResult(null);

    const { system, user } = buildPrompt({ stageboxes, consoleType, micBrand, numMonitors, customNotes });

    try {
      const contentBlock = riderMediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: riderBase64 } }
        : { type: "image", source: { type: "base64", media_type: riderMediaType, data: riderBase64 } };

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          system,
          contentBlock,
          messages: [{ role: "user", content: [contentBlock, { type: "text", text: user }] }],
        }),
      });
      const data = await response.json();
      const text = data.content.map(b => b.text || "").join("");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResult(parsed);
    } catch (err) {
      setError("Something went wrong. Check your inputs and try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Color per stagebox
  const sbColors = ["#e8a000", "#4caf50", "#2196f3", "#e040fb", "#ff5252", "#00bcd4", "#ff9800", "#8bc34a"];

  return (
    <div style={s.root}>
      <style>{css}</style>
      <div style={s.scanline} />
      <div style={s.container}>

        {/* Header */}
        <header style={s.header}>
          <div style={s.logo}>
            <span style={{ fontSize: 28, color: "#e8a000" }}>⬡</span>
            <div>
              <div className="glow" style={s.logoTitle}>PATCH GENERATOR</div>
              <div style={s.logoSub}>AI-Powered Rider Reader · v2.0</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button className={`settings-btn${showSettings ? " active" : ""}`} onClick={() => setShowSettings(v => !v)}>
              ⚙ AI SETTINGS {showSettings ? "▲" : "▼"}
            </button>
            <div style={s.liveDot}><span className="pulse-dot" />LIVE</div>
          </div>
        </header>

        {/* AI Settings */}
        {showSettings && (
          <div style={s.settingsPanel} className="fadeIn">
            <div style={s.settingsGrid}>
              <div style={s.sg}>
                <label style={s.slabel}>🎛 CONSOLE TYPE</label>
                <select style={s.sel} value={consoleType} onChange={e => setConsoleType(e.target.value)}>
                  {CONSOLE_TYPES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={s.sg}>
                <label style={s.slabel}>🎙 MIC BRAND</label>
                <select style={s.sel} value={micBrand} onChange={e => setMicBrand(e.target.value)}>
                  {MIC_BRANDS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div style={s.sg}>
                <label style={s.slabel}>🔊 MONITOR MIXES <span style={s.badge}>{numMonitors}</span></label>
                <input type="range" min={1} max={16} value={numMonitors}
                  onChange={e => setNumMonitors(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#e8a000", cursor: "pointer" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {[1,4,8,12,16].map(n => <span key={n} style={{ fontSize: 10, color: "#333", fontFamily: "monospace" }}>{n}</span>)}
                </div>
              </div>
              <div style={{ ...s.sg, gridColumn: "1 / -1" }}>
                <label style={s.slabel}>📝 CUSTOM NOTES TO AI</label>
                <textarea style={{ ...s.textarea, minHeight: 55, fontSize: 12 }}
                  placeholder='e.g. "Rock show. Bassist uses SansAmp. Lead vox center stage."'
                  value={customNotes} onChange={e => setCustomNotes(e.target.value)} rows={2} />
              </div>
            </div>
          </div>
        )}

        <div style={s.grid}>
          {/* LEFT */}
          <div style={s.col}>

            {/* Rider Upload */}
            <section style={s.card}>
              <div style={s.clabel}>01 / BAND RIDER</div>
              <div className={`upload-zone${riderDragOver ? " over" : ""}`}
                onClick={() => riderRef.current.click()}
                onDragOver={e => { e.preventDefault(); setRiderDragOver(true); }}
                onDragLeave={() => setRiderDragOver(false)}
                onDrop={e => { e.preventDefault(); setRiderDragOver(false); handleRiderUpload(e.dataTransfer.files[0]); }}>
                <input ref={riderRef} type="file" accept="image/*,application/pdf"
                  style={{ display: "none" }} onChange={e => handleRiderUpload(e.target.files[0])} />
                {riderFile ? (
                  <div style={{ width: "100%", textAlign: "center" }}>
                    {riderFile.url
                      ? <img src={riderFile.url} alt="Rider" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 4, objectFit: "contain" }} />
                      : <div style={{ fontSize: 48, marginBottom: 8 }}>📄</div>
                    }
                    <div style={{ fontSize: 10, color: "#e8a000", marginTop: 8, fontFamily: "monospace" }}>{riderFile.name}</div>
                    <div style={{ fontSize: 10, color: "#2a2a2a", marginTop: 3 }}>Click to change</div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 34, marginBottom: 10 }}>🎼</div>
                    <div style={{ fontSize: 14, color: "#555", letterSpacing: 1 }}>Drop band rider here</div>
                    <div style={{ fontSize: 11, color: "#333", marginTop: 5 }}>PDF or JPEG/JPG/PNG accepted</div>
                  </div>
                )}
              </div>
            </section>

            {/* Stagebox Setup */}
            <section style={s.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={s.clabel} className="no-mb">02 / STAGEBOX SETUP</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#444", fontFamily: "monospace" }}>
                    {totalChannels} total ch
                  </span>
                  <button className="add-btn" onClick={addStagebox}>+ ADD</button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stageboxes.map((sb, i) => (
                  <div key={i} style={{ ...s.sbRow, borderLeft: `3px solid ${sbColors[i % sbColors.length]}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: sbColors[i % sbColors.length], minWidth: 80 }}>
                        SB {i + 1}
                      </span>
                      <input
                        type="number" min={1} max={64} value={sb.channels}
                        onChange={e => updateChannels(i, e.target.value)}
                        style={s.chInput}
                      />
                      <span style={{ fontSize: 11, color: "#444" }}>channels</span>
                    </div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {Array.from({ length: Math.min(sb.channels, 16) }).map((_, ci) => (
                        <div key={ci} style={{ width: 6, height: 6, borderRadius: 1, background: sbColors[i % sbColors.length], opacity: 0.4 }} />
                      ))}
                      {sb.channels > 16 && <span style={{ fontSize: 9, color: "#444" }}>+{sb.channels - 16}</span>}
                    </div>
                    {stageboxes.length > 1 && (
                      <button className="remove-btn" onClick={() => removeStagebox(i)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Summary pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                `🎛 ${consoleType}`,
                `🎙 ${micBrand}`,
                `🔊 ${numMonitors} mons`,
                `📦 ${stageboxes.length} stagebox${stageboxes.length > 1 ? "es" : ""}`,
                ...(customNotes ? ["📝 Notes"] : [])
              ].map(pill => <span key={pill} style={s.pill}>{pill}</span>)}
            </div>

            <button className="gen-btn" onClick={handleGenerate} disabled={loading}>
              {loading ? <span className="pulse">⟳  READING RIDER…</span> : "⚡  GENERATE PATCH"}
            </button>

            {error && <div style={s.error}>{error}</div>}
          </div>

          {/* RIGHT */}
          <div style={s.col}>
            {!result && !loading && (
              <div style={s.empty}>
                <div style={{ fontSize: 50 }}>🎚️</div>
                <div style={{ fontSize: 17, color: "#333", letterSpacing: 2 }}>Patch will appear here</div>
                <div style={{ fontSize: 12, color: "#1e1e1e", textAlign: "center", lineHeight: 2 }}>
                  Upload the band rider, configure your stageboxes<br />and hit Generate.
                </div>
              </div>
            )}

            {loading && (
              <div style={s.empty}>
                <div style={{ fontSize: 44 }} className="pulse">🔍</div>
                <div style={{ fontSize: 17, color: "#444", letterSpacing: 2 }}>Reading rider…</div>
                <div style={{ fontSize: 12, color: "#2a2a2a" }}>AI is building your patch</div>
              </div>
            )}

            {result && (
              <div className="fadeIn">
                {/* Patch Table */}
                <section style={s.card}>
                  <div style={s.clabel}>PATCH LIST — {result.patch?.length} INPUTS</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          {["CH","SB","IN","SOURCE","INSTRUMENT","TYPE","MIC","STAND","NOTES"].map(h => (
                            <th key={h} style={s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.patch?.map((row, i) => {
                          const sbIdx = (row.stagebox || 1) - 1;
                          const color = sbColors[sbIdx % sbColors.length];
                          return (
                            <tr key={i} className="row-in" style={{ animationDelay: `${i * 0.03}s`, opacity: 0 }}>
                              <td style={{ ...s.td, color: "#e8a000", fontFamily: "monospace", fontWeight: 700 }}>{String(row.channel).padStart(2, "0")}</td>
                              <td style={{ ...s.td }}>
                                <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 3, padding: "2px 7px", fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>
                                  SB{row.stagebox}
                                </span>
                              </td>
                              <td style={{ ...s.td, fontFamily: "monospace", color: "#888" }}>{String(row.input).padStart(2, "0")}</td>
                              <td style={{ ...s.td, color: "#fff", fontWeight: 600 }}>{row.source}</td>
                              <td style={s.td}>{row.instrument}</td>
                              <td style={{ ...s.td, color: "#4caf50", fontFamily: "monospace", fontSize: 11 }}>{row.inputType}</td>
                              <td style={{ ...s.td, color: "#e8a000" }}>{row.mic}</td>
                              <td style={{ ...s.td, color: "#7986cb", fontSize: 11 }}>{row.stand}</td>
                              <td style={{ ...s.td, color: "#444", fontSize: 11 }}>{row.notes}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Stagebox summary */}
                <section style={{ ...s.card, marginTop: 14 }}>
                  <div style={s.clabel}>STAGEBOX SUMMARY</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {stageboxes.map((sb, i) => {
                      const sbInputs = result.patch?.filter(r => r.stagebox === i + 1) || [];
                      const color = sbColors[i % sbColors.length];
                      return (
                        <div key={i} style={{ ...s.monCard, borderTop: `2px solid ${color}` }}>
                          <div style={{ fontFamily: "monospace", color, fontSize: 12, fontWeight: 700 }}>STAGEBOX {i + 1}</div>
                          <div style={{ fontSize: 11, color: "#555", margin: "4px 0 8px" }}>{sbInputs.length}/{sb.channels} used</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            {sbInputs.map(inp => (
                              <div key={inp.input} style={{ fontSize: 10, color: "#666", fontFamily: "monospace" }}>
                                <span style={{ color }}>{String(inp.input).padStart(2,"0")}</span> — {inp.source}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Monitor Mixes */}
                {result.monitorMixes?.length > 0 && (
                  <section style={{ ...s.card, marginTop: 14 }}>
                    <div style={s.clabel}>MONITOR MIXES — {result.monitorMixes.length}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {result.monitorMixes.map((m, i) => (
                        <div key={i} style={s.monCard}>
                          <div style={{ fontFamily: "monospace", color: "#e8a000", fontSize: 11, letterSpacing: 2 }}>{m.mix}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc", margin: "4px 0 8px" }}>{m.who}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {m.channels?.map(c => <span key={c} style={s.chbadge}>{c}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {result.generalNotes && (
                  <section style={{ ...s.card, marginTop: 14 }}>
                    <div style={s.clabel}>ENGINEER NOTES</div>
                    <div style={{ fontSize: 12, color: "#666", lineHeight: 1.8, fontFamily: "monospace" }}>{result.generalNotes}</div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: #0a0a0a; } ::-webkit-scrollbar-thumb { background: #e8a000; border-radius: 3px; }
  textarea:focus, select:focus, input:focus { outline: none; }
  .glow { text-shadow: 0 0 18px rgba(232,160,0,0.55); }
  @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
  .pulse { animation: pulse 1.3s infinite; display:inline-block; }
  @keyframes dotpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.7)} }
  .pulse-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#4caf50; margin-right:8px; animation:dotpulse 2s infinite; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .fadeIn { animation: fadeIn 0.35s ease; }
  @keyframes rowIn { from{opacity:0;transform:translateX(-5px)} to{opacity:1;transform:translateX(0)} }
  .row-in { animation: rowIn 0.25s ease forwards; }
  .settings-btn { font-family:'Share Tech Mono',monospace; font-size:10px; letter-spacing:2px; background:transparent; border:1px solid #222; color:#555; padding:8px 14px; border-radius:4px; cursor:pointer; transition:all 0.15s; }
  .settings-btn:hover, .settings-btn.active { border-color:#e8a000; color:#e8a000; }
  .upload-zone { border:1px dashed #222; border-radius:4px; padding:20px 16px; cursor:pointer; text-align:center; min-height:150px; display:flex; align-items:center; justify-content:center; transition:all 0.2s; }
  .upload-zone:hover, .upload-zone.over { border-color:#e8a000; background:rgba(232,160,0,0.04); }
  .gen-btn { width:100%; padding:14px; background:#e8a000; border:none; border-radius:4px; color:#0d0d0d; font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:700; letter-spacing:3px; cursor:pointer; transition:all 0.15s; }
  .gen-btn:hover { background:#ffb700; transform:translateY(-1px); box-shadow:0 6px 22px rgba(232,160,0,0.3); }
  .gen-btn:active { transform:translateY(0); }
  .gen-btn:disabled { background:#3a2800; color:#e8a000; cursor:not-allowed; transform:none; box-shadow:none; }
  .add-btn { font-family:'Share Tech Mono',monospace; font-size:10px; letter-spacing:2px; background:transparent; border:1px solid #2a2a2a; color:#555; padding:5px 10px; border-radius:3px; cursor:pointer; transition:all 0.15s; }
  .add-btn:hover { border-color:#e8a000; color:#e8a000; }
  .remove-btn { background:transparent; border:1px solid #2a2a2a; color:#444; width:22px; height:22px; border-radius:3px; cursor:pointer; font-size:10px; transition:all 0.15s; flex-shrink:0; }
  .remove-btn:hover { border-color:#e05050; color:#e05050; }
  .no-mb { margin-bottom: 0 !important; }
`;

const s = {
  root: { minHeight: "100vh", background: "#0d0d0d", fontFamily: "'Barlow Condensed',sans-serif", color: "#d4d4d4" },
  scanline: { position: "fixed", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(transparent,rgba(232,160,0,0.05),transparent)", animation: "scanline 8s linear infinite", pointerEvents: "none", zIndex: 100 },
  container: { maxWidth: 1380, margin: "0 auto", padding: "22px 20px" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, borderBottom: "1px solid #1a1a1a", paddingBottom: 16 },
  logo: { display: "flex", alignItems: "center", gap: 14 },
  logoTitle: { fontFamily: "'Share Tech Mono',monospace", fontSize: 20, color: "#e8a000", letterSpacing: 4 },
  logoSub: { fontSize: 10, color: "#333", letterSpacing: 2, marginTop: 3 },
  liveDot: { display: "flex", alignItems: "center", fontSize: 10, letterSpacing: 3, color: "#4caf50", fontFamily: "'Share Tech Mono',monospace" },
  settingsPanel: { background: "#111", border: "1px solid #1a1a1a", borderRadius: 6, padding: "18px 22px", marginBottom: 18 },
  settingsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 },
  sg: { display: "flex", flexDirection: "column", gap: 8 },
  slabel: { fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 2, color: "#e8a000", display: "flex", alignItems: "center", gap: 8 },
  badge: { background: "#e8a000", color: "#000", borderRadius: 3, padding: "1px 7px", fontWeight: 700, fontSize: 12 },
  sel: { background: "#0a0a0a", border: "1px solid #222", color: "#bbb", padding: "8px 10px", borderRadius: 4, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14 },
  grid: { display: "grid", gridTemplateColumns: "370px 1fr", gap: 18, alignItems: "start" },
  col: { display: "flex", flexDirection: "column", gap: 14 },
  card: { background: "#111", border: "1px solid #1a1a1a", borderRadius: 6, padding: "16px 18px" },
  clabel: { fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 3, color: "#e8a000", marginBottom: 12 },
  textarea: { width: "100%", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4, color: "#bbb", fontSize: 13, fontFamily: "'Share Tech Mono',monospace", padding: "10px 13px", resize: "vertical", lineHeight: 1.75 },
  sbRow: { display: "flex", alignItems: "center", gap: 10, background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 4, padding: "8px 12px" },
  chInput: { background: "#111", border: "1px solid #222", color: "#e8a000", padding: "4px 8px", borderRadius: 3, fontFamily: "monospace", fontSize: 13, width: 54, textAlign: "center" },
  pill: { fontSize: 10, fontFamily: "'Share Tech Mono',monospace", color: "#3a3a3a", background: "#111", border: "1px solid #1a1a1a", padding: "4px 10px", borderRadius: 20, letterSpacing: 1 },
  error: { background: "#180808", border: "1px solid #4a1010", color: "#d04040", padding: "10px 13px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 14 },
  th: { fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 2, color: "#2a2a2a", padding: "6px 10px", textAlign: "left", borderBottom: "1px solid #1a1a1a" },
  td: { padding: "8px 10px", borderBottom: "1px solid #111", verticalAlign: "top", color: "#777" },
  monCard: { background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4, padding: "12px 14px", minWidth: 120 },
  chbadge: { background: "#181818", border: "1px solid #222", borderRadius: 3, padding: "2px 6px", fontFamily: "monospace", fontSize: 10, color: "#555" },
};
