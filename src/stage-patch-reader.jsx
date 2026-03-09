import { useState, useRef } from "react";

const MODEL = "claude-sonnet-4-20250514";

const CONSOLE_TYPES = ["Any", "Avid SC48", "Avid S6L", "Yamaha CL5", "Yamaha QL5", "DiGiCo SD9", "DiGiCo SD12", "Allen & Heath dLive", "Midas PRO2", "SSL Live L500", "Soundcraft Vi7000"];
const MIC_BRANDS = ["Any", "Shure", "Sennheiser", "AKG", "Neumann", "DPA", "Audix", "Electro-Voice", "Beyerdynamic"];

function buildSystemPrompt({ consoleType, micBrand, numMonitors, customNotes }) {
  return `You are an expert live sound engineer with 20+ years of experience.
You will receive a stage plot image and a channel list from a sound technician.
Your job is to generate a complete, professional patch list.

Settings to apply:
- Console: ${consoleType !== "Any" ? consoleType : "any console"}
- Preferred mic brand: ${micBrand !== "Any" ? micBrand + " (use their catalog when possible)" : "any brand, choose best for each source"}
- Number of monitor mixes to generate: ${numMonitors}
${customNotes ? `- Engineer notes: ${customNotes}` : ""}

Return a JSON object ONLY — no markdown, no explanation, no preamble. Format:
{
  "patch": [
    {
      "channel": 1,
      "source": "Kick In",
      "instrument": "Kick Drum",
      "inputType": "XLR",
      "micSuggestion": "Shure Beta 52A",
      "position": "Drum Riser - Center",
      "notes": "Inside kick, angled toward beater"
    }
  ],
  "monitorMixes": [
    {
      "mix": "Mon 1",
      "who": "Vocalist",
      "channels": [1, 2, 5, 6]
    }
  ],
  "generalNotes": "Any important patching or console-specific observations"
}

Be precise and practical. Match stage plot elements to the channel list. Generate exactly ${numMonitors} monitor mix(es).`;
}

export default function StagePatchReader() {
  const [channelList, setChannelList] = useState("");
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef();

  const [consoleType, setConsoleType] = useState("Any");
  const [micBrand, setMicBrand] = useState("Any");
  const [numMonitors, setNumMonitors] = useState(4);
  const [customNotes, setCustomNotes] = useState("");

  const handleImageUpload = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage({ url: e.target.result, name: file.name, type: file.type });
      setImageBase64(e.target.result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleImageUpload(e.dataTransfer.files[0]);
  };

  const handleGenerate = async () => {
    if (!imageBase64 || !channelList.trim()) {
      setError("Please provide both a stage plot image and a channel list.");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          system: buildSystemPrompt({ consoleType, micBrand, numMonitors, customNotes }),
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: image.type, data: imageBase64 } },
              { type: "text", text: `Channel list:\n${channelList}\n\nGenerate the complete patch.` },
            ],
          }],
        }),
      });
      const data = await response.json();
      const text = data.content.map((b) => b.text || "").join("");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResult(parsed);
    } catch (err) {
      setError("Something went wrong. Check your inputs and try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
              <div style={s.logoSub}>AI-Powered Stage Plot Reader</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              className={`settings-btn${showSettings ? " active" : ""}`}
              onClick={() => setShowSettings(v => !v)}
            >
              ⚙ AI SETTINGS {showSettings ? "▲" : "▼"}
            </button>
            <div style={s.liveDot}><span className="pulse-dot" />LIVE</div>
          </div>
        </header>

        {/* AI Settings Panel */}
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
                <label style={s.slabel}>
                  🔊 MONITOR MIXES
                  <span style={s.badge}>{numMonitors}</span>
                </label>
                <input
                  type="range" min={1} max={16} value={numMonitors}
                  onChange={e => setNumMonitors(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#e8a000", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {[1,4,8,12,16].map(n => <span key={n} style={{ fontSize: 10, color: "#333", fontFamily: "monospace" }}>{n}</span>)}
                </div>
              </div>

              <div style={{ ...s.sg, gridColumn: "1 / -1" }}>
                <label style={s.slabel}>📝 CUSTOM NOTES TO AI</label>
                <textarea
                  style={{ ...s.textarea, minHeight: 60, fontSize: 12 }}
                  placeholder='e.g. "Rock show. Bassist uses SansAmp. Drummer hits hard. Lead vox center stage."'
                  value={customNotes}
                  onChange={e => setCustomNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>
        )}

        <div style={s.grid}>
          {/* LEFT COLUMN */}
          <div style={s.col}>
            <section style={s.card}>
              <div style={s.clabel}>01 / STAGE PLOT</div>
              <div
                className={`upload-zone${dragOver ? " over" : ""}`}
                onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => handleImageUpload(e.target.files[0])} />
                {image ? (
                  <div style={{ width: "100%", textAlign: "center" }}>
                    <img src={image.url} alt="Stage plot" style={{ maxWidth: "100%", maxHeight: 190, borderRadius: 4, objectFit: "contain" }} />
                    <div style={{ fontSize: 10, color: "#444", marginTop: 8, fontFamily: "monospace" }}>{image.name}</div>
                    <div style={{ fontSize: 10, color: "#222", marginTop: 2 }}>Click to change</div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 34, marginBottom: 10 }}>📐</div>
                    <div style={{ fontSize: 14, color: "#555", letterSpacing: 1 }}>Drop stage plot here</div>
                    <div style={{ fontSize: 11, color: "#2a2a2a", marginTop: 4 }}>or click to browse</div>
                  </div>
                )}
              </div>
            </section>

            <section style={s.card}>
              <div style={s.clabel}>02 / CHANNEL LIST</div>
              <div style={{ fontSize: 11, color: "#444", marginBottom: 10 }}>One per line — <span style={{ color: "#666", fontFamily: "monospace" }}>1. Kick In</span></div>
              <textarea
                style={s.textarea}
                placeholder={"1. Kick In\n2. Snare Top\n3. Snare Bottom\n4. Hi-Hat\n5. OH L\n6. OH R\n7. Bass DI\n8. Guitar\n9. Keys\n10. Vox Lead"}
                value={channelList}
                onChange={e => setChannelList(e.target.value)}
                rows={11}
              />
            </section>

            {/* Active settings summary pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                `🎛 ${consoleType}`,
                `🎙 ${micBrand}`,
                `🔊 ${numMonitors} mon${numMonitors > 1 ? "s" : ""}`,
                ...(customNotes ? ["📝 Notes active"] : [])
              ].map(pill => (
                <span key={pill} style={s.pill}>{pill}</span>
              ))}
            </div>

            <button
              className="gen-btn"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? <span className="pulse">⟳  READING STAGE PLOT…</span> : "⚡  GENERATE PATCH"}
            </button>

            {error && <div style={s.error}>{error}</div>}
          </div>

          {/* RIGHT COLUMN */}
          <div style={s.col}>
            {!result && !loading && (
              <div style={s.empty}>
                <div style={{ fontSize: 50 }}>🎚️</div>
                <div style={{ fontSize: 17, color: "#333", letterSpacing: 2 }}>Patch will appear here</div>
                <div style={{ fontSize: 12, color: "#222", textAlign: "center", lineHeight: 1.9 }}>
                  Upload your stage plot, enter your channel list,<br/>configure AI settings and hit Generate.
                </div>
              </div>
            )}

            {loading && (
              <div style={s.empty}>
                <div style={{ fontSize: 44 }} className="pulse">🔍</div>
                <div style={{ fontSize: 17, color: "#444", letterSpacing: 2 }}>Reading stage plot…</div>
                <div style={{ fontSize: 12, color: "#2a2a2a" }}>AI is analyzing your inputs</div>
              </div>
            )}

            {result && (
              <div className="fadeIn">
                {/* Patch Table */}
                <section style={s.card}>
                  <div style={s.clabel}>PATCH LIST — {result.patch?.length} CHANNELS</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          {["CH","SOURCE","INSTRUMENT","INPUT","MIC","POSITION","NOTES"].map(h => (
                            <th key={h} style={s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.patch?.map((row, i) => (
                          <tr key={i} className="row-in" style={{ animationDelay: `${i*0.04}s`, opacity: 0 }}>
                            <td style={{ ...s.td, color: "#e8a000", fontFamily: "monospace", fontWeight: 700 }}>{String(row.channel).padStart(2,"0")}</td>
                            <td style={{ ...s.td, color: "#fff", fontWeight: 600 }}>{row.source}</td>
                            <td style={s.td}>{row.instrument}</td>
                            <td style={{ ...s.td, color: "#4caf50", fontFamily: "monospace", fontSize: 11 }}>{row.inputType}</td>
                            <td style={{ ...s.td, color: "#e8a000" }}>{row.micSuggestion}</td>
                            <td style={s.td}>{row.position}</td>
                            <td style={{ ...s.td, color: "#555", fontSize: 11 }}>{row.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Monitor Mixes */}
                {result.monitorMixes?.length > 0 && (
                  <section style={{ ...s.card, marginTop: 16 }}>
                    <div style={s.clabel}>MONITOR MIXES — {result.monitorMixes.length} MIXES</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {result.monitorMixes.map((m, i) => (
                        <div key={i} style={s.monCard}>
                          <div style={{ fontFamily: "monospace", color: "#e8a000", fontSize: 11, letterSpacing: 2 }}>{m.mix}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc", marginTop: 4, marginBottom: 8 }}>{m.who}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {m.channels?.map(c => <span key={c} style={s.chbadge}>{c}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Notes */}
                {result.generalNotes && (
                  <section style={{ ...s.card, marginTop: 16 }}>
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
  textarea:focus, select:focus { outline: none; }
  .glow { text-shadow: 0 0 18px rgba(232,160,0,0.55); }
  @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
  .pulse { animation: pulse 1.3s infinite; }
  @keyframes dotpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
  .pulse-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#4caf50; margin-right:8px; animation:dotpulse 2s infinite; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .fadeIn { animation: fadeIn 0.35s ease; }
  @keyframes rowIn { from{opacity:0;transform:translateX(-5px)} to{opacity:1;transform:translateX(0)} }
  .row-in { animation: rowIn 0.28s ease forwards; }
  .settings-btn { font-family:'Share Tech Mono',monospace; font-size:10px; letter-spacing:2px; background:transparent; border:1px solid #222; color:#555; padding:8px 14px; border-radius:4px; cursor:pointer; transition:all 0.15s; }
  .settings-btn:hover, .settings-btn.active { border-color:#e8a000; color:#e8a000; }
  .upload-zone { border:1px dashed #222; border-radius:4px; padding:20px 16px; cursor:pointer; text-align:center; min-height:160px; display:flex; align-items:center; justify-content:center; transition:all 0.2s; }
  .upload-zone:hover, .upload-zone.over { border-color:#e8a000; background:rgba(232,160,0,0.04); }
  .gen-btn { width:100%; padding:14px; background:#e8a000; border:none; border-radius:4px; color:#0d0d0d; font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:700; letter-spacing:3px; cursor:pointer; transition:all 0.15s; }
  .gen-btn:hover { background:#ffb700; transform:translateY(-1px); box-shadow:0 6px 22px rgba(232,160,0,0.35); }
  .gen-btn:active { transform:translateY(0); }
  .gen-btn:disabled { background:#3a2800; color:#e8a000; cursor:not-allowed; transform:none; box-shadow:none; }
`;

const s = {
  root: { minHeight: "100vh", background: "#0d0d0d", fontFamily: "'Barlow Condensed',sans-serif", color: "#d4d4d4" },
  scanline: { position: "fixed", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(transparent,rgba(232,160,0,0.05),transparent)", animation: "scanline 8s linear infinite", pointerEvents: "none", zIndex: 100 },
  container: { maxWidth: 1320, margin: "0 auto", padding: "22px 20px" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, borderBottom: "1px solid #1a1a1a", paddingBottom: 16 },
  logo: { display: "flex", alignItems: "center", gap: 14 },
  logoTitle: { fontFamily: "'Share Tech Mono',monospace", fontSize: 20, color: "#e8a000", letterSpacing: 4 },
  logoSub: { fontSize: 10, color: "#3a3a3a", letterSpacing: 2, marginTop: 3 },
  liveDot: { display: "flex", alignItems: "center", fontSize: 10, letterSpacing: 3, color: "#4caf50", fontFamily: "'Share Tech Mono',monospace" },
  settingsPanel: { background: "#111", border: "1px solid #1a1a1a", borderRadius: 6, padding: "18px 22px", marginBottom: 18 },
  settingsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 },
  sg: { display: "flex", flexDirection: "column", gap: 8 },
  slabel: { fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 2, color: "#e8a000", display: "flex", alignItems: "center", gap: 8 },
  badge: { background: "#e8a000", color: "#000", borderRadius: 3, padding: "1px 7px", fontWeight: 700, fontSize: 12, fontFamily: "monospace" },
  sel: { background: "#0a0a0a", border: "1px solid #222", color: "#bbb", padding: "8px 10px", borderRadius: 4, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14 },
  grid: { display: "grid", gridTemplateColumns: "370px 1fr", gap: 18, alignItems: "start" },
  col: { display: "flex", flexDirection: "column", gap: 14 },
  card: { background: "#111", border: "1px solid #1a1a1a", borderRadius: 6, padding: "16px 18px" },
  clabel: { fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 3, color: "#e8a000", marginBottom: 12 },
  textarea: { width: "100%", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4, color: "#bbb", fontSize: 13, fontFamily: "'Share Tech Mono',monospace", padding: "10px 13px", resize: "vertical", lineHeight: 1.75 },
  pill: { fontSize: 10, fontFamily: "'Share Tech Mono',monospace", color: "#3a3a3a", background: "#111", border: "1px solid #1a1a1a", padding: "4px 10px", borderRadius: 20, letterSpacing: 1 },
  error: { background: "#180808", border: "1px solid #4a1010", color: "#d04040", padding: "10px 13px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 14, color: "#222" },
  th: { fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 2, color: "#2a2a2a", padding: "6px 10px", textAlign: "left", borderBottom: "1px solid #1a1a1a" },
  td: { padding: "8px 10px", borderBottom: "1px solid #141414", verticalAlign: "top", color: "#888" },
  monCard: { background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4, padding: "12px 14px", minWidth: 130 },
  chbadge: { background: "#181818", border: "1px solid #222", borderRadius: 3, padding: "2px 6px", fontFamily: "monospace", fontSize: 10, color: "#666" },
};
