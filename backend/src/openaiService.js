import OpenAI from "openai";
import { HttpError } from "./httpError.js";

let client;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new HttpError(
      503,
      "OPENAI_API_KEY is not set. Add it to backend/.env and restart the server."
    );
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

async function jsonChat(system, user, schemaHint, options = {}) {
  const c = getClient();
  const content = `${user}\n\nRespond with valid JSON only. ${schemaHint || ""}`;
  const req = {
    model: DEFAULT_MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
  };
  if (options.maxTokens != null) {
    req.max_tokens = options.maxTokens;
  }
  const res = await c.chat.completions.create(req);
  const raw = res.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { _parse_error: true, raw };
  }
}

export async function buildCombinedContext({ startupText, startupScrape }) {
  const system =
    "You merge founder-written copy with scraped website text into one coherent startup brief for downstream AI. Be factual; mark uncertainty if sources conflict.";
  const user = JSON.stringify({
    startupText: startupText || "",
    scrapedSite: startupScrape
      ? {
          url: startupScrape.url,
          title: startupScrape.title,
          excerpt: startupScrape.excerpt,
          bodySample: startupScrape.bodyPreview,
        }
      : null,
  });
  return jsonChat(
    system,
    user,
    `Schema: {"combined_summary": string (markdown), "assumptions": string[], "tags": string[]}`
  );
}

function normalizeDeepDives(raw, competitorSummaries) {
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object") list = [raw];

  const n = competitorSummaries?.length ?? 0;
  if (n === 0) return list;

  const mapped = list.map((d, i) => ({
    ...d,
    competitor_ref:
      d.competitor_ref ||
      competitorSummaries[i]?.label ||
      competitorSummaries[i]?.url ||
      `Competitor ${i + 1}`,
  }));

  const trimmed = mapped.length > n ? mapped.slice(0, n) : [...mapped];
  while (trimmed.length < n) {
    const i = trimmed.length;
    trimmed.push({
      competitor_ref:
        competitorSummaries[i]?.label ||
        competitorSummaries[i]?.url ||
        `Competitor ${i + 1}`,
      their_stage_inferred: "",
      our_stage_inferred: "",
      relative_position: "roughly_even",
      where_they_are_ahead: [],
      where_we_are_ahead: [],
      if_we_are_behind_level_up_moves: [],
      if_we_are_ahead_their_catch_up_moves: [],
      recent_signals_them: [],
      recent_signals_us: [],
      possible_shared_events_or_themes: [],
      their_thesis_inferred:
        "No dedicated analysis returned for this competitor — re-run comparison or shorten the competitor list.",
      their_strengths: [],
      their_weaknesses: [],
      our_edge_vs_them: [],
      their_edge_vs_us: [],
      segment_overlap: "",
      winnable_segments: [],
      kill_zones: "",
      counter_positioning: "",
    });
  }
  return trimmed;
}

export async function comparisonAndBrand({
  combinedSummary,
  competitorSummaries,
}) {
  const n = competitorSummaries?.length ?? 0;
  const competitorRefs = (competitorSummaries || []).map((c, idx) => ({
    index: idx + 1,
    url: c.url,
    label: c.label || null,
    summary_excerpt: (c.summary || "").slice(0, 1200),
  }));

  const system =
    "You are a partner-level strategy + competitive intelligence lead. You MUST compare OUR startup against EVERY competitor supplied — never collapse multiple competitors into one. " +
    "Markdown tables in *_md fields MUST include separate columns (or grouped rows) for Us vs EACH competitor so readers can scan all sides. " +
    "Explicitly call out where THEY are ahead vs where WE are ahead; infer company stage (pre-seed/seed/Series A+/growth/enterprise) from context and compare. " +
    "For each competitor, explain: if we are behind, concrete moves to level up; if we are ahead, what they could plausibly do to catch up (and how we stay ahead). " +
    "Include a 'recent activity & events' angle: infer plausible signals from the supplied scrapes and brief (launches, hiring, conferences, partnerships). " +
    "Suggest industry events or themes where our motion might overlap with theirs; flag that items are model-inferred and must be verified in the news/LinkedIn. " +
    "Be specific; flag uncertainty when the scrape is thin.";

  const rules =
    n === 0
      ? "No competitors in list: invent 2–3 realistic archetypes in tables and 2–3 generic deep_dives."
      : `There are exactly ${n} competitors (indexes 1..${n}). ` +
        "competitor_deep_dives MUST be a JSON array with EXACTLY " +
        n +
        " objects (same length as competitors). Each object covers ONE competitor; set competitor_ref to that competitor's URL or brand name. " +
        "Do not merge competitors into a single deep dive.";

  const user = JSON.stringify({
    instructions: rules,
    ourStartup: combinedSummary,
    competitors_numbered: competitorRefs,
  });

  const raw = await jsonChat(
    system,
    user,
    `Schema (competitor_deep_dives is an ARRAY; repeat the object shape once per competitor):
    {
      "executive_snapshot": string,
      "data_freshness_note": string (short disclaimer: scrapes may be stale; verify recent news/events),
      "stage_comparison_md": string (markdown: us vs each competitor — stage, scale hints, maturity),
      "ahead_behind_landscape_md": string (markdown: where they lead / we lead, by theme),
      "leveling_playbook_md": string (markdown: if behind — our plays; if ahead — their catch-up plays + how we defend),
      "recent_activity_and_events_md": string (markdown: recent signals for us vs them; overlapping conferences/themes to watch; verification note),
      "competitor_scorecard_md": string,
      "head_to_head_matrix_md": string,
      "feature_matrix_md": string,
      "positioning_map_md": string,
      "pricing_packaging_gtm_md": string,
      "icp_and_motion_comparison_md": string,
      "win_loss_scenarios_md": string,
      "strategic_moves_and_mitigations_md": string,
      "competitor_deep_dives": [array of {
        "competitor_ref": string,
        "their_stage_inferred": string,
        "our_stage_inferred": string,
        "relative_position": "we_behind"|"roughly_even"|"we_ahead",
        "where_they_are_ahead": string[],
        "where_we_are_ahead": string[],
        "if_we_are_behind_level_up_moves": string[],
        "if_we_are_ahead_their_catch_up_moves": string[],
        "recent_signals_them": string[],
        "recent_signals_us": string[],
        "possible_shared_events_or_themes": string[],
        "their_thesis_inferred": string,
        "their_strengths": string[],
        "their_weaknesses": string[],
        "our_edge_vs_them": string[],
        "their_edge_vs_us": string[],
        "segment_overlap": string,
        "winnable_segments": string[],
        "kill_zones": string,
        "counter_positioning": string
      }],
      "differentiation_levers": [{"lever": string, "why_us": string, "risk_if_ignored": string}],
      "brand_ideas": [{"name": string, "rationale": string, "voice": string, "visual_direction": string, "sample_taglines": string[]}],
      "messaging_pillars": [{"pillar": string, "proof_points": string[], "objection_handling": string}],
      "gtm_angles": string[],
      "hidden_strengths": string[],
      "blind_spots_vs_competitors": string[]
    }`,
    { maxTokens: 14_000 }
  );

  if (!raw._parse_error && raw.competitor_deep_dives != null) {
    raw.competitor_deep_dives = normalizeDeepDives(
      raw.competitor_deep_dives,
      competitorSummaries
    );
  }
  return raw;
}

export async function roastStartup({ combinedSummary, competitorSummaries }) {
  void competitorSummaries;
  const system =
    "You are a skeptical seed-stage partner. Roast THIS startup only from the brief — do not compare to or mention named competitors unless the founder explicitly named them in the brief. " +
    "Be clear but constructive; no personal attacks. JSON only.";
  const user = JSON.stringify({
    startup: combinedSummary,
  });
  return jsonChat(
    system,
    user,
    `Schema: {
      "overall_verdict": string,
      "hard_pass_reasons": string[],
      "fix_first": [{"issue": string, "severity": "low"|"medium"|"high", "fix": string}],
      "unfair_advantages_to_highlight": string[],
      "one_liner_upgrade": string
    }`
  );
}

export async function jobsFromCompetitors({
  combinedSummary,
  competitorSummaries,
}) {
  const system =
    "You are a fractional CTO/Head of Talent for an early-stage startup. Analyze ONLY this company's story, stage, and roadmap — infer org gaps and hiring priorities from that. " +
    "Do not use or assume any separate competitor scrape; benchmark against generic industry role patterns when helpful, not named rivals. " +
    "Be concrete: urgency, contract vs FTE, where to post, skills, 30-day outcomes.";
  void competitorSummaries;
  const user = JSON.stringify({
    startup: combinedSummary,
  });
  return jsonChat(
    system,
    user,
    `Schema: {
      "hiring_thesis": string,
      "organizational_gaps": [{"area": string, "gap": string, "why_it_matters": string, "severity": "low"|"medium"|"high", "hire_or_contract": string, "close_gap_in_30_days": string}],
      "benchmark_roles_in_market": [{"title": string, "why": string, "signals_to_find_on_linkedin": string[], "seniority": string}],
      "roles_we_need_first": [{"role": string, "rationale": string, "priority": number, "gap_it_fills": string, "must_have_skills": string[], "where_to_post": string[], "urgency_1_to_5": number}],
      "job_opportunities_detail": [{"role": string, "why_now": string, "skills_gap_addressed": string, "full_time_vs_contract": string, "budget_band": string, "sourcing_playbook": string, "peer_benchmark": string}],
      "interview_scorecard_md": string,
      "job_search_queries": string[],
      "career_pages_for_industry_patterns": string[],
      "red_flags_in_candidates": string[]
    }`
  );
}

export async function potentialVCsWithMatch({
  combinedSummary,
  competitorSummaries,
  founderPreferences,
}) {
  void competitorSummaries;
  const system =
    "You are a fundraising strategist. Suggest REALISTIC investor types and example firms/individual archetypes that fit the startup thesis, stage, and geography—include ones founders often overlook " +
    "(sector specialists, operator angels, micro-VCs, international funds, CVCs, rolling funds, scouts). " +
    "Each must have match_score 0-100 with transparent rationale. Do not invent confidential info; phrase as plausible hypotheses. " +
    "If founder_preferences are provided, rank and explain fit vs those constraints (stage, geo, check size, investor type).";
  void competitorSummaries;
  const user = JSON.stringify({
    startup: combinedSummary,
    founder_preferences: founderPreferences || {},
  });
  return jsonChat(
    system,
    user,
    `Schema: {
      "vc_landscape_md": string,
      "missed_bucket_summary": string,
      "vcs_ranked": [{
        "name": string,
        "type": string,
        "match_score": number,
        "stage_and_check": string,
        "geography": string,
        "thesis_overlap": string,
        "portfolio_signals": string,
        "why_often_missed": string,
        "intro_hook": string,
        "likely_pushback": string[],
        "diligence_to_prep": string[]
      }],
      "who_to_avoid": [{"profile": string, "reason": string}]
    }`
  );
}

export async function simulateVcPitch({
  combinedSummary,
  competitorSummaries,
  vcPersona,
  pitchNotes,
}) {
  void competitorSummaries;
  const persona =
    (vcPersona || "").trim() ||
    "Generic seed-stage US generalist partner (software + GTM focus)";
  const system =
    "You role-play as ONE skeptical venture investor with the described persona. The founder just pitched. " +
    "Respond as that VC would in a first meeting: concise, direct, no flattery, no illegal advice. " +
    "Base reactions only on the founder context and notes — do not invent a competitor landscape. " +
    "JSON only.";
  const user = JSON.stringify({
    vc_persona: persona,
    founder_pitch_context: combinedSummary,
    extra_pitch_notes_from_founder: (pitchNotes || "").trim() || null,
  });
  return jsonChat(
    system,
    user,
    `Schema: {
      "vc_persona_used": string,
      "verdict": "strong_interest"|"maybe"|"likely_pass",
      "meeting_likelihood_0_to_100": number,
      "their_response_paragraph": string,
      "questions_they_ask_next": string[],
      "concerns_and_pushback": string[],
      "what_would_change_their_mind": string[],
      "likely_next_step_if_any": string
    }`,
    { maxTokens: 2500 }
  );
}

export async function strategicGapsAnalysis({
  combinedSummary,
  competitorSummaries,
}) {
  void competitorSummaries;
  const system =
    "You are a rigorous operating advisor. Identify product, team, market, distribution, and fundraising narrative gaps for THIS startup only, grounded in the brief. " +
    "Do not reference scraped competitors; use market/category pressure where relevant.";
  const user = JSON.stringify({
    startup: combinedSummary,
  });
  return jsonChat(
    system,
    user,
    `Schema: {
      "executive_gap_summary": string,
      "product_and_ux_gaps": [{"gap": string, "evidence": string, "market_pressure_if_any": string, "fix": string, "severity": "low"|"medium"|"high"}],
      "team_execution_gaps": [{"gap": string, "evidence": string, "fix": string, "severity": "low"|"medium"|"high"}],
      "market_and_distribution_gaps": [{"gap": string, "evidence": string, "fix": string, "severity": "low"|"medium"|"high"}],
      "fundraising_story_gaps": [{"gap": string, "evidence": string, "fix": string, "severity": "low"|"medium"|"high"}],
      "competitive_blind_spots": string[],
      "ninety_day_plan_md": string
    }`
  );
}

export async function startupIdeasTailored({
  combinedSummary,
  competitorSummaries,
}) {
  void competitorSummaries;
  const system =
    "Generate non-generic startup ideas tailored to THIS founder context and market whitespace: adjacent products, monetization wedges, platform plays, community-led SKUs. " +
    "Do not anchor on named competitors. Score idea_fit_score 0-100 for fit to stated strengths. Avoid illegal/unethical suggestions.";
  const user = JSON.stringify({
    startup: combinedSummary,
  });
  return jsonChat(
    system,
    user,
    `Schema: {
      "ideas_intro": string,
      "market_white_space_md": string,
      "startup_ideas": [{
        "name": string,
        "one_liner": string,
        "why_for_you": string,
        "vs_market_alternatives": string,
        "idea_fit_score": number,
        "build_complexity": "low"|"medium"|"high",
        "time_to_mvp": string,
        "revenue_model": string,
        "key_risks": string[],
        "validation_steps": string[]
      }],
      "ideas_to_deprioritize": [{"idea": string, "reason": string}]
    }`
  );
}

export async function collaborationOpportunities({
  combinedSummary,
  competitorSummaries,
}) {
  void competitorSummaries;
  const system =
    "Find ethical B2B collaboration for THIS startup: integrations, co-marketing, data partnerships, channel partners, research labs, nonprofits, adjacent startups. " +
    "Do not tailor suggestions to scraped competitor URLs.";
  const user = JSON.stringify({
    startup: combinedSummary,
  });
  return jsonChat(
    system,
    user,
    `Schema: {
      "partner_archetypes": [{"type": string, "fit": string, "example_pitch": string}],
      "specific_ideas": [{"partner_profile": string, "what_we_offer": string, "what_we_ask": string, "next_step": string}],
      "anti_competitive_boundaries": string[],
      "warm_intro_hooks": string[]
    }`
  );
}

export async function uniqueExtras({ combinedSummary, competitorSummaries }) {
  void competitorSummaries;
  const system =
    "Generate non-obvious strategic extras for THIS startup: pivot seeds, moat experiments, community-led growth, regulatory watchlist, pricing experiments. Product-only; no competitor scrape.";
  const user = JSON.stringify({
    startup: combinedSummary,
  });
  return jsonChat(
    system,
    user,
    `Schema: {
      "moat_experiments": [{"experiment": string, "success_metric": string, "timebox": string}],
      "pivot_seeds": [{"idea": string, "when_to_consider": string}],
      "community_plays": string[],
      "pricing_hypotheses": string[],
      "regulatory_or_policy_watch": string[],
      "metric_dashboard": string[]
    }`
  );
}
