import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { creativeAd, creativeStory, downloadStoryPdf } from "../api.js";

export function CreativeStudio({ profileId, startupText, startupUrl }) {
  const [adMode, setAdMode] = useState("text");
  const [storyMode, setStoryMode] = useState("text");
  const [adResult, setAdResult] = useState(null);
  const [storyResult, setStoryResult] = useState(null);
  const [localErr, setLocalErr] = useState("");
  const [busy, setBusy] = useState("");

  const canRun =
    !!(startupText || "").trim() ||
    !!(startupUrl || "").trim() ||
    !!profileId;

  const runAd = async () => {
    if (!canRun) {
      setLocalErr(
        "Add a startup description and/or website URL in section 1 first."
      );
      return;
    }
    setLocalErr("");
    setBusy("ad");
    setAdResult(null);
    try {
      const data = await creativeAd({
        profileId: profileId || undefined,
        startupText: (startupText || "").trim() || undefined,
        startupUrl: (startupUrl || "").trim() || undefined,
        output: adMode === "image" ? "image" : "text",
      });
      setAdResult(data);
    } catch (e) {
      setLocalErr(e.message);
    } finally {
      setBusy("");
    }
  };

  const runStory = async () => {
    if (!canRun) {
      setLocalErr(
        "Add a startup description and/or website URL in section 1 first."
      );
      return;
    }
    setLocalErr("");
    setBusy("story");
    setStoryResult(null);
    try {
      const data = await creativeStory({
        profileId: profileId || undefined,
        startupText: (startupText || "").trim() || undefined,
        startupUrl: (startupUrl || "").trim() || undefined,
        output: storyMode === "images" ? "images" : "text",
      });
      setStoryResult(data);
    } catch (e) {
      setLocalErr(e.message);
    } finally {
      setBusy("");
    }
  };

  const ad = adResult?.result;
  const story = storyResult?.result;
  const lastCtx = storyResult?.context || adResult?.context;
  const downloadAdImage = () => {
    const u = ad?.image?.url;
    if (!u) return;
    const a = document.createElement("a");
    a.href = u;
    a.download = "vibestart-ad.png";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="creative-studio">
      <p className="hint">
        Uses the <strong>description and website URL from section 1</strong>{" "}
        (whatever you&apos;ve typed now — saved or not). We scrape the URL when
        possible and blend your pitch. No separate URL field here.
      </p>
      {lastCtx && (
        <p className="hint tiny-disclaimer">
          Last run context:{" "}
          <strong>{lastCtx.pageTitle || "—"}</strong>
          {lastCtx.source && (
            <>
              {" "}
              <span className="mono">({lastCtx.source})</span>
            </>
          )}
          {lastCtx.productUrl && (
            <>
              {" "}
              · <span className="mono">{lastCtx.productUrl}</span>
            </>
          )}
          {lastCtx.scrapeNote && <> · {lastCtx.scrapeNote}</>}
        </p>
      )}

      {localErr && <p className="err">{localErr}</p>}

      <div className="creative-split">
        <div className="creative-block">
          <h3 className="out-h3">Ad generator</h3>
          <div className="mode-row">
            <label className="radio-label">
              <input
                type="radio"
                name="adMode"
                checked={adMode === "text"}
                onChange={() => setAdMode("text")}
              />
              Text ad
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="adMode"
                checked={adMode === "image"}
                onChange={() => setAdMode("image")}
              />
              Image ad only (with in-image text + brand)
            </label>
          </div>
          <button
            type="button"
            className="btn accent"
            disabled={!!busy || !canRun}
            onClick={runAd}
          >
            {busy === "ad" ? "Generating…" : "Generate ad"}
          </button>

          {ad?._parse_error && (
            <pre className="json-block">{ad.raw}</pre>
          )}
          {ad && !ad._parse_error && (
            <div className="creative-output">
              {ad.mode !== "image" && ad.copy && (
                <>
                  <p className="muted-label">Headline</p>
                  <p className="ad-headline">{ad.copy.headline}</p>
                  <p className="muted-label">Subhead</p>
                  <p className="idea-card-p">{ad.copy.subhead}</p>
                  <p className="muted-label">Body</p>
                  <p className="idea-card-p">{ad.copy.body}</p>
                  <p className="muted-label">CTA</p>
                  <p className="pullquote tight-pull">{ad.copy.cta}</p>
                  {ad.copy.platform_variants && (
                    <>
                      <p className="muted-label">Platform variants</p>
                      <ul className="simple-list tight">
                        {Object.entries(ad.copy.platform_variants).map(
                          ([k, v]) => (
                            <li key={k}>
                              <strong>{k}</strong> — {v}
                            </li>
                          )
                        )}
                      </ul>
                    </>
                  )}
                  {(ad.copy.hashtags || []).length > 0 && (
                    <p className="hashtag-line">
                      {(ad.copy.hashtags || []).join(" ")}
                    </p>
                  )}
                </>
              )}
              {ad.mode === "image" && (
                <>
                  <p className="hint tiny-disclaimer">
                    Image-only mode: ad copy is embedded inside the visual.
                  </p>
                  {ad.copy?.brand_name && (
                    <p className="hint tiny-disclaimer">
                      Brand in ad: <strong>{ad.copy.brand_name}</strong>
                    </p>
                  )}
                </>
              )}
              {ad.copy?.disclaimer && (
                <p className="hint tiny-disclaimer">{ad.copy.disclaimer}</p>
              )}
              {ad.image?.url && (
                <div className="gen-image-wrap">
                  <p className="muted-label">Generated ad visual</p>
                  <img
                    className="gen-image"
                    src={ad.image.url}
                    alt="Generated ad visual"
                  />
                  <button type="button" className="btn" onClick={downloadAdImage}>
                    Download ad image
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="creative-block">
          <h3 className="out-h3">Product → story</h3>
          <div className="mode-row">
            <label className="radio-label">
              <input
                type="radio"
                name="storyMode"
                checked={storyMode === "text"}
                onChange={() => setStoryMode("text")}
              />
              Story as text
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="storyMode"
                checked={storyMode === "images"}
                onChange={() => setStoryMode("images")}
              />
              Story as image panels (comic-style)
            </label>
          </div>
          <button
            type="button"
            className="btn"
            disabled={!!busy || !canRun}
            onClick={runStory}
          >
            {busy === "story" ? "Generating…" : "Generate story"}
          </button>

          {story?._parse_error && (
            <pre className="json-block">{story.raw}</pre>
          )}
          {story &&
            !story._parse_error &&
            (story.story_markdown || (story.panels || []).length > 0) && (
            <div className="creative-output">
              {story.mode !== "images" && (
                <>
                  <h4 className="story-title">{story.title}</h4>
                  <p className="pullquote tight-pull">{story.hook}</p>
                </>
              )}
              {story.mode === "text" && (
                <div className="prose-md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {story.story_markdown}
                  </ReactMarkdown>
                </div>
              )}
              {story.mode === "text" && (story.panels || []).length > 0 && (
                <>
                  <p className="muted-label">Scene outline</p>
                  <ul className="card-list">
                    {(story.panels || []).map((p, i) => (
                      <li key={i} className="idea-card">
                        <strong>{p.title}</strong>
                        <p className="idea-card-p">{p.paragraph}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {story.mode === "images" && (story.panels || []).length > 0 && (
                <>
                  <div className="story-panels-grid">
                    {(story.panels || []).map((p, i) => (
                      <figure key={i} className="story-panel-fig">
                        {p.imageUrl && (
                          <img
                            className="gen-image"
                            src={p.imageUrl}
                            alt={p.title || `Panel ${i + 1}`}
                          />
                        )}
                        <figcaption>
                          <strong>{p.title || `Panel ${i + 1}`}</strong>
                          <p>{p.paragraph}</p>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => downloadStoryPdf(story)}
                  >
                    Download story as PDF
                  </button>
                </>
              )}
              {story.mode !== "images" && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => downloadStoryPdf(story)}
                >
                  Download story as PDF
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
