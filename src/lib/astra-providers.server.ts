import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getServerEnv } from "@/lib/server-env";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import type { LanguageModel } from "ai";

// Provider order = silent fallback priority. Users never see these names.
type ProviderSpec = {
  id: string;
  label: string; // for admin/logs only — never sent to client
  build: () => LanguageModel | null;
};

function firstEnv(...names: string[]) {
  for (const name of names) {
    const value = getServerEnv(name);
    if (value) return value;
  }
  return undefined;
}

function gemini(keyNames: string[], modelId: string) {
  const key = firstEnv(...keyNames);
  if (!key) return null;
  const provider = createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: key,
  });
  return provider(modelId);
}

function xai(modelId: string) {
  const key = firstEnv("XAI_API_KEY", "X_AI_API_KEY", "GROK_API_KEY");
  if (!key) return null;
  const provider = createOpenAICompatible({
    name: "xai",
    baseURL: "https://api.x.ai/v1",
    apiKey: key,
  });
  return provider(modelId);
}

function groq(modelId: string) {
  const key = firstEnv("GROQ_API_KEY");
  if (!key) return null;
  const provider = createOpenAICompatible({
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: key,
  });
  return provider(modelId);
}

function lovable(modelId: string) {
  const key = getServerEnv("LOVABLE_API_KEY");
  if (!key) return null;
  return createLovableAiGatewayProvider(key)(modelId);
}

// Ordered hierarchy: user keys first, managed gateway last as an emergency
// safety net so normal users do not see downtime if one quota/model is blocked.
export const PROVIDER_CHAIN: ProviderSpec[] = [
  { id: "g25p-1",   label: "gemini-2.5-pro#1",        build: () => gemini(["GEMINI_API_KEY_1", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"], "gemini-2.5-pro") },
  { id: "g25p-2",   label: "gemini-2.5-pro#2",        build: () => gemini(["GEMINI_API_KEY_2", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"], "gemini-2.5-pro") },
  { id: "g25p-3",   label: "gemini-2.5-pro#3",        build: () => gemini(["GEMINI_API_KEY_3", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"], "gemini-2.5-pro") },
  { id: "g25f-1",   label: "gemini-2.5-flash#1",      build: () => gemini(["GEMINI_API_KEY_1", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"], "gemini-2.5-flash") },
  { id: "g25f-2",   label: "gemini-2.5-flash#2",      build: () => gemini(["GEMINI_API_KEY_2", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"], "gemini-2.5-flash") },
  { id: "g25f-3",   label: "gemini-2.5-flash#3",      build: () => gemini(["GEMINI_API_KEY_3", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"], "gemini-2.5-flash") },
  { id: "g25fl-1",  label: "gemini-2.5-flash-lite#1", build: () => gemini(["GEMINI_API_KEY_1", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"], "gemini-2.5-flash-lite") },
  { id: "g25fl-2",  label: "gemini-2.5-flash-lite#2", build: () => gemini(["GEMINI_API_KEY_2", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"], "gemini-2.5-flash-lite") },
  { id: "g25fl-3",  label: "gemini-2.5-flash-lite#3", build: () => gemini(["GEMINI_API_KEY_3", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"], "gemini-2.5-flash-lite") },
  { id: "grok-fast",label: "grok-4-fast",             build: () => xai("grok-4-fast-reasoning") },
  { id: "grok-2",   label: "grok-2",                  build: () => xai("grok-2-1212") },
  { id: "groq-70b",  label: "groq-llama-70b",          build: () => groq("llama-3.3-70b-versatile") },
  { id: "groq-8b",   label: "groq-llama-8b",           build: () => groq("llama-3.1-8b-instant") },
  { id: "lg3f",     label: "managed-gemini-flash",    build: () => lovable("google/gemini-3-flash-preview") },
  { id: "lg25f",    label: "managed-gemini-2.5-flash", build: () => lovable("google/gemini-2.5-flash") },
];

export type AttemptResult = {
  model: LanguageModel;
  spec: ProviderSpec;
};

export function buildAvailableChain(): AttemptResult[] {
  const out: AttemptResult[] = [];
  for (const spec of PROVIDER_CHAIN) {
    const m = spec.build();
    if (m) out.push({ model: m, spec });
  }
  return out;
}
