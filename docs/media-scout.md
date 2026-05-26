# DST Media Scout v0

DST Media Scout v0 is a read-only discovery and scoring pass for long-form YouTube episodes. It finds DST-relevant podcasts, lectures, interviews, and similar long-form videos, normalizes their YouTube metadata, and applies a deterministic PASS / WATCH / REJECT relevance gate before any future clipping workflow exists.

## Setup

Set the official YouTube Data API key in the environment:

```sh
export YOUTUBE_API_KEY="your-api-key"
```

The implementation uses only the official YouTube Data API. It does not scrape YouTube pages, download video, clip video, call Browserbase, call Vugola, or publish anything.

## Dry-Run Usage

Start the API server:

```sh
PORT=8080 pnpm start
```

Run discovery with a query:

```sh
curl "http://localhost:8080/api/media-scout/discover?q=simulation%20theory%20determinism%20information%20physics"
```

Optional `limit` can be supplied, capped at 25:

```sh
curl "http://localhost:8080/api/media-scout/discover?q=prediction%20markets%20uncertainty%20physics&limit=5"
```

Every response is dry-run/read-only and returns candidates sorted by deterministic score:

```json
{
  "mode": "dry_run",
  "query": "simulation theory determinism information physics",
  "count": 10,
  "candidates": [
    {
      "videoId": "...",
      "url": "https://www.youtube.com/watch?v=...",
      "title": "...",
      "score": {
        "total": 82,
        "verdict": "PASS",
        "reason": "PASS at 82/100..."
      }
    }
  ]
}
```

## Scoring

The relevance gate is deterministic and does not use an LLM. It scores fixed buckets for deterministic physics, simulation theory, information theory, consciousness/observer relevance, market or prediction utility, source credibility, thumbnail/title signal, and novelty. Hard failure codes prevent PASS results when a candidate is clickbait-only, pure entertainment, market-irrelevant, recycled low-signal content, pseudoscience without testable claims, missing a DST bridge, or a copyright/rights risk.

## Future Phases

1. Browserbase visual audit for PASS/WATCH candidates.
2. Vugola clipping behind `ENABLE_CLIPPING=true`.
3. Review queue.
4. Optional publishing only after human approval.
