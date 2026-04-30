import { ApiError, requestJson } from "./http";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type SpeechPayload = {
  audioContent: string;
  mimeType: string;
};

export async function synthesizeSpeech({
  text,
  responseLanguage,
  signal,
}: {
  text: string;
  responseLanguage?: string;
  signal?: AbortSignal;
}) {
  const payload = await requestJson<ApiResponse<SpeechPayload>>("/api/tts", {
    method: "POST",
    timeoutMs: 20000,
    signal,
    body: JSON.stringify({
      text,
      responseLanguage,
    }),
  });

  if (!payload.success || !payload.data?.audioContent) {
    throw new ApiError(payload.error || "Failed to generate voice output.");
  }

  return payload.data;
}
