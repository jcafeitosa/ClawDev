export const type = "openai_compatible_local";
export const label = "Local Models";

export const models: Array<{ id: string; label: string }> = [];

export const agentConfigurationDoc = `# openai_compatible_local agent configuration

Adapter: openai_compatible_local

Use when:
- You want ClawDev to run against a local OpenAI-compatible runtime such as Ollama, LM Studio, or llama.cpp.
- You have a local OpenAI-compatible endpoint exposing \`/v1/models\` and \`/v1/chat/completions\`.

Don't use when:
- You need a CLI-based agent runtime.
- Your provider does not expose the OpenAI-compatible chat completions API.

Core fields:
- baseUrl (string, required): OpenAI-compatible base URL, e.g. http://localhost:11434/v1, http://localhost:1234/v1, or http://localhost:8080/v1
- model (string, required): model id returned by \`GET /v1/models\`
- apiKey (string, optional): bearer token for endpoints that require one
- promptTemplate (string, optional): prompt template with {{agent.id}}, {{agent.name}} etc.
- systemPrompt (string, optional): system prompt to prepend
- temperature (number, optional): sampling temperature
- maxTokens (number, optional): maximum completion tokens
- command (string, optional): retained for compatibility; ignored by this adapter

Operational fields:
- timeoutSec (number, optional): request timeout in seconds
- graceSec (number, optional): retained for compatibility; ignored by this adapter

Notes:
- Discovery comes from \`GET /v1/models\`.
- Execution uses \`POST /v1/chat/completions\`.
- If the model is missing, configure the local runtime to expose it and retry discovery.
`;
