/** OpenAI Realtime Translation — client secret request (server-side). */

export const TRANSLATION_CLIENT_SECRET_URL =
  "https://api.openai.com/v1/realtime/translations/client_secrets"

const OUTPUT_LANGUAGES = new Set([
  "ar",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "fi",
  "fr",
  "he",
  "hi",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "nl",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sv",
  "th",
  "tr",
  "uk",
  "vi",
  "zh",
])

export function normalizeTranslationLanguage(code: string): string {
  const language = code.trim().toLowerCase()
  if (!OUTPUT_LANGUAGES.has(language)) {
    throw new Error(`Unsupported translation output language: ${code}`)
  }
  return language
}

export function buildTranslationClientSecretRequest(options: {
  apiKey: string
  language: string
  inputTranscriptionEnabled: boolean
  noiseReductionEnabled: boolean
  model?: string
}): { url: string; init: RequestInit } {
  const model = options.model?.trim() || "gpt-realtime-translate"

  const input: Record<string, unknown> = {}
  if (options.inputTranscriptionEnabled) {
    input.transcription = { model: "gpt-realtime-whisper" }
  }
  if (options.noiseReductionEnabled) {
    input.noise_reduction = { type: "near_field" }
  }

  return {
    url: TRANSLATION_CLIENT_SECRET_URL,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          model,
          audio: {
            ...(Object.keys(input).length > 0 ? { input } : {}),
            output: { language: options.language },
          },
        },
      }),
    },
  }
}
