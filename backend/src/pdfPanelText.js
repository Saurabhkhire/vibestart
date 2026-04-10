/**
 * Renders intelligence panel payloads as readable PDF text, aligned with
 * frontend/src/components/AnalysisResult.jsx section order and labels.
 */

const W = 500;

function subheading(doc, title) {
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111").text(title, {
    width: W,
  });
  doc.font("Helvetica").fillColor("#000").moveDown(0.15);
}

function paragraph(doc, text, size = 9) {
  const s = text == null ? "" : String(text).trim();
  if (!s) return;
  doc.font("Helvetica").fontSize(size).text(s, { width: W });
  doc.moveDown(0.25);
}

function bullets(doc, items, indent = 12) {
  if (!Array.isArray(items) || items.length === 0) return;
  for (const item of items) {
    if (item == null || item === "") continue;
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(`• ${String(item)}`, { width: W - indent, indent });
  }
  doc.moveDown(0.25);
}

function proseMd(doc, md) {
  paragraph(doc, md, 9);
}

function asDeepDiveList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return [raw];
  return [];
}

function renderParseError(doc, data) {
  const raw =
    data && data.raw != null && String(data.raw).trim()
      ? String(data.raw)
      : "(Could not parse this section.)";
  paragraph(doc, raw, 8);
}

function renderAnalysisError(doc, data) {
  subheading(doc, "Analysis error");
  paragraph(doc, data.message || "Unknown error");
}

export function renderComparison(doc, data) {
  if (data._parse_error) return renderParseError(doc, data);
  if (data._analysis_error) return renderAnalysisError(doc, data);

  subheading(doc, "Executive snapshot");
  proseMd(doc, data.executive_snapshot);

  if (data.data_freshness_note) {
    subheading(doc, "Data & freshness");
    paragraph(doc, data.data_freshness_note);
  }
  if ((data.stage_comparison_md || "").trim()) {
    subheading(doc, "Stage & company maturity");
    proseMd(doc, data.stage_comparison_md);
  }
  if ((data.ahead_behind_landscape_md || "").trim()) {
    subheading(doc, "Where you lead vs where they lead");
    proseMd(doc, data.ahead_behind_landscape_md);
  }
  if ((data.leveling_playbook_md || "").trim()) {
    subheading(doc, "Level up / catch-up playbook");
    proseMd(doc, data.leveling_playbook_md);
  }
  if ((data.recent_activity_and_events_md || "").trim()) {
    subheading(doc, "Recent activity & events (verify externally)");
    proseMd(doc, data.recent_activity_and_events_md);
  }
  if ((data.common_ground_md || "").trim()) {
    subheading(doc, "What is common with competitors");
    proseMd(doc, data.common_ground_md);
  }
  if ((data.branch_comparison_md || "").trim()) {
    subheading(doc, "Strategic branch comparison");
    paragraph(
      doc,
      "GTM / ICP / pricing / deployment branches: us vs each competitor, tradeoffs.",
      8
    );
    proseMd(doc, data.branch_comparison_md);
  }
  const udi = data.unique_differentiation_ideas || [];
  if (udi.length > 0) {
    subheading(doc, "How to be more unique");
    udi.forEach((x) => {
      paragraph(doc, x.idea, 10);
      paragraph(doc, `Why unique: ${x.why_unique || ""}`);
      paragraph(doc, `Next 30 days: ${x.execution_next_30_days || ""}`);
      doc.moveDown(0.15);
    });
  }

  subheading(doc, "Competitor scorecard (quant / qualitative)");
  proseMd(doc, data.competitor_scorecard_md);
  subheading(doc, "Head-to-head matrix");
  proseMd(doc, data.head_to_head_matrix_md);
  subheading(doc, "Feature & capability matrix");
  proseMd(doc, data.feature_matrix_md);
  subheading(doc, "Positioning map");
  proseMd(doc, data.positioning_map_md);
  subheading(doc, "Pricing, packaging & GTM");
  proseMd(doc, data.pricing_packaging_gtm_md);
  subheading(doc, "ICP & go-to-market motion");
  proseMd(doc, data.icp_and_motion_comparison_md);
  subheading(doc, "Win / loss scenarios");
  proseMd(doc, data.win_loss_scenarios_md);
  subheading(doc, "Strategic moves & mitigations");
  proseMd(doc, data.strategic_moves_and_mitigations_md);

  const dives = asDeepDiveList(data.competitor_deep_dives);
  subheading(doc, `Competitor deep dives (${dives.length})`);
  if (dives.length === 0) {
    paragraph(
      doc,
      "No per-competitor cards returned — add competitors and re-run."
    );
  } else {
    dives.forEach((c, idx) => {
      subheading(doc, `${idx + 1}. ${c.competitor_ref || "Competitor"}`);
      if (c.their_stage_inferred || c.our_stage_inferred || c.relative_position) {
        paragraph(
          doc,
          [
            c.their_stage_inferred && `Their stage (inferred): ${c.their_stage_inferred}`,
            c.our_stage_inferred && `Our stage (inferred): ${c.our_stage_inferred}`,
            c.relative_position && `Relative: ${c.relative_position}`,
          ]
            .filter(Boolean)
            .join(" | ")
        );
      }
      if ((c.where_they_are_ahead || []).length) {
        paragraph(doc, "Where they're ahead:");
        bullets(doc, c.where_they_are_ahead, 18);
      }
      if ((c.where_we_are_ahead || []).length) {
        paragraph(doc, "Where we're ahead:");
        bullets(doc, c.where_we_are_ahead, 18);
      }
      if ((c.if_we_are_behind_level_up_moves || []).length) {
        paragraph(doc, "If we're behind — level up:");
        bullets(doc, c.if_we_are_behind_level_up_moves, 18);
      }
      if ((c.if_we_are_ahead_their_catch_up_moves || []).length) {
        paragraph(doc, "If we're ahead — their likely moves:");
        bullets(doc, c.if_we_are_ahead_their_catch_up_moves, 18);
      }
      if ((c.recent_signals_us || []).length || (c.recent_signals_them || []).length) {
        if ((c.recent_signals_us || []).length)
          paragraph(doc, `Recent signals — us: ${(c.recent_signals_us || []).join(" · ")}`);
        if ((c.recent_signals_them || []).length)
          paragraph(doc, `Recent signals — them: ${(c.recent_signals_them || []).join(" · ")}`);
      }
      if ((c.possible_shared_events_or_themes || []).length) {
        paragraph(doc, "Events / themes to watch:");
        bullets(doc, c.possible_shared_events_or_themes, 18);
      }
      if (c.common_with_us)
        paragraph(doc, `Common with us: ${c.common_with_us}`);
      if ((c.strategic_branch_vs_us || "").trim())
        paragraph(
          doc,
          `Strategic branch vs us: ${c.strategic_branch_vs_us}`
        );
      paragraph(doc, `Their thesis (inferred): ${c.their_thesis_inferred || ""}`);
      paragraph(doc, "Their strengths:");
      bullets(doc, c.their_strengths, 18);
      paragraph(doc, "Their weaknesses:");
      bullets(doc, c.their_weaknesses, 18);
      paragraph(doc, "Our edge vs them:");
      bullets(doc, c.our_edge_vs_them, 18);
      paragraph(doc, "Their edge vs us:");
      bullets(doc, c.their_edge_vs_us, 18);
      paragraph(doc, `Segment overlap: ${c.segment_overlap || ""}`);
      paragraph(doc, "Winnable segments:");
      bullets(doc, c.winnable_segments, 18);
      paragraph(doc, `Kill zones: ${c.kill_zones || ""}`);
      paragraph(doc, `Counter-positioning: ${c.counter_positioning || ""}`);
      doc.moveDown(0.2);
    });
  }

  subheading(doc, "Differentiation levers");
  (data.differentiation_levers || []).forEach((x) => {
    paragraph(doc, x.lever, 10);
    paragraph(doc, `Why us: ${x.why_us || ""}`);
    paragraph(doc, `Risk if ignored: ${x.risk_if_ignored || ""}`);
  });

  subheading(doc, "Brand ideas");
  (data.brand_ideas || []).forEach((b) => {
    paragraph(doc, b.name, 10);
    paragraph(doc, b.rationale || "");
    paragraph(doc, `Voice: ${b.voice || ""}`);
    paragraph(doc, `Visual: ${b.visual_direction || ""}`);
    if ((b.sample_taglines || []).length) {
      paragraph(doc, "Taglines:");
      bullets(doc, b.sample_taglines, 18);
    }
  });

  subheading(doc, "Messaging pillars");
  (data.messaging_pillars || []).forEach((m) => {
    paragraph(doc, m.pillar, 10);
    paragraph(doc, `Objections: ${m.objection_handling || ""}`);
    if ((m.proof_points || []).length) {
      bullets(doc, m.proof_points, 18);
    }
  });

  subheading(doc, "GTM angles");
  bullets(doc, data.gtm_angles);

  subheading(doc, "Hidden strengths");
  bullets(doc, data.hidden_strengths);

  subheading(doc, "Blind spots vs competitors");
  bullets(doc, data.blind_spots_vs_competitors);
}

export function renderRoast(doc, data) {
  if (data._parse_error) return renderParseError(doc, data);
  if (data._analysis_error) return renderAnalysisError(doc, data);
  subheading(doc, "Overall verdict");
  proseMd(doc, data.overall_verdict);
  subheading(doc, "Hard pass reasons");
  bullets(doc, data.hard_pass_reasons);
  subheading(doc, "Fix first");
  (data.fix_first || []).forEach((x) => {
    paragraph(doc, `${x.issue || ""} [${x.severity || ""}]`);
    paragraph(doc, x.fix || "");
  });
  subheading(doc, "Unfair advantages to highlight");
  bullets(doc, data.unfair_advantages_to_highlight);
  subheading(doc, "One-liner upgrade");
  paragraph(doc, data.one_liner_upgrade);
}

export function renderJobs(doc, data) {
  if (data._parse_error) return renderParseError(doc, data);
  if (data._analysis_error) return renderAnalysisError(doc, data);
  subheading(doc, "Hiring thesis");
  proseMd(doc, data.hiring_thesis);
  subheading(doc, "Organizational gaps (what's missing)");
  (data.organizational_gaps || []).forEach((g) => {
    paragraph(doc, `${g.area || ""} [${g.severity || ""}]`);
    paragraph(doc, g.gap || "");
    paragraph(doc, `Why it matters: ${g.why_it_matters || ""}`);
    paragraph(doc, `Hire / contract / advisor: ${g.hire_or_contract || ""}`);
    paragraph(doc, `30-day close: ${g.close_gap_in_30_days || ""}`);
  });
  subheading(doc, "Benchmark roles (market patterns)");
  const bench =
    data.benchmark_roles_in_market || data.roles_to_poach_or_mirror || [];
  bench.forEach((r) => {
    paragraph(doc, `${r.title || ""} (${r.seniority || ""})`);
    paragraph(doc, r.why || "");
    if ((r.signals_to_find_on_linkedin || []).length) {
      paragraph(doc, "Signals on LinkedIn:");
      bullets(doc, r.signals_to_find_on_linkedin, 18);
    }
  });
  subheading(doc, "Roles we need first");
  const roles = [...(data.roles_we_need_first || [])].sort(
    (a, b) => (a.priority ?? 99) - (b.priority ?? 99)
  );
  roles.forEach((r) => {
    paragraph(doc, `${r.role || ""} — Priority ${r.priority ?? "—"}`);
    paragraph(doc, r.rationale || "");
    if (r.gap_it_fills) paragraph(doc, `Gap it fills: ${r.gap_it_fills}`);
    if ((r.must_have_skills || []).length) {
      paragraph(doc, "Must-have skills:");
      bullets(doc, r.must_have_skills, 18);
    }
    if ((r.where_to_post || []).length) {
      paragraph(doc, "Where to post / source:");
      bullets(doc, r.where_to_post, 18);
    }
    if (r.urgency_1_to_5 != null)
      paragraph(doc, `Urgency (1–5): ${r.urgency_1_to_5}`);
  });
  subheading(doc, "Job opportunities (detailed plays)");
  (data.job_opportunities_detail || []).forEach((j) => {
    paragraph(doc, j.role, 10);
    paragraph(doc, `Why now: ${j.why_now || ""}`);
    paragraph(doc, `Skills gap addressed: ${j.skills_gap_addressed || ""}`);
    paragraph(
      doc,
      `FTE vs contract: ${j.full_time_vs_contract || ""} | Budget: ${j.budget_band || ""}`
    );
    paragraph(doc, j.sourcing_playbook || "");
    const pb = j.peer_benchmark || j.competitor_team_to_mirror;
    if (pb) paragraph(doc, `Peer / benchmark: ${pb}`);
  });
  subheading(doc, "Interview scorecard");
  proseMd(doc, data.interview_scorecard_md);
  subheading(doc, "Job search queries");
  bullets(doc, data.job_search_queries);
  subheading(doc, "Career pages (industry hiring patterns)");
  bullets(
    doc,
    data.career_pages_for_industry_patterns ||
      data.competitor_career_pages_to_watch
  );
  subheading(doc, "Red flags in candidates");
  bullets(doc, data.red_flags_in_candidates);
}

export function renderCollaborations(doc, data) {
  if (data._parse_error) return renderParseError(doc, data);
  if (data._analysis_error) return renderAnalysisError(doc, data);
  subheading(doc, "Partner archetypes");
  (data.partner_archetypes || []).forEach((p) => {
    paragraph(doc, p.type, 10);
    paragraph(doc, p.fit || "");
    paragraph(doc, `Example pitch: ${p.example_pitch || ""}`);
  });
  subheading(doc, "Specific ideas");
  (data.specific_ideas || []).forEach((x) => {
    paragraph(doc, x.partner_profile, 10);
    paragraph(doc, `We offer: ${x.what_we_offer || ""}`);
    paragraph(doc, `We ask: ${x.what_we_ask || ""}`);
    paragraph(doc, `Next step: ${x.next_step || ""}`);
  });
  subheading(doc, "Anti-competitive boundaries");
  bullets(doc, data.anti_competitive_boundaries);
  subheading(doc, "Warm intro hooks");
  bullets(doc, data.warm_intro_hooks);
}

export function renderVcs(doc, data) {
  if (data._parse_error) return renderParseError(doc, data);
  if (data._analysis_error) return renderAnalysisError(doc, data);
  subheading(doc, "VC & investor landscape");
  proseMd(doc, data.vc_landscape_md);
  subheading(doc, "Buckets you may have skipped");
  proseMd(doc, data.missed_bucket_summary);
  subheading(doc, "Potential investors (ranked by match score)");
  (data.vcs_ranked || []).forEach((v, i) => {
    paragraph(
      doc,
      `${i + 1}. ${v.name || ""} — Match ${v.match_score ?? "—"} — ${v.type || ""}`,
      10
    );
    paragraph(doc, `Stage & check: ${v.stage_and_check || ""}`);
    paragraph(doc, `Geo: ${v.geography || ""}`);
    paragraph(doc, v.thesis_overlap || "");
    paragraph(doc, `Portfolio signals: ${v.portfolio_signals || ""}`);
    paragraph(doc, `Why often missed: ${v.why_often_missed || ""}`);
    paragraph(doc, `Intro hook: ${v.intro_hook || ""}`);
    if ((v.likely_pushback || []).length) {
      paragraph(doc, "Likely pushback:");
      bullets(doc, v.likely_pushback, 18);
    }
    if ((v.diligence_to_prep || []).length) {
      paragraph(doc, "Diligence prep:");
      bullets(doc, v.diligence_to_prep, 18);
    }
  });
  subheading(doc, "Who to avoid (for now)");
  (data.who_to_avoid || []).forEach((x) => {
    paragraph(doc, x.profile, 10);
    paragraph(doc, x.reason || "");
  });
}

export function renderGaps(doc, data) {
  if (data._parse_error) return renderParseError(doc, data);
  if (data._analysis_error) return renderAnalysisError(doc, data);
  subheading(doc, "Executive summary — gaps");
  proseMd(doc, data.executive_gap_summary);

  const gapBlock = (title, items) => {
    if (!items || !items.length) return;
    subheading(doc, title);
    items.forEach((x) => {
      paragraph(doc, `${x.gap || ""} [${x.severity || ""}]`);
      paragraph(doc, `Evidence: ${x.evidence || ""}`);
      const mp = x.market_pressure_if_any || x.competitor_advantage_if_any;
      if (mp) paragraph(doc, `Market / category pressure: ${mp}`);
      paragraph(doc, `Fix: ${x.fix || ""}`);
    });
  };
  gapBlock("Product & UX gaps", data.product_and_ux_gaps);
  gapBlock("Team & execution gaps", data.team_execution_gaps);
  gapBlock("Market & distribution gaps", data.market_and_distribution_gaps);
  gapBlock("Fundraising narrative gaps", data.fundraising_story_gaps);

  subheading(doc, "Category / market blind spots");
  bullets(doc, data.competitive_blind_spots);
  subheading(doc, "90-day closure plan");
  proseMd(doc, data.ninety_day_plan_md);
}

export function renderIdeas(doc, data) {
  if (data._parse_error) return renderParseError(doc, data);
  if (data._analysis_error) return renderAnalysisError(doc, data);
  subheading(doc, "How to read these ideas");
  proseMd(doc, data.ideas_intro);
  subheading(doc, "Market whitespace");
  proseMd(doc, data.market_white_space_md);
  subheading(doc, "Startup ideas tailored to you");
  (data.startup_ideas || []).forEach((idea) => {
    paragraph(
      doc,
      `${idea.name || ""} — Fit ${idea.idea_fit_score ?? "—"} — ${idea.build_complexity || ""}`,
      10
    );
    paragraph(doc, idea.one_liner || "");
    paragraph(doc, idea.why_for_you || "");
    paragraph(
      doc,
      `Vs market alternatives: ${idea.vs_market_alternatives || idea.vs_competitors || ""}`
    );
    paragraph(
      doc,
      `Time to MVP: ${idea.time_to_mvp || ""} | Revenue: ${idea.revenue_model || ""}`
    );
    if ((idea.key_risks || []).length) {
      paragraph(doc, "Key risks:");
      bullets(doc, idea.key_risks, 18);
    }
    if ((idea.validation_steps || []).length) {
      paragraph(doc, "Validation steps:");
      bullets(doc, idea.validation_steps, 18);
    }
  });
  subheading(doc, "Ideas to deprioritize");
  (data.ideas_to_deprioritize || []).forEach((x) => {
    paragraph(doc, x.idea, 10);
    paragraph(doc, x.reason || "");
  });
}

export function renderExtras(doc, data) {
  if (data._parse_error) return renderParseError(doc, data);
  if (data._analysis_error) return renderAnalysisError(doc, data);
  subheading(doc, "Moat experiments");
  (data.moat_experiments || []).forEach((x) => {
    paragraph(doc, x.experiment, 10);
    paragraph(doc, `Success metric: ${x.success_metric || ""}`);
    paragraph(doc, `Timebox: ${x.timebox || ""}`);
  });
  subheading(doc, "Pivot seeds");
  (data.pivot_seeds || []).forEach((x) => {
    paragraph(doc, x.idea, 10);
    paragraph(doc, x.when_to_consider || "");
  });
  subheading(doc, "Community plays");
  bullets(doc, data.community_plays);
  subheading(doc, "Pricing hypotheses");
  bullets(doc, data.pricing_hypotheses);
  subheading(doc, "Regulatory or policy watch");
  bullets(doc, data.regulatory_or_policy_watch);
  subheading(doc, "Metric dashboard");
  bullets(doc, data.metric_dashboard);
}

export function renderUniqueness(doc, data) {
  if (data._parse_error) return renderParseError(doc, data);
  if (data._analysis_error) return renderAnalysisError(doc, data);
  subheading(doc, "Uniqueness diagnosis");
  proseMd(doc, data.uniqueness_diagnosis);
  subheading(doc, "Where we risk looking generic");
  bullets(doc, data.where_we_risk_looking_generic);
  subheading(doc, "Unique angle candidates");
  (data.unique_angle_candidates || []).forEach((x) => {
    paragraph(doc, x.angle, 10);
    paragraph(doc, `Hard to copy: ${x.why_it_is_hard_to_copy || ""}`);
    paragraph(doc, `Proof needed: ${x.proof_we_need || ""}`);
  });
  subheading(doc, "Signature experiences to build");
  (data.signature_experiences_to_build || []).forEach((x) => {
    paragraph(doc, x.experience, 10);
    paragraph(doc, `Who for: ${x.who_it_is_for || ""}`);
    paragraph(doc, x.what_makes_it_memorable || "");
  });
  subheading(doc, "Moat blueprints");
  (data.moat_blueprints || []).forEach((x) => {
    paragraph(doc, x.moat, 10);
    paragraph(doc, `Mechanism: ${x.mechanism || ""}`);
    paragraph(doc, `Early signal: ${x.early_signal || ""}`);
    paragraph(doc, `Time horizon: ${x.time_horizon || ""}`);
  });
  subheading(doc, "Distinct messaging");
  (data.messaging_that_sounds_distinct || []).forEach((x) => {
    paragraph(doc, x.message, 10);
    paragraph(doc, `Avoid sounding like: ${x.avoid_sounding_like || ""}`);
  });
  subheading(doc, "30-day uniqueness plan");
  proseMd(doc, data.next_30_day_uniqueness_plan_md);
}

/**
 * @param {import("pdfkit")} doc
 * @param {unknown} data
 * @param {{ vcPersona?: string, pitchNotes?: string } | undefined} meta
 */
export function renderVcSimulator(doc, data, meta) {
  if (meta?.vcPersona || meta?.pitchNotes) {
    subheading(doc, "Inputs (as in the app)");
    if (meta.vcPersona) paragraph(doc, `VC persona: ${meta.vcPersona}`);
    if (meta.pitchNotes) paragraph(doc, `Extra pitch notes: ${meta.pitchNotes}`);
    doc.moveDown(0.15);
  }
  if (data == null) {
    subheading(doc, "Result");
    paragraph(
      doc,
      'No simulator output yet. Use Run VC simulator in the app (section 6); results are saved on your profile and included on the next export.'
    );
    return;
  }
  if (data._parse_error) return renderParseError(doc, data);
  if (data._analysis_error) return renderAnalysisError(doc, data);
  subheading(doc, "Simulated persona");
  paragraph(doc, data.vc_persona_used || "");
  paragraph(
    doc,
    `Verdict: ${String(data.verdict || "").replace(/_/g, " ")} | Meeting odds: ${data.meeting_likelihood_0_to_100 ?? "—"}`
  );
  subheading(doc, "What they might say");
  proseMd(doc, data.their_response_paragraph);
  subheading(doc, "Questions they'd ask next");
  bullets(doc, data.questions_they_ask_next);
  subheading(doc, "Concerns & pushback");
  bullets(doc, data.concerns_and_pushback);
  subheading(doc, "What would change their mind");
  bullets(doc, data.what_would_change_their_mind);
  if (data.likely_next_step_if_any) {
    subheading(doc, "Likely next step");
    paragraph(doc, data.likely_next_step_if_any);
  }
}

/**
 * @param {import("pdfkit")} doc
 * @param {string} key
 * @param {unknown} data
 */
export function renderIntelligencePanelText(doc, key, data) {
  if (data == null) {
    paragraph(
      doc,
      "No result for this run in the export bundle. Run this button in section 4 (Intelligence runs) and export again, or use “Download PDF report” so every analysis is executed and saved first."
    );
    return;
  }
  switch (key) {
    case "comparison":
      return renderComparison(doc, data);
    case "roast":
      return renderRoast(doc, data);
    case "jobs":
      return renderJobs(doc, data);
    case "collaborations":
      return renderCollaborations(doc, data);
    case "vcs":
      return renderVcs(doc, data);
    case "gaps":
      return renderGaps(doc, data);
    case "ideas":
      return renderIdeas(doc, data);
    case "extras":
      return renderExtras(doc, data);
    case "uniqueness":
      return renderUniqueness(doc, data);
    default:
      subheading(doc, "Content");
      paragraph(doc, JSON.stringify(data, null, 2), 7);
  }
}
