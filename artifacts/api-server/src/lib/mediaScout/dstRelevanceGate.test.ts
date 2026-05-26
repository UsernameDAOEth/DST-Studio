import assert from "node:assert/strict";
import test from "node:test";
import { scoreDSTMediaCandidate } from "./dstRelevanceGate";
import type { DSTMediaCandidate } from "./types";

function candidate(overrides: Partial<DSTMediaCandidate>): DSTMediaCandidate {
  return {
    videoId: "test-video",
    url: "https://www.youtube.com/watch?v=test-video",
    title: "Untitled",
    description: "",
    channelTitle: "Test Channel",
    publishedAt: "2026-05-01T00:00:00Z",
    duration: "PT1H12M",
    thumbnailUrl: "https://i.ytimg.com/vi/test-video/hqdefault.jpg",
    tags: [],
    viewCount: 100_000,
    likeCount: 2_000,
    ...overrides,
  };
}

test("strong simulation and information-theory candidate returns PASS", () => {
  const score = scoreDSTMediaCandidate(candidate({
    title: "Simulation Theory, Determinism, and Information Theory - full lecture",
    description:
      "A university physicist explains deterministic physics, causality, constraint, invariants, digital physics, computational universe, Shannon entropy, information persists across transformation, observer problem, measurement problem, uncertainty, frame of reference, and cross-framework theory.",
    channelTitle: "Institute for Physics Podcast",
    tags: ["simulation theory", "determinism", "information theory", "observer problem"],
  }));

  assert.equal(score.verdict, "PASS");
  assert.equal(score.failureCodes.length, 0);
  assert.ok(score.total >= 75);
});

test("vague Matrix clickbait candidate does not pass and receives a clickbait failure", () => {
  const score = scoreDSTMediaCandidate(candidate({
    title: "SHOCKING proof we live in The Matrix will blow your mind",
    description: "Secret proof and wild claims about the matrix with no model, experiment, or DST bridge.",
    channelTitle: "Viral Uploads",
    duration: "PT11M",
    viewCount: 500,
    likeCount: 12,
  }));

  assert.notEqual(score.verdict, "PASS");
  assert.ok(score.failureCodes.includes("CLICKBAIT_ONLY"));
});

test("pure entertainment video returns REJECT", () => {
  const score = scoreDSTMediaCandidate(candidate({
    title: "Funny gameplay reaction highlights",
    description: "Comedy meme compilation of movie scene reactions and gaming highlights.",
    channelTitle: "Entertainment Daily",
    duration: "PT8M",
  }));

  assert.equal(score.verdict, "REJECT");
  assert.ok(score.failureCodes.includes("PURE_ENTERTAINMENT"));
});

test("market probability video with DST bridge returns WATCH or PASS", () => {
  const score = scoreDSTMediaCandidate(candidate({
    title: "Prediction markets, Bayesian probability, and uncertainty in physical systems",
    description:
      "A long-form interview on forecasting, expected value, market risk, deterministic constraints, information theory, invariants, frame-local uncertainty, and testable prediction models.",
    channelTitle: "Research Markets Podcast",
    tags: ["prediction market", "probability", "information theory", "uncertainty"],
  }));

  assert.ok(score.verdict === "WATCH" || score.verdict === "PASS");
  assert.equal(score.failureCodes.includes("MARKET_IRRELEVANT"), false);
});

test("same input returns identical output every time", () => {
  const input = candidate({
    title: "Digital physics and layered descriptions of uncertainty",
    description:
      "A seminar about computational universe models, deterministic causality, information theory, observer frames, transformations, and cross-framework invariants.",
    tags: ["digital physics", "layered description"],
  });

  assert.deepEqual(scoreDSTMediaCandidate(input), scoreDSTMediaCandidate(input));
});
