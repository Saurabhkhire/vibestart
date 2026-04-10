import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  saveProfile,
  addCompetitors,
  getProfile,
  runAnalysis,
  simulateVc,
  exportReportPdf,
} from "./api.js";
import {
  AnalysisResult,
  VcSimulatorView,
} from "./components/AnalysisResult.jsx";
import { CreativeStudio } from "./components/CreativeStudio.jsx";

const STORAGE_KEY = "vibestart_profile_id";

const EMPTY_PANELS = {
  comparison: null,
  roast: null,
  jobs: null,
  collaborations: null,
  extras: null,
  vcs: null,
  gaps: null,
  ideas: null,
};

const PANEL_TITLES = {
  comparison: "Deep competitor comparison",
  roast: "Roast",
  jobs: "Hiring & job opportunities",
  collaborations: "Collaborations",
  extras: "Moats, pivots & extras",
  vcs: "VCs you may have missed",
  gaps: "Strategic gaps",
  ideas: "Startup ideas for you",
};

export default function App() {
  const [profileId, setProfileId] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ""
  );
  const [startupText, setStartupText] = useState("");
  const [startupUrl, setStartupUrl] = useState("");
  const [competitorUrlsRaw, setCompetitorUrlsRaw] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [lastProfile, setLastProfile] = useState(null);
  const [panels, setPanels] = useState(() => ({ ...EMPTY_PANELS }));
  const [vcStage, setVcStage] = useState("");
  const [vcGeo, setVcGeo] = useState("");
  const [vcRaise, setVcRaise] = useState("");
  const [vcFocus, setVcFocus] = useState("");
  const [vcPersona, setVcPersona] = useState("");
  const [pitchNotes, setPitchNotes] = useState("");
  const [vcSimResult, setVcSimResult] = useState(null);

  const competitorUrlList = useMemo(
    () =>
      competitorUrlsRaw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [competitorUrlsRaw]
  );

  const persistProfile = useCallback((id) => {
    setProfileId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = localStorage.getItem(STORAGE_KEY);
      if (!id) return;
      try {
        await getProfile(id);
      } catch {
        if (cancelled) return;
        localStorage.removeItem(STORAGE_KEY);
        setProfileId("");
        setLastProfile(null);
        setPanels({ ...EMPTY_PANELS });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveProfile = async () => {
    setError("");
    setLoading("profile");
    try {
      const data = await saveProfile({
        profileId: profileId || undefined,
        startupText,
        startupUrl,
      });
      persistProfile(data.profileId);
      setLastProfile(data);
      setPanels({ ...EMPTY_PANELS });
      setVcSimResult(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  };

  const handleAddCompetitors = async () => {
    if (!profileId) {
      setError("Save your startup profile first.");
      return;
    }
    if (competitorUrlList.length === 0) {
      setError("Add at least one competitor URL (one per line).");
      return;
    }
    setError("");
    setLoading("competitors");
    try {
      await addCompetitors({ profileId, urls: competitorUrlList });
      const full = await getProfile(profileId);
      setLastProfile((p) => ({ ...p, full }));
      setPanels({ ...EMPTY_PANELS });
      setVcSimResult(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  };

  const run = async (key) => {
    if (!profileId) {
      setError("Save your startup profile first.");
      return;
    }
    setError("");
    setLoading(key);
    try {
      const extra =
        key === "vcs" &&
        (vcStage.trim() ||
          vcGeo.trim() ||
          vcRaise.trim() ||
          vcFocus.trim())
          ? {
              founderPreferences: {
                ...(vcStage.trim() && { stage: vcStage.trim() }),
                ...(vcGeo.trim() && { geography: vcGeo.trim() }),
                ...(vcRaise.trim() && {
                  raise_amount_band: vcRaise.trim(),
                }),
                ...(vcFocus.trim() && {
                  investor_type_focus: vcFocus.trim(),
                }),
              },
            }
          : {};
      const data = await runAnalysis(key, profileId, extra);
      setPanels((prev) => ({ ...prev, [key]: data.result }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  };

  const runVcSim = async () => {
    if (!profileId) {
      setError("Save your startup profile first.");
      return;
    }
    setError("");
    setLoading("vc-sim");
    try {
      const data = await simulateVc({
        profileId,
        vcPersona: vcPersona.trim() || undefined,
        pitchNotes: pitchNotes.trim() || undefined,
      });
      setVcSimResult(data.result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  };

  const handleExportPdf = async () => {
    if (!profileId) {
      setError("Save your startup profile first.");
      return;
    }
    setError("");
    setLoading("pdf");
    try {
      let competitors = [];
      try {
        const full = await getProfile(profileId);
        competitors = (full.competitors || []).map((c) => ({
          url: c.url,
          summary: c.summary,
        }));
      } catch {
        /* profile fetch optional for PDF */
      }
      await exportReportPdf({
        profileId,
        combinedSummary: lastProfile?.combinedSummary || "",
        assumptions: lastProfile?.assumptions,
        tags: lastProfile?.tags,
        startupUrl: startupUrl || undefined,
        competitors,
        panels,
        vcSimulator: vcSimResult,
        mergeSnapshots: true,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Local-first startup OS</p>
        <h1>VibeStart</h1>
        <p className="lede">
          Describe your startup or paste your site URL (or both). Add
          competitor URLs only for <strong>Deep competitor comparison</strong>{" "}
          — other intelligence runs focus on your product alone. VC match,
          hiring, gaps, ideas, roasts, and more — powered by OpenAI.
        </p>
      </header>

      <main className="grid">
        <section className="card">
          <h2>1. Your startup</h2>
          <p className="hint">
            Optional free-text pitch, optional URL — we merge and cache a
            combined brief server-side.
          </p>
          <textarea
            className="textarea"
            placeholder="What you build, for whom, why now, traction, pricing…"
            rows={7}
            value={startupText}
            onChange={(e) => setStartupText(e.target.value)}
          />
          <label className="label">Website URL</label>
          <input
            className="input"
            placeholder="https://yoursite.com"
            value={startupUrl}
            onChange={(e) => setStartupUrl(e.target.value)}
          />
          <button
            type="button"
            className="btn primary"
            disabled={loading === "profile"}
            onClick={handleSaveProfile}
          >
            {loading === "profile" ? "Saving…" : "Save profile & scrape site"}
          </button>
          {profileId && (
            <p className="meta">
              Profile ID:{" "}
              <code className="mono">{profileId.slice(0, 8)}…</code>
            </p>
          )}
          {lastProfile?.combinedSummary && (
            <details className="details" open>
              <summary>Combined brief</summary>
              <div className="prose-md profile-brief">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {lastProfile.combinedSummary}
                </ReactMarkdown>
              </div>
              {(lastProfile.assumptions?.length > 0 ||
                lastProfile.tags?.length > 0) && (
                <div className="profile-meta-below">
                  {lastProfile.tags?.length > 0 && (
                    <div className="meta-block">
                      <span className="muted-label">Tags</span>
                      <ul className="chips chips--teal">
                        {lastProfile.tags.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {lastProfile.assumptions?.length > 0 && (
                    <div className="meta-block">
                      <span className="muted-label">Assumptions</span>
                      <ul className="simple-list tight">
                        {lastProfile.assumptions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </details>
          )}
        </section>

        <section className="card">
          <h2>2. Competitors (for deep comparison only)</h2>
          <p className="hint">
            Used exclusively by <strong>Deep competitor comparison</strong>. One
            URL per line; each page is fetched and saved under{" "}
            <code className="mono">backend/data/raw_html/</code> with a row in
            SQLite.
          </p>
          <textarea
            className="textarea"
            rows={6}
            placeholder={`https://competitor-a.com\nhttps://competitor-b.com`}
            value={competitorUrlsRaw}
            onChange={(e) => setCompetitorUrlsRaw(e.target.value)}
          />
          <button
            type="button"
            className="btn"
            disabled={loading === "competitors"}
            onClick={handleAddCompetitors}
          >
            {loading === "competitors"
              ? "Scraping competitors…"
              : "Scrape & attach competitors"}
          </button>
        </section>

        <section className="card span-2">
          <h2>3. VC preferences (for matching)</h2>
          <p className="hint">
            Optional filters sent with <strong>VCs you may have missed</strong>{" "}
            so rankings skew toward your stage, geography, raise size, and
            investor type.
          </p>
          <div className="vc-prefs-grid">
            <input
              className="input"
              placeholder="Stage (e.g. pre-seed, Series A)"
              value={vcStage}
              onChange={(e) => setVcStage(e.target.value)}
            />
            <input
              className="input"
              placeholder="Geography focus"
              value={vcGeo}
              onChange={(e) => setVcGeo(e.target.value)}
            />
            <input
              className="input"
              placeholder="Raise / check size band"
              value={vcRaise}
              onChange={(e) => setVcRaise(e.target.value)}
            />
            <input
              className="input"
              placeholder="Investor type (e.g. micro-VC, operator angel)"
              value={vcFocus}
              onChange={(e) => setVcFocus(e.target.value)}
            />
          </div>
        </section>

        <section className="card span-2">
          <h2>4. Intelligence runs</h2>
          <p className="hint">
            Uses your SQLite-backed context + OpenAI. Add competitors first for
            richer output. VC names and match scores are model estimates—always
            verify thesis and outreach yourself.
          </p>
          <div className="btn-row btn-row--wrap">
            <button
              type="button"
              className="btn accent"
              disabled={!!loading}
              onClick={() => run("comparison")}
            >
              Deep competitor comparison
            </button>
            <button
              type="button"
              className="btn accent"
              disabled={!!loading}
              onClick={() => run("vcs")}
            >
              VCs you may have missed
            </button>
            <button
              type="button"
              className="btn"
              disabled={!!loading}
              onClick={() => run("jobs")}
            >
              Hiring & job opportunities
            </button>
            <button
              type="button"
              className="btn"
              disabled={!!loading}
              onClick={() => run("gaps")}
            >
              Strategic gaps
            </button>
            <button
              type="button"
              className="btn"
              disabled={!!loading}
              onClick={() => run("ideas")}
            >
              Startup ideas for you
            </button>
            <button
              type="button"
              className="btn warn"
              disabled={!!loading}
              onClick={() => run("roast")}
            >
              Roast
            </button>
            <button
              type="button"
              className="btn"
              disabled={!!loading}
              onClick={() => run("collaborations")}
            >
              Collaborations
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!!loading}
              onClick={() => run("extras")}
            >
              Moats, pivots & extras
            </button>
          </div>
          {error && <p className="err">{error}</p>}
        </section>

        <section className="card span-2">
          <h2>5. Creative studio (ads &amp; stories)</h2>
          <p className="hint">
            Paste a <strong>product or landing-page URL</strong>. We pull public
            page text, optionally blend your saved startup profile, then generate
            channel-ready ad copy — with an optional <strong>DALL·E</strong> image
            — or a brand story as <strong>text</strong> or a <strong>visual
            storyboard</strong> (several images).
          </p>
          <CreativeStudio profileId={profileId} />
        </section>

        <section className="card span-2">
          <h2>6. VC pitch simulator</h2>
          <p className="hint">
            Role-play a first meeting: the model answers as a VC persona from
            your brief (not real investors). Add how you&apos;d open the pitch
            or which firm style you want.
          </p>
          <label className="label">VC persona (optional)</label>
          <input
            className="input"
            placeholder='e.g. "Seed partner, B2B SaaS, NYC, skeptical on TAM"'
            value={vcPersona}
            onChange={(e) => setVcPersona(e.target.value)}
          />
          <label className="label">Extra pitch notes (optional)</label>
          <textarea
            className="textarea"
            rows={4}
            placeholder="Traction, ask, why now, anything not in the combined brief…"
            value={pitchNotes}
            onChange={(e) => setPitchNotes(e.target.value)}
          />
          <div className="btn-row">
            <button
              type="button"
              className="btn accent"
              disabled={!!loading}
              onClick={runVcSim}
            >
              {loading === "vc-sim" ? "Simulating…" : "Run VC simulator"}
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!!loading}
              onClick={handleExportPdf}
            >
              {loading === "pdf"
                ? "Building PDF…"
                : "Download PDF report (all sections)"}
            </button>
          </div>
          <p className="hint pdf-hint">
            PDF merges what&apos;s on screen plus the{" "}
            <strong>latest saved snapshots</strong> from the database for any
            analysis you already ran this session—run each button once, then
            export.
          </p>
        </section>

        <section className="card span-2 ideas-card">
          <h2>More ideas to explore</h2>
          <ul className="simple-list ideas-list">
            <li>
              <strong>Run-then-bundle:</strong> execute comparison, VCs, roast,
              hiring, gaps, ideas, collabs, extras—then one PDF for your deck
              appendix or investors.
            </li>
            <li>
              <strong>Iterate the simulator:</strong> tighten persona after each
              response (e.g. &quot;healthcare-only, no pharma&quot;) to stress-test
              objections.
            </li>
            <li>
              <strong>Next build:</strong> email intro drafts per VC row,
              calendar-ready diligence checklist export, or a &quot;red team&quot;
              panel that argues against the raise.
            </li>
          </ul>
        </section>

        {vcSimResult && (
          <section className="card span-2 output-card">
            <h2>VC pitch simulator — result</h2>
            <VcSimulatorView data={vcSimResult} />
          </section>
        )}

        {Object.entries(panels).map(([key, val]) =>
          val ? (
            <section key={key} className="card span-2 output-card">
              <h2>{PANEL_TITLES[key] || key}</h2>
              <AnalysisResult panelKey={key} data={val} />
            </section>
          ) : null
        )}
      </main>

      <footer className="footer">
        <span>React · Node · SQLite · local HTML cache · OpenAI</span>
      </footer>
    </div>
  );
}
