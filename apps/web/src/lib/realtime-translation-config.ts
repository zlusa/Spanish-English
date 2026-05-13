/** Browser-side config for OpenAI Realtime Translation (no secrets). */

export const REALTIME_TRANSLATION_CALL_URL =
  "https://api.openai.com/v1/realtime/translations/calls"

export type TranslationLanguageOption = { value: string; label: string }

export const TRANSLATION_LANGUAGES: TranslationLanguageOption[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "ru", label: "Russian" },
]

type SessionUpdateConfig = {
  language: string
  inputTranscriptionEnabled: boolean
  noiseReductionEnabled: boolean
}

export function buildSessionUpdate(config: SessionUpdateConfig): {
  type: string
  session: Record<string, unknown>
} {
  const input: Record<string, unknown> = {}
  if (config.inputTranscriptionEnabled) {
    input.transcription = { model: "gpt-realtime-whisper" }
  }
  if (config.noiseReductionEnabled) {
    input.noise_reduction = { type: "near_field" }
  }

  return {
    type: "session.update",
    session: {
      audio: {
        ...(Object.keys(input).length > 0 ? { input } : {}),
        output: { language: config.language },
      },
    },
  }
}
