export interface PiBridgeProviderPreset {
  provider: string;
  label: string;
  envVars: string[];
  sampleModel: string;
  resource: string;
}

export const PI_DEDICATED_PROVIDERS = new Set(["anthropic", "openai", "google"]);

export const PI_BRIDGE_PROVIDER_PRESETS: PiBridgeProviderPreset[] = [
  {
    provider: "groq",
    label: "Groq",
    envVars: ["GROQ_API_KEY"],
    sampleModel: "groq/qwen-qwq-32b",
    resource: "Fast OpenAI-style inference",
  },
  {
    provider: "xai",
    label: "xAI",
    envVars: ["XAI_API_KEY"],
    sampleModel: "xai/grok-4",
    resource: "Grok models through Pi",
  },
  {
    provider: "mistral",
    label: "Mistral",
    envVars: ["MISTRAL_API_KEY"],
    sampleModel: "mistral/devstral-medium-latest",
    resource: "General-purpose and coding models",
  },
  {
    provider: "cerebras",
    label: "Cerebras",
    envVars: ["CEREBRAS_API_KEY"],
    sampleModel: "cerebras/llama-3.1-70b",
    resource: "High-throughput hosted models",
  },
  {
    provider: "openrouter",
    label: "OpenRouter",
    envVars: ["OPENROUTER_API_KEY"],
    sampleModel: "openrouter/anthropic/claude-3.7-sonnet",
    resource: "Access to many hosted models",
  },
  {
    provider: "minimax",
    label: "MiniMax",
    envVars: ["MINIMAX_API_KEY"],
    sampleModel: "minimax/abab6.5s",
    resource: "MiniMax coding and chat models",
  },
  {
    provider: "kimi-coding",
    label: "Kimi Coding",
    envVars: ["KIMI_CODING_API_KEY", "KIMI_API_KEY"],
    sampleModel: "kimi-coding/kimi-k2",
    resource: "Kimi coding models",
  },
  {
    provider: "azure",
    label: "Azure OpenAI",
    envVars: ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"],
    sampleModel: "azure/gpt-4.1",
    resource: "Azure-hosted OpenAI deployments",
  },
  {
    provider: "cohere",
    label: "Cohere",
    envVars: ["COHERE_API_KEY"],
    sampleModel: "cohere/command-r-plus",
    resource: "Cohere command models",
  },
  {
    provider: "fireworks",
    label: "Fireworks",
    envVars: ["FIREWORKS_API_KEY"],
    sampleModel: "fireworks/deepseek-r1",
    resource: "Fireworks hosted model catalog",
  },
  {
    provider: "together",
    label: "Together",
    envVars: ["TOGETHER_API_KEY"],
    sampleModel: "together/meta-llama/Llama-3.3-70B-Instruct-Turbo",
    resource: "Together model marketplace",
  },
  {
    provider: "deepseek",
    label: "DeepSeek",
    envVars: ["DEEPSEEK_API_KEY"],
    sampleModel: "deepseek/deepseek-chat",
    resource: "DeepSeek reasoning and coding models",
  },
  {
    provider: "perplexity",
    label: "Perplexity",
    envVars: ["PERPLEXITY_API_KEY"],
    sampleModel: "perplexity/sonar-pro",
    resource: "Perplexity search-grounded models",
  },
];

export function getPiBridgeProviderNames(): string[] {
  return PI_BRIDGE_PROVIDER_PRESETS.map((preset) => preset.provider);
}
