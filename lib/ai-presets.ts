export type AiPreset = { provider: string; model: string; label: string; icon: string }

// Gedeeld tussen JarvisWidget (dashboard) en de volledige /chat pagina.
// De eerste entry ('profile') is een sentinel: geen providerOverride meesturen,
// dan valt de server terug op Instellingen → Horizon AI (inclusief 'openai' met
// een custom base-URL, zoals Gemini's OpenAI-compatibiliteitslaag). Zonder dit
// is een in Instellingen gekozen provider dode code: de chat-widgets sturen
// anders altijd hun eigen (Anthropic/Ollama) preset mee en overschrijven 'm.
export const AI_PRESETS: AiPreset[] = [
  { provider: 'profile',   model: '',                          label: 'Mijn instellingen',        icon: '⚙️' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', label: 'Claude Haiku',             icon: '⚡' },
  { provider: 'anthropic', model: 'claude-sonnet-4-5',          label: 'Claude Sonnet',            icon: '🎯' },
  { provider: 'ollama',    model: 'gpt-oss:20b',                label: 'GPT-OSS 20B (lokaal)',     icon: '🦙' },
  { provider: 'ollama',    model: 'qwen3-coder:30b',            label: 'Qwen3 Coder 30B (lokaal)', icon: '🦙' },
  { provider: 'ollama',    model: 'mistral',                    label: 'Mistral (lokaal)',         icon: '🦙' },
  { provider: 'ollama',    model: 'llama3.2',                   label: 'Llama 3.2 (lokaal)',       icon: '🦙' },
]
