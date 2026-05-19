import { requestJson } from "../services/http";

type EventMetadata = Record<string, unknown>;

// WebEngage Web SDK type declaration
declare global {
  interface Window {
    webengage?: {
      track: (eventName: string, data?: Record<string, unknown>) => void;
      user: {
        login: (userId: string) => void;
        logout: () => void;
        setAttribute: (key: string, value: unknown) => void;
      };
    };
  }
}

export function webengageIdentify(userId: string) {
  try {
    window.webengage?.user?.login(userId);
  } catch {/* silent */}
}

function buildWebengagePayload(eventName: string, metadata: EventMetadata): Record<string, unknown> {
  const m = metadata as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    source: "Meera AI",
    session_id: sessionStorage.getItem("meera_event_session_id") || "",
    page: window.location.pathname,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };
  if (m.message)       payload.message          = String(m.message).slice(0, 500);
  if (m.response)      payload.response         = String(m.response).slice(0, 500);
  if (m.error)         payload.error            = m.error;
  if (m.survey_score !== undefined) payload.survey_score = Number(m.survey_score);
  if (m.user_score !== undefined)   payload.user_score   = Number(m.user_score);
  if (m.weak_topics)   payload.weak_topics      = m.weak_topics;
  if (m.test_name)     payload.test_name        = m.test_name;
  if (m.accuracy !== undefined)     payload.accuracy     = Number(m.accuracy);
  if (m.is_pro !== undefined)       payload.is_pro       = m.is_pro;
  if (m.suggestion)    payload.suggestion_text  = m.suggestion;
  if (m.input_tokens !== undefined || m.inputTokens !== undefined)
    payload.input_tokens  = Number((m.input_tokens ?? m.inputTokens) || 0);
  if (m.output_tokens !== undefined || m.outputTokens !== undefined)
    payload.output_tokens = Number((m.output_tokens ?? m.outputTokens) || 0);
  if (m.responseLength !== undefined) payload.response_length  = Number(m.responseLength);
  if (m.durationMs !== undefined)     payload.response_time_ms = Number(m.durationMs);
  if (m.reason)  payload.reason = m.reason;
  if (m.type)    payload.type   = m.type;
  if (m.label)   payload.label  = m.label;
  return payload;
}

// Pending events queued before SDK loads
const _wePending: Array<[string, Record<string, unknown>]> = [];
let _weReady = false;

function flushWebengageQueue() {
  _weReady = true;
  _wePending.forEach(([name, data]) => {
    try { window.webengage!.track(name, data); } catch { /* silent */ }
  });
  _wePending.length = 0;
}

// Listen for SDK ready — WebEngage fires "webengage.ready" once loaded
if (typeof window !== "undefined") {
  window.addEventListener("webengage.ready", flushWebengageQueue, { once: true });
  // Fallback: poll until .track() exists (max 10s)
  let _polls = 0;
  const _poll = setInterval(() => {
    if (typeof window.webengage?.track === "function") {
      clearInterval(_poll);
      flushWebengageQueue();
    } else if (++_polls > 100) {
      clearInterval(_poll);
    }
  }, 100);
}

function fireWebengage(eventName: string, metadata: EventMetadata) {
  try {
    if (typeof window === "undefined") return;
    const payload = buildWebengagePayload(eventName, metadata);
    if (_weReady && typeof window.webengage?.track === "function") {
      window.webengage.track(eventName, payload);
    } else {
      // Queue until SDK is ready
      _wePending.push([eventName, payload]);
    }
  } catch { /* silent */ }
}

const SESSION_KEY = "meera_event_session_id";
const MAX_TEXT_LENGTH = 700;
const MAX_METADATA_LENGTH = 4500;

function getSessionId() {
  if (typeof window === "undefined") return "server";

  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function cleanText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeMetadata(metadata: EventMetadata = {}) {
  const safe = JSON.parse(JSON.stringify(metadata, (_key, value) => {
    if (typeof value === "string") return cleanText(value, MAX_TEXT_LENGTH);
    if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
    if (Array.isArray(value)) return value.slice(0, 20);
    return value;
  }));

  const serialized = JSON.stringify(safe);
  if (serialized.length <= MAX_METADATA_LENGTH) return safe;

  return {
    truncated: true,
    preview: serialized.slice(0, MAX_METADATA_LENGTH),
  };
}

function getPageContext() {
  if (typeof window === "undefined") return {};

  return {
    url: window.location.href,
    path: window.location.pathname,
    query: window.location.search,
    title: document.title,
    referrer: document.referrer,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    userAgent: navigator.userAgent,
  };
}

function describeElement(element: Element | null) {
  if (!element) return {};

  const htmlElement = element as HTMLElement;
  const inputElement = element as HTMLInputElement;
  const anchorElement = element as HTMLAnchorElement;

  return {
    tag: element.tagName.toLowerCase(),
    id: htmlElement.id || "",
    role: htmlElement.getAttribute("role") || "",
    type: inputElement.type || "",
    name: inputElement.name || "",
    ariaLabel: htmlElement.getAttribute("aria-label") || "",
    title: htmlElement.getAttribute("title") || "",
    text: cleanText(htmlElement.innerText || inputElement.value || htmlElement.getAttribute("aria-label") || ""),
    href: anchorElement.href || "",
    testId: htmlElement.getAttribute("data-testid") || "",
    classes: cleanText(htmlElement.className || "", 220),
  };
}

function getTrackableElement(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;

  return target.closest(
    "button,a,input,select,textarea,[role='button'],[data-track],[data-testid]"
  );
}

const PREFIX = "meera_ai_";

function prefixEvent(name: string): string {
  return name.startsWith(PREFIX) ? name : `${PREFIX}${name}`;
}

export const trackEvent = async (
  userId: string,
  eventName: string,
  page: string,
  metadata: EventMetadata = {}
) => {
  if (!userId) return;

  const name = prefixEvent(eventName);

  // Fire directly to WebEngage Web SDK (browser-side, instant)
  fireWebengage(name, { ...metadata, page });

  // Also forward to backend → Apps Script → WebEngage REST (server-side backup)
  try {
    await requestJson("/api/events", {
      method: "POST",
      timeoutMs: 5000,
      body: JSON.stringify({
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        sessionId: getSessionId(),
        userId,
        eventName: name,
        page,
        clientTimestamp: new Date().toISOString(),
        metadata: safeMetadata(metadata),
        ...getPageContext(),
      }),
    });
  } catch {
    // Tracking should never interrupt the user experience.
  }
};

export function sendBeaconEvent(
  userId: string,
  eventName: string,
  page: string,
  metadata: EventMetadata = {}
) {
  if (!userId || typeof navigator === "undefined" || !navigator.sendBeacon) return;
  const name = prefixEvent(eventName);
  const payload = JSON.stringify({
    eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    sessionId: getSessionId(),
    userId,
    eventName: name,
    page,
    clientTimestamp: new Date().toISOString(),
    metadata: safeMetadata(metadata),
    ...getPageContext(),
  });
  try {
    navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
  } catch { /* silent */ }
}

export function installGlobalEventTracking(getUserId: () => string, page: string) {
  if (typeof window === "undefined") return () => {};

  const track = (eventName: string, metadata: EventMetadata = {}) => {
    const userId = getUserId();
    if (!userId) return;
    void trackEvent(userId, eventName, page, metadata);
  };

  const onClick = (event: MouseEvent) => {
    const element = getTrackableElement(event.target);
    if (!element) return;

    track("ui_click", {
      element: describeElement(element),
      click: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  };

  const onVisibilityChange = () => {
    track(document.visibilityState === "hidden" ? "page_hidden" : "page_visible");
  };

  const onBeforeUnload = () => {
    track("page_unload");
  };

  document.addEventListener("click", onClick, true);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("beforeunload", onBeforeUnload);
  track("page_view");

  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}
