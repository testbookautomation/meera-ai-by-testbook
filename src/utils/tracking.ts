import { requestJson } from "../services/http";

type EventMetadata = Record<string, unknown>;

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

export const trackEvent = async (
  userId: string,
  eventName: string,
  page: string,
  metadata: EventMetadata = {}
) => {
  if (!userId) return;

  try {
    await requestJson("/api/events", {
      method: "POST",
      timeoutMs: 5000,
      body: JSON.stringify({
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        sessionId: getSessionId(),
        userId,
        eventName,
        page,
        clientTimestamp: new Date().toISOString(),
        metadata: safeMetadata(metadata),
        ...getPageContext(),
      }),
    });
  } catch (err) {
    // Tracking should never interrupt the user experience.
  }
};

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
