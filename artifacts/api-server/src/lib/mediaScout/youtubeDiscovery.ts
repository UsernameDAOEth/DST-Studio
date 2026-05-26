import type { DSTMediaCandidate } from "./types";

export type YouTubeDiscoveryErrorCode =
  | "MISSING_YOUTUBE_API_KEY"
  | "YOUTUBE_API_FAILURE"
  | "MALFORMED_YOUTUBE_RESPONSE"
  | "NO_YOUTUBE_RESULTS";

export class YouTubeDiscoveryError extends Error {
  readonly code: YouTubeDiscoveryErrorCode;
  readonly status?: number;

  constructor(code: YouTubeDiscoveryErrorCode, message: string, status?: number) {
    super(message);
    this.name = "YouTubeDiscoveryError";
    this.code = code;
    this.status = status;
  }
}

export type DiscoverYouTubeCandidatesOptions = {
  query: string;
  maxResults?: number;
  apiKey?: string;
};

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
  }>;
};

type YouTubeVideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string }>;
      tags?: string[];
    };
    contentDetails?: {
      duration?: string;
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
    };
  }>;
};

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const DEFAULT_QUERY = "simulation theory determinism information physics podcast lecture interview";

function readApiKey(explicit?: string): string {
  const key = explicit ?? process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new YouTubeDiscoveryError(
      "MISSING_YOUTUBE_API_KEY",
      "YOUTUBE_API_KEY is required for DST Media Scout YouTube discovery.",
    );
  }
  return key;
}

function parseCount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function bestThumbnailUrl(thumbnails: Record<string, { url?: string }> | undefined): string | undefined {
  return thumbnails?.maxres?.url ?? thumbnails?.standard?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url;
}

function buildUrl(path: string, params: Record<string, string | number>): string {
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new YouTubeDiscoveryError(
      "YOUTUBE_API_FAILURE",
      `YouTube Data API request failed with status ${response.status}.`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

function assertSearchResponse(value: YouTubeSearchResponse): string[] {
  if (!Array.isArray(value.items)) {
    throw new YouTubeDiscoveryError("MALFORMED_YOUTUBE_RESPONSE", "YouTube search response did not include an items array.");
  }
  const ids = value.items.map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    throw new YouTubeDiscoveryError("NO_YOUTUBE_RESULTS", "YouTube search returned no video candidates.");
  }
  return ids;
}

function normalizeVideosResponse(value: YouTubeVideosResponse): DSTMediaCandidate[] {
  if (!Array.isArray(value.items)) {
    throw new YouTubeDiscoveryError("MALFORMED_YOUTUBE_RESPONSE", "YouTube videos response did not include an items array.");
  }
  const candidates = value.items.map((item) => {
    const videoId = item.id;
    const snippet = item.snippet;
    const duration = item.contentDetails?.duration;
    if (!videoId || !snippet?.title || !snippet.channelTitle || !snippet.publishedAt || !duration) {
      throw new YouTubeDiscoveryError("MALFORMED_YOUTUBE_RESPONSE", "YouTube video item was missing required metadata.");
    }
    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: snippet.title,
      description: snippet.description ?? "",
      channelTitle: snippet.channelTitle,
      publishedAt: snippet.publishedAt,
      duration,
      thumbnailUrl: bestThumbnailUrl(snippet.thumbnails),
      tags: snippet.tags,
      viewCount: parseCount(item.statistics?.viewCount),
      likeCount: parseCount(item.statistics?.likeCount),
    };
  });
  if (candidates.length === 0) {
    throw new YouTubeDiscoveryError("NO_YOUTUBE_RESULTS", "YouTube videos lookup returned no usable candidates.");
  }
  return candidates;
}

export async function discoverYouTubeCandidates(options: DiscoverYouTubeCandidatesOptions): Promise<DSTMediaCandidate[]> {
  const apiKey = readApiKey(options.apiKey);
  const query = options.query.trim() || DEFAULT_QUERY;
  const maxResults = Math.max(1, Math.min(options.maxResults ?? 10, 25));
  const searchUrl = buildUrl("search", {
    key: apiKey,
    part: "snippet",
    q: query,
    type: "video",
    maxResults,
    order: "relevance",
    safeSearch: "moderate",
    videoDuration: "long",
  });
  const search = await fetchJson<YouTubeSearchResponse>(searchUrl);
  const ids = assertSearchResponse(search);
  const videosUrl = buildUrl("videos", {
    key: apiKey,
    part: "snippet,contentDetails,statistics",
    id: ids.join(","),
    maxResults,
  });
  return normalizeVideosResponse(await fetchJson<YouTubeVideosResponse>(videosUrl));
}
