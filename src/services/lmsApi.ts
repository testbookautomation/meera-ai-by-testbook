import { ApiError, requestJson } from "./http";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type FetchAnalysisOptions = {
  live?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export async function fetchLmsAnalysis(userId: string, options: FetchAnalysisOptions = {}) {
  const params = options.live ? "?live=1" : "";
  const payload = await requestJson<ApiResponse<any>>(`/api/analysis/${encodeURIComponent(userId)}${params}`, {
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 12000,
  });

  if (!payload.success || !payload.data) {
    throw new ApiError(payload.error || "No LMS analysis found for this user.");
  }

  return payload.data;
}
