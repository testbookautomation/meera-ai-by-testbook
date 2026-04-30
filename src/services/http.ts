export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type JsonRequestOptions = RequestInit & {
  timeoutMs?: number;
};

const env = import.meta.env as Record<string, string | undefined>;

// Serverless production uses same-origin /api/* routes by default.
// Set VITE_USE_EXTERNAL_API=true only when intentionally pointing at a separate backend.
const API_BASE =
  env.VITE_USE_EXTERNAL_API === "true"
    ? String(env.VITE_API_BASE_URL || "").replace(/\/+$/, "")
    : "";

let csrfToken: string | null = null;
let csrfTokenRequest: Promise<string> | null = null;

function isCrossOriginApiBase() {
  if (!API_BASE || typeof window === "undefined") return false;

  try {
    return (
      new URL(API_BASE, window.location.origin).origin !==
      window.location.origin
    );
  } catch {
    return false;
  }
}

function buildApiUrl(url: string) {
  return url.startsWith("/api") ? `${API_BASE}${url}` : url;
}

function needsAppSession(url: string) {
  return (
    typeof url === "string" &&
    url.startsWith("/api/") &&
    url !== "/api/session" &&
    !isCrossOriginApiBase()
  );
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  if (!csrfTokenRequest) {
    csrfTokenRequest = fetch(buildApiUrl("/api/session"), {
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          data?: { csrfToken?: string };
          error?: string;
        } | null;
        if (!response.ok || !payload?.data?.csrfToken) {
          throw new ApiError(
            payload?.error || "Could not start a secure app session.",
            response.status,
            payload,
          );
        }
        csrfToken = payload.data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfTokenRequest = null;
      });
  }

  return csrfTokenRequest!;
}

export async function requestJson<T>(
  url: string,
  options: JsonRequestOptions = {},
): Promise<T> {
  const { timeoutMs = 15000, signal, headers, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const useAppSession = needsAppSession(url);
  const isCrossOrigin = isCrossOriginApiBase();

  const fullUrl = buildApiUrl(url);

  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const secureHeaders = useAppSession
      ? {
          "X-CSRF-Token": await getCsrfToken(),
          "X-Requested-With": "XMLHttpRequest",
        }
      : {};

    let response = await fetch(fullUrl, {
      ...fetchOptions,
      credentials: useAppSession
        ? "same-origin"
        : isCrossOrigin
          ? "omit"
          : fetchOptions.credentials,
      signal: controller.signal,
      headers: {
        ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
        ...secureHeaders,
        ...headers,
      },
    });

    if (useAppSession && (response.status === 401 || response.status === 403)) {
      csrfToken = null;
      const refreshedToken = await getCsrfToken();
      response = await fetch(fullUrl, {
        ...fetchOptions,
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
          "X-CSRF-Token": refreshedToken,
          "X-Requested-With": "XMLHttpRequest",
          ...headers,
        },
      });
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const errorPayload = payload as { error?: string } | null;
      throw new ApiError(
        errorPayload?.error || `Request failed with ${response.status}`,
        response.status,
        payload,
      );
    }

    return payload as T;
  } catch (error: unknown) {
    if ((error as { name?: string })?.name === "AbortError") {
      throw new ApiError("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
