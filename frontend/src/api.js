const base = "";

async function req(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 200) || res.statusText };
    }
  }
  if (!res.ok) {
    throw new Error(
      data.error || data.detail || res.statusText || "Request failed"
    );
  }
  return data;
}

export function saveProfile(body) {
  return req("/api/profile", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function addCompetitors(body) {
  return req("/api/competitors", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getProfile(id) {
  return req(`/api/profile/${id}`);
}

export function runAnalysis(key, profileId, extra = {}) {
  return req(`/api/analyze/${key}`, {
    method: "POST",
    body: JSON.stringify({ profileId, ...extra }),
  });
}

export async function simulateVc(body) {
  return req("/api/simulate/vc", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function creativeAd(body) {
  return req("/api/creative/ad", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function creativeStory(body) {
  return req("/api/creative/story", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function downloadStoryPdf(story) {
  const res = await fetch("/api/creative/story/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ story }),
  });
  if (!res.ok) {
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 300) };
    }
    throw new Error(data.error || res.statusText || "Story PDF export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vibestart-storyboard.pdf";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportReportPdf(payload) {
  const res = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 300) };
    }
    throw new Error(data.error || res.statusText || "PDF export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vibestart-intelligence-report.pdf";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
