import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { creativeAd, creativeStory } from "../api.js";

export function CreativeStudio({ profileId }) {
  const [adMode, setAdMode] = useState("text");
  const [storyMode, setStoryMode] = useState("text");
  const [adResult, setAdResult] = useState(null);
  const [storyResult, setStoryResult] = useState(null);
  const [localErr, setLocalErr] = useState("");
  const [busy, setBusy] = useState("");

  const runAd = async () => {
    if (!profileId) {
      setLocalErr("Save your startup profile in section 1 first.");
      return;
    }
    setLocalErr("");
    setBusy("ad");
    setAdResult(null);
    try {
      const data = await creativeAd({
        profileId,
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
    if (!profileId) {
      setLocalErr("Save your startup profile in section 1 first.");
      return;
    }
    setLocalErr("");
    setBusy("story");
    setStoryResult(null);
    try {
      const data = await creativeStory({
        profileId,
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

  return (
    <div className="creative-studio">
      <p className="hint">
        Uses your <strong>saved profile</strong> only: the startup URL and/or
        pitch from section 1, plus a fresh scrape of that URL when it&apos;s
        available. You don&apos;t enter a separate link here.
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
              Text + image (DALL·E)
            </label>
          </div>
          <button
            type="button"
            className="btn accent"
            disabled={!!busy || !profileId}
            onClick={runAd}
          >
            {busy === "ad" ? "Generating…" : "Generate ad"}
          </button>

          {ad?._parse_error && (
            <pre className="json-block">{ad.raw}</pre>
          )}
          {ad && !ad._parse_error && ad.copy && (
            <div className="creative-output">
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
              {ad.copy.disclaimer && (
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
              Story as images (panels)
            </label>
          </div>
          <button
            type="button"
            className="btn"
            disabled={!!busy || !profileId}
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
              <h4 className="story-title">{story.title}</h4>
              <p className="pullquote tight-pull">{story.hook}</p>
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
                        <strong>{p.title}</strong>
                        <p>{p.paragraph}</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
