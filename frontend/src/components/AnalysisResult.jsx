import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function titleCaseKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ProseMarkdown({ children, className = "" }) {
  if (!children || !String(children).trim()) return null;
  return (
    <div className={`prose-md ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{String(children)}</ReactMarkdown>
    </div>
  );
}

function ChipList({ items, variant = "accent" }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <ul className={`chips chips--${variant}`}>
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function SeverityBadge({ level }) {
  const s = (level || "").toLowerCase();
  const cls =
    s === "high" ? "sev sev-high" : s === "medium" ? "sev sev-med" : "sev sev-low";
  return <span className={cls}>{level || "—"}</span>;
}

/** 0–100 model fit score (VC match, idea fit, etc.) */
function MatchScoreBadge({ score, label = "Match" }) {
  const n = Number(score);
  if (Number.isNaN(n)) return null;
  const r = Math.max(0, Math.min(100, Math.round(n)));
  let cls = "match-score match-score--mid";
  if (r >= 78) cls = "match-score match-score--high";
  else if (r < 55) cls = "match-score match-score--low";
  return (
    <span className={cls} title={`${label} score (model estimate)`}>
      {label} {r}
    </span>
  );
}

/** Generic pretty renderer for unknown / mixed JSON-shaped trees */
function FallbackTree({ data, depth = 0 }) {
  if (data == null) return null;
  if (typeof data === "string")
    return <ProseMarkdown>{data}</ProseMarkdown>;
  if (typeof data === "number" || typeof data === "boolean") {
    return <span className="scalar">{String(data)}</span>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    if (data.every((x) => typeof x === "string")) {
      return (
        <ul className="simple-list">
          {data.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="fallback-array">
        {data.map((item, i) => (
          <div key={i} className="mini-card">
            <FallbackTree data={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof data === "object") {
    const entries = Object.entries(data).filter(([, v]) => v != null && v !== "");
    if (entries.length === 0) return null;
    return (
      <dl className="kv-list">
        {entries.map(([k, v]) => (
          <div key={k} className="kv-row">
            <dt>{titleCaseKey(k)}</dt>
            <dd>
              <FallbackTree data={v} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}

function Section({ title, children }) {
  if (!children) return null;
  return (
    <section className="out-section">
      <h3 className="out-h3">{title}</h3>
      {children}
    </section>
  );
}

function asDeepDiveList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return [raw];
  return [];
}

function ComparisonView({ data }) {
  if (data._parse_error) {
    return <pre className="json-block">{data.raw}</pre>;
  }
  const competitorDeepDives = asDeepDiveList(data.competitor_deep_dives);
  return (
    <>
      <Section title="Executive snapshot">
        <ProseMarkdown>{data.executive_snapshot}</ProseMarkdown>
      </Section>
      {data.data_freshness_note && (
        <Section title="Data & freshness">
          <p className="hint tight-hint">{data.data_freshness_note}</p>
        </Section>
      )}
      <Section title="Stage & company maturity">
        <ProseMarkdown>{data.stage_comparison_md}</ProseMarkdown>
      </Section>
      <Section title="Where you lead vs where they lead">
        <ProseMarkdown>{data.ahead_behind_landscape_md}</ProseMarkdown>
      </Section>
      <Section title="Level up / catch-up playbook">
        <ProseMarkdown>{data.leveling_playbook_md}</ProseMarkdown>
      </Section>
      <Section title="Recent activity & events (verify externally)">
        <ProseMarkdown>{data.recent_activity_and_events_md}</ProseMarkdown>
      </Section>
      <Section title="Competitor scorecard (quant / qualitative)">
        <ProseMarkdown>{data.competitor_scorecard_md}</ProseMarkdown>
      </Section>
      <Section title="Head-to-head matrix">
        <ProseMarkdown>{data.head_to_head_matrix_md}</ProseMarkdown>
      </Section>
      <Section title="Feature & capability matrix">
        <ProseMarkdown>{data.feature_matrix_md}</ProseMarkdown>
      </Section>
      <Section title="Positioning map">
        <ProseMarkdown>{data.positioning_map_md}</ProseMarkdown>
      </Section>
      <Section title="Pricing, packaging & GTM">
        <ProseMarkdown>{data.pricing_packaging_gtm_md}</ProseMarkdown>
      </Section>
      <Section title="ICP & go-to-market motion">
        <ProseMarkdown>{data.icp_and_motion_comparison_md}</ProseMarkdown>
      </Section>
      <Section title="Win / loss scenarios">
        <ProseMarkdown>{data.win_loss_scenarios_md}</ProseMarkdown>
      </Section>
      <Section title="Strategic moves & mitigations">
        <ProseMarkdown>{data.strategic_moves_and_mitigations_md}</ProseMarkdown>
      </Section>
      <Section
        title={`Competitor deep dives (${competitorDeepDives.length})`}
      >
        {competitorDeepDives.length === 0 ? (
          <p className="hint">
            No per-competitor cards returned — add competitors and re-run.
          </p>
        ) : (
        <ul className="card-list">
          {competitorDeepDives.map((c, i) => (
            <li key={`${c.competitor_ref || "c"}-${i}`} className="idea-card competitor-dive">
              <strong className="idea-card-title">{c.competitor_ref}</strong>
              {(c.relative_position || c.their_stage_inferred || c.our_stage_inferred) && (
                <p className="idea-card-p">
                  {c.their_stage_inferred && (
                    <>
                      <span className="muted-label">Their stage (inferred)</span>{" "}
                      {c.their_stage_inferred}{" "}
                    </>
                  )}
                  {c.our_stage_inferred && (
                    <>
                      <span className="muted-label">Our stage (inferred)</span>{" "}
                      {c.our_stage_inferred}{" "}
                    </>
                  )}
                  {c.relative_position && (
                    <span className="badge-soft">{c.relative_position}</span>
                  )}
                </p>
              )}
              {(c.where_they_are_ahead || []).length > 0 && (
                <>
                  <p className="muted-label">Where they’re ahead</p>
                  <ul className="simple-list tight">
                    {(c.where_they_are_ahead || []).map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
              {(c.where_we_are_ahead || []).length > 0 && (
                <>
                  <p className="muted-label">Where we’re ahead</p>
                  <ul className="simple-list tight">
                    {(c.where_we_are_ahead || []).map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
              {(c.if_we_are_behind_level_up_moves || []).length > 0 && (
                <>
                  <p className="muted-label">If we’re behind — level up</p>
                  <ul className="simple-list tight">
                    {(c.if_we_are_behind_level_up_moves || []).map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
              {(c.if_we_are_ahead_their_catch_up_moves || []).length > 0 && (
                <>
                  <p className="muted-label">If we’re ahead — their likely moves</p>
                  <ul className="simple-list tight">
                    {(c.if_we_are_ahead_their_catch_up_moves || []).map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
              {((c.recent_signals_us || []).length > 0 ||
                (c.recent_signals_them || []).length > 0) && (
                <div className="mini-compare">
                  {(c.recent_signals_us || []).length > 0 && (
                    <p className="idea-card-p">
                      <span className="muted-label">Recent signals — us</span>{" "}
                      {(c.recent_signals_us || []).join(" · ")}
                    </p>
                  )}
                  {(c.recent_signals_them || []).length > 0 && (
                    <p className="idea-card-p">
                      <span className="muted-label">Recent signals — them</span>{" "}
                      {(c.recent_signals_them || []).join(" · ")}
                    </p>
                  )}
                </div>
              )}
              {(c.possible_shared_events_or_themes || []).length > 0 && (
                <>
                  <p className="muted-label">Events / themes to watch</p>
                  <ul className="simple-list tight">
                    {(c.possible_shared_events_or_themes || []).map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="idea-card-p">
                <span className="muted-label">Their thesis (inferred)</span>{" "}
                {c.their_thesis_inferred}
              </p>
              <p className="muted-label">Their strengths</p>
              <ul className="simple-list tight">
                {(c.their_strengths || []).map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
              <p className="muted-label">Their weaknesses</p>
              <ul className="simple-list tight">
                {(c.their_weaknesses || []).map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
              <p className="muted-label">Our edge vs them</p>
              <ul className="simple-list tight">
                {(c.our_edge_vs_them || []).map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
              <p className="muted-label">Their edge vs us</p>
              <ul className="simple-list tight">
                {(c.their_edge_vs_us || []).map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
              <p className="idea-card-p">
                <span className="muted-label">Segment overlap</span>{" "}
                {c.segment_overlap}
              </p>
              <p className="muted-label">Winnable segments</p>
              <ul className="simple-list tight">
                {(c.winnable_segments || []).map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
              <p className="idea-card-p warn-text">
                <span className="muted-label">Kill zones</span> {c.kill_zones}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">Counter-positioning</span>{" "}
                {c.counter_positioning}
              </p>
            </li>
          ))}
        </ul>
        )}
      </Section>
      <Section title="Differentiation levers">
        <ul className="card-list">
          {(data.differentiation_levers || []).map((x, i) => (
            <li key={i} className="idea-card">
              <strong className="idea-card-title">{x.lever}</strong>
              <p className="idea-card-p">
                <span className="muted-label">Why us</span> {x.why_us}
              </p>
              <p className="idea-card-p warn-text">
                <span className="muted-label">Risk if ignored</span>{" "}
                {x.risk_if_ignored}
              </p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Brand ideas">
        <ul className="card-list">
          {(data.brand_ideas || []).map((b, i) => (
            <li key={i} className="idea-card brand-card">
              <strong className="idea-card-title">{b.name}</strong>
              <p className="idea-card-p">{b.rationale}</p>
              <p className="idea-card-p">
                <span className="muted-label">Voice</span> {b.voice}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">Visual</span> {b.visual_direction}
              </p>
              <ChipList items={b.sample_taglines} variant="teal" />
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Messaging pillars">
        <ul className="card-list">
          {(data.messaging_pillars || []).map((m, i) => (
            <li key={i} className="idea-card">
              <strong className="idea-card-title">{m.pillar}</strong>
              <p className="idea-card-p">
                <span className="muted-label">Objections</span>{" "}
                {m.objection_handling}
              </p>
              <ul className="simple-list tight">
                {(m.proof_points || []).map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="GTM angles">
        <ChipList items={data.gtm_angles} />
      </Section>
      <Section title="Hidden strengths">
        <ul className="simple-list">
          {(data.hidden_strengths || []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
      <Section title="Blind spots vs competitors">
        <ul className="simple-list">
          {(data.blind_spots_vs_competitors || []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function RoastView({ data }) {
  if (data._parse_error) return <pre className="json-block">{data.raw}</pre>;
  return (
    <>
      <Section title="Overall verdict">
        <ProseMarkdown>{data.overall_verdict}</ProseMarkdown>
      </Section>
      <Section title="Hard pass reasons">
        <ul className="simple-list roast-list">
          {(data.hard_pass_reasons || []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
      <Section title="Fix first">
        <ul className="card-list">
          {(data.fix_first || []).map((x, i) => (
            <li key={i} className="idea-card">
              <div className="row-title">
                <strong>{x.issue}</strong>
                <SeverityBadge level={x.severity} />
              </div>
              <p className="idea-card-p">{x.fix}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Unfair advantages to highlight">
        <ul className="simple-list">
          {(data.unfair_advantages_to_highlight || []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
      <Section title="One-liner upgrade">
        <p className="pullquote">{data.one_liner_upgrade}</p>
      </Section>
    </>
  );
}

function JobsView({ data }) {
  if (data._parse_error) return <pre className="json-block">{data.raw}</pre>;
  return (
    <>
      <Section title="Hiring thesis">
        <ProseMarkdown>{data.hiring_thesis}</ProseMarkdown>
      </Section>
      <Section title="Organizational gaps (what’s missing)">
        <ul className="card-list">
          {(data.organizational_gaps || []).map((g, i) => (
            <li key={i} className="idea-card">
              <div className="row-title">
                <strong>{g.area}</strong>
                <SeverityBadge level={g.severity} />
              </div>
              <p className="idea-card-p">{g.gap}</p>
              <p className="idea-card-p">
                <span className="muted-label">Why it matters</span>{" "}
                {g.why_it_matters}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">Hire / contract / advisor</span>{" "}
                {g.hire_or_contract}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">30-day close</span>{" "}
                {g.close_gap_in_30_days}
              </p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Roles to poach or mirror">
        <ul className="card-list">
          {(data.roles_to_poach_or_mirror || []).map((r, i) => (
            <li key={i} className="idea-card">
              <strong className="idea-card-title">
                {r.title}{" "}
                <span className="badge-soft">{r.seniority}</span>
              </strong>
              <p className="idea-card-p">{r.why}</p>
              <p className="muted-label">Signals on LinkedIn</p>
              <ul className="simple-list tight">
                {(r.signals_to_find_on_linkedin || []).map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Roles we need first">
        <ul className="card-list">
          {(data.roles_we_need_first || [])
            .slice()
            .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
            .map((r, i) => (
              <li key={i} className="idea-card">
                <div className="row-title">
                  <strong>{r.role}</strong>
                  {r.priority != null && (
                    <span className="badge-soft">Priority {r.priority}</span>
                  )}
                </div>
                <p className="idea-card-p">{r.rationale}</p>
                {r.gap_it_fills && (
                  <p className="idea-card-p">
                    <span className="muted-label">Gap it fills</span>{" "}
                    {r.gap_it_fills}
                  </p>
                )}
                {(r.must_have_skills || []).length > 0 && (
                  <>
                    <p className="muted-label">Must-have skills</p>
                    <ChipList items={r.must_have_skills} variant="teal" />
                  </>
                )}
                {(r.where_to_post || []).length > 0 && (
                  <>
                    <p className="muted-label">Where to post / source</p>
                    <ul className="simple-list tight mono-list">
                      {(r.where_to_post || []).map((w, j) => (
                        <li key={j}>{w}</li>
                      ))}
                    </ul>
                  </>
                )}
                {r.urgency_1_to_5 != null && (
                  <p className="idea-card-p">
                    <span className="muted-label">Urgency (1–5)</span>{" "}
                    {r.urgency_1_to_5}
                  </p>
                )}
              </li>
            ))}
        </ul>
      </Section>
      <Section title="Job opportunities (detailed plays)">
        <ul className="card-list">
          {(data.job_opportunities_detail || []).map((j, i) => (
            <li key={i} className="idea-card">
              <strong className="idea-card-title">{j.role}</strong>
              <p className="idea-card-p">
                <span className="muted-label">Why now</span> {j.why_now}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">Skills gap addressed</span>{" "}
                {j.skills_gap_addressed}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">FTE vs contract</span>{" "}
                {j.full_time_vs_contract}{" "}
                <span className="muted-label">Budget band</span>{" "}
                {j.budget_band}
              </p>
              <p className="idea-card-p">{j.sourcing_playbook}</p>
              {j.competitor_team_to_mirror && (
                <p className="idea-card-p">
                  <span className="muted-label">Mirror / learn from</span>{" "}
                  {j.competitor_team_to_mirror}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Interview scorecard">
        <ProseMarkdown>{data.interview_scorecard_md}</ProseMarkdown>
      </Section>
      <Section title="Job search queries">
        <ChipList items={data.job_search_queries} variant="teal" />
      </Section>
      <Section title="Competitor career pages to watch">
        <ul className="simple-list mono-list">
          {(data.competitor_career_pages_to_watch || []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
      <Section title="Red flags in candidates">
        <ul className="simple-list roast-list">
          {(data.red_flags_in_candidates || []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function CollabView({ data }) {
  if (data._parse_error) return <pre className="json-block">{data.raw}</pre>;
  return (
    <>
      <Section title="Partner archetypes">
        <ul className="card-list">
          {(data.partner_archetypes || []).map((p, i) => (
            <li key={i} className="idea-card">
              <strong className="idea-card-title">{p.type}</strong>
              <p className="idea-card-p">{p.fit}</p>
              <p className="idea-card-p pitch">
                <span className="muted-label">Example pitch</span>{" "}
                {p.example_pitch}
              </p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Specific ideas">
        <ul className="card-list">
          {(data.specific_ideas || []).map((x, i) => (
            <li key={i} className="idea-card">
              <strong className="idea-card-title">{x.partner_profile}</strong>
              <p className="idea-card-p">
                <span className="muted-label">We offer</span> {x.what_we_offer}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">We ask</span> {x.what_we_ask}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">Next step</span> {x.next_step}
              </p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Anti-competitive boundaries">
        <ul className="simple-list">
          {(data.anti_competitive_boundaries || []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
      <Section title="Warm intro hooks">
        <ul className="simple-list">
          {(data.warm_intro_hooks || []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function VcView({ data }) {
  if (data._parse_error) return <pre className="json-block">{data.raw}</pre>;
  return (
    <>
      <Section title="VC & investor landscape">
        <ProseMarkdown>{data.vc_landscape_md}</ProseMarkdown>
      </Section>
      <Section title="Buckets you may have skipped">
        <ProseMarkdown>{data.missed_bucket_summary}</ProseMarkdown>
      </Section>
      <Section title="Potential investors (ranked by match score)">
        <ul className="card-list">
          {(data.vcs_ranked || []).map((v, i) => (
            <li key={i} className="idea-card vc-card">
              <div className="row-title">
                <strong className="idea-card-title">{v.name}</strong>
                <MatchScoreBadge score={v.match_score} label="Match" />
                <span className="badge-soft">{v.type}</span>
              </div>
              <p className="idea-card-p">
                <span className="muted-label">Stage & check</span>{" "}
                {v.stage_and_check}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">Geo</span> {v.geography}
              </p>
              <p className="idea-card-p">{v.thesis_overlap}</p>
              <p className="idea-card-p">
                <span className="muted-label">Portfolio signals</span>{" "}
                {v.portfolio_signals}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">Why often missed</span>{" "}
                {v.why_often_missed}
              </p>
              <p className="idea-card-p pitch">
                <span className="muted-label">Intro hook</span> {v.intro_hook}
              </p>
              <p className="muted-label">Likely pushback</p>
              <ul className="simple-list tight roast-list">
                {(v.likely_pushback || []).map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
              <p className="muted-label">Diligence prep</p>
              <ul className="simple-list tight">
                {(v.diligence_to_prep || []).map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Who to avoid (for now)">
        <ul className="card-list">
          {(data.who_to_avoid || []).map((x, i) => (
            <li key={i} className="idea-card">
              <strong>{x.profile}</strong>
              <p className="idea-card-p warn-text">{x.reason}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function GapsView({ data }) {
  if (data._parse_error) return <pre className="json-block">{data.raw}</pre>;
  const gapBlock = (title, items) =>
    (items || []).length > 0 ? (
      <Section title={title}>
        <ul className="card-list">
          {items.map((x, i) => (
            <li key={i} className="idea-card">
              <div className="row-title">
                <strong>{x.gap}</strong>
                <SeverityBadge level={x.severity} />
              </div>
              <p className="idea-card-p">
                <span className="muted-label">Evidence</span> {x.evidence}
              </p>
              {x.competitor_advantage_if_any && (
                <p className="idea-card-p">
                  <span className="muted-label">Competitor angle</span>{" "}
                  {x.competitor_advantage_if_any}
                </p>
              )}
              <p className="idea-card-p">
                <span className="muted-label">Fix</span> {x.fix}
              </p>
            </li>
          ))}
        </ul>
      </Section>
    ) : null;

  return (
    <>
      <Section title="Executive summary — gaps">
        <ProseMarkdown>{data.executive_gap_summary}</ProseMarkdown>
      </Section>
      {gapBlock("Product & UX gaps", data.product_and_ux_gaps)}
      {gapBlock("Team & execution gaps", data.team_execution_gaps)}
      {gapBlock("Market & distribution gaps", data.market_and_distribution_gaps)}
      {gapBlock("Fundraising narrative gaps", data.fundraising_story_gaps)}
      <Section title="Competitive blind spots">
        <ul className="simple-list">
          {(data.competitive_blind_spots || []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
      <Section title="90-day closure plan">
        <ProseMarkdown>{data.ninety_day_plan_md}</ProseMarkdown>
      </Section>
    </>
  );
}

function IdeasView({ data }) {
  if (data._parse_error) return <pre className="json-block">{data.raw}</pre>;
  return (
    <>
      <Section title="How to read these ideas">
        <ProseMarkdown>{data.ideas_intro}</ProseMarkdown>
      </Section>
      <Section title="Market whitespace">
        <ProseMarkdown>{data.market_white_space_md}</ProseMarkdown>
      </Section>
      <Section title="Startup ideas tailored to you">
        <ul className="card-list">
          {(data.startup_ideas || []).map((idea, i) => (
            <li key={i} className="idea-card brand-card">
              <div className="row-title">
                <strong className="idea-card-title">{idea.name}</strong>
                <MatchScoreBadge score={idea.idea_fit_score} label="Fit" />
                <span className="badge-soft">{idea.build_complexity}</span>
              </div>
              <p className="pullquote tight-pull">{idea.one_liner}</p>
              <p className="idea-card-p">{idea.why_for_you}</p>
              <p className="idea-card-p">
                <span className="muted-label">Vs competitors</span>{" "}
                {idea.vs_competitors}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">Time to MVP</span> {idea.time_to_mvp}{" "}
                <span className="muted-label">Revenue</span> {idea.revenue_model}
              </p>
              <p className="muted-label">Key risks</p>
              <ul className="simple-list tight roast-list">
                {(idea.key_risks || []).map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
              <p className="muted-label">Validation steps</p>
              <ul className="simple-list tight">
                {(idea.validation_steps || []).map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Ideas to deprioritize">
        <ul className="card-list">
          {(data.ideas_to_deprioritize || []).map((x, i) => (
            <li key={i} className="idea-card">
              <strong>{x.idea}</strong>
              <p className="idea-card-p">{x.reason}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function ExtrasView({ data }) {
  if (data._parse_error) return <pre className="json-block">{data.raw}</pre>;
  return (
    <>
      <Section title="Moat experiments">
        <ul className="card-list">
          {(data.moat_experiments || []).map((x, i) => (
            <li key={i} className="idea-card">
              <strong className="idea-card-title">{x.experiment}</strong>
              <p className="idea-card-p">
                <span className="muted-label">Success metric</span>{" "}
                {x.success_metric}
              </p>
              <p className="idea-card-p">
                <span className="muted-label">Timebox</span> {x.timebox}
              </p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Pivot seeds">
        <ul className="card-list">
          {(data.pivot_seeds || []).map((x, i) => (
            <li key={i} className="idea-card">
              <strong className="idea-card-title">{x.idea}</strong>
              <p className="idea-card-p">{x.when_to_consider}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Community plays">
        <ChipList items={data.community_plays} />
      </Section>
      <Section title="Pricing hypotheses">
        <ul className="simple-list">
          {(data.pricing_hypotheses || []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
      <Section title="Regulatory or policy watch">
        <ul className="simple-list">
          {(data.regulatory_or_policy_watch || []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>
      <Section title="Metric dashboard">
        <ChipList items={data.metric_dashboard} variant="teal" />
      </Section>
    </>
  );
}

const views = {
  comparison: ComparisonView,
  roast: RoastView,
  jobs: JobsView,
  collaborations: CollabView,
  extras: ExtrasView,
  vcs: VcView,
  gaps: GapsView,
  ideas: IdeasView,
};

export function VcSimulatorView({ data }) {
  if (!data) return null;
  if (data._parse_error) {
    return <pre className="json-block">{data.raw}</pre>;
  }
  return (
    <div className="analysis-output vc-sim-output">
      <p className="muted-label">Simulated persona</p>
      <p className="idea-card-p">{data.vc_persona_used}</p>
      <div className="row-title sim-verdict-row">
        <span className="badge-soft verdict-pill">
          {(data.verdict || "").replace(/_/g, " ")}
        </span>
        {data.meeting_likelihood_0_to_100 != null && (
          <MatchScoreBadge
            score={data.meeting_likelihood_0_to_100}
            label="Meeting odds"
          />
        )}
      </div>
      <Section title="What they might say">
        <ProseMarkdown>{data.their_response_paragraph}</ProseMarkdown>
      </Section>
      <Section title="Questions they’d ask next">
        <ul className="simple-list">
          {(data.questions_they_ask_next || []).map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </Section>
      <Section title="Concerns & pushback">
        <ul className="simple-list roast-list">
          {(data.concerns_and_pushback || []).map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </Section>
      <Section title="What would change their mind">
        <ul className="simple-list">
          {(data.what_would_change_their_mind || []).map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </Section>
      {data.likely_next_step_if_any && (
        <Section title="Likely next step">
          <p className="idea-card-p">{data.likely_next_step_if_any}</p>
        </Section>
      )}
      <details className="raw-json-details">
        <summary>Raw JSON</summary>
        <pre className="json-block json-block--tight">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function AnalysisResult({ panelKey, data }) {
  if (!data) return null;
  const V = views[panelKey];
  if (V) {
    return (
      <div className="analysis-output">
        <V data={data} />
        <details className="raw-json-details">
          <summary>Raw JSON</summary>
          <pre className="json-block json-block--tight">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    );
  }
  return (
    <div className="analysis-output">
      <FallbackTree data={data} />
    </div>
  );
}
