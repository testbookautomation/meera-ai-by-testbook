import { ApiError, requestJson } from "./http";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type ChatHistoryItem = {
  from: "bot" | "user";
  text: string;
};

export async function sendAiMentorMessage({
  userId,
  message,
  history,
  responseLanguage,
  signal,
}: {
  userId: string;
  message: string;
  history: ChatHistoryItem[];
  responseLanguage?: string;
  signal?: AbortSignal;
}) {
  const payload = await requestJson<ApiResponse<{ text: string }>>(
    "/api/ai-mentor/chat",
    {
      method: "POST",
      timeoutMs: 65000,
      signal,
      body: JSON.stringify({
        userId,
        message,
        history,
        responseLanguage,
      }),
    },
  );

  if (!payload.success || !payload.data?.text) {
    throw new ApiError(payload.error || "Failed to get AI Mentor response.");
  }

  return payload.data.text;
}
