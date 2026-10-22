// Shared Claude call used by both agents: web search + fetch, structured JSON output.

import { MODEL } from "./prompt.mjs";

// Rough cost from usage, in USD (Claude Opus 5.5 list prices; web search billed per search).
export function cost(u) {
  return (u.input_tokens * 4 + (u.cache_creation_input_tokens || 0) * 5 + (u.cache_read_input_tokens || 0) * 0.2 + u.output_tokens * 20) / 1e6
    + ((u.server_tool_use && u.server_tool_use.web_search_requests) || 0) * 0.01;
}

export async function askClaude(client, { system, schema, prompt, effort, searches, fetches, pageTokens, maxTokens = 32000 }) {
  const messages = [{ role: "user", content: prompt }];
  const all = [];
  const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: 0 } };
  for (let turn = 0; turn < 6; turn++) {
    const msg = await client.beta.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system,
      output_config: { effort, format: { type: "json_schema", schema } },
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: searches },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: fetches, max_content_tokens: pageTokens }
      ],
      messages
    }).finalMessage();
    all.push(...msg.content);
    for (const k of ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"]) usage[k] += msg.usage[k] || 0;
    usage.server_tool_use.web_search_requests += (msg.usage.server_tool_use && msg.usage.server_tool_use.web_search_requests) || 0;

    if (msg.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: msg.content }); continue; }
    if (msg.stop_reason === "refusal") return { error: `Declined (${msg.stop_details && msg.stop_details.category})`, blocks: all, usage };
    if (msg.stop_reason === "max_tokens") return { error: "Ran out of output tokens", blocks: all, usage };
    const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
    try { return { output: JSON.parse(text), blocks: all, usage }; }
    catch { return { error: "Output was not valid JSON", blocks: all, usage }; }
  }
  return { error: "Too many paused turns", blocks: all, usage };
}

// What the agent actually did: tool calls and tool errors, for the run log.
export function activity(blocks) {
  const a = { searches: 0, fetches: 0, toolErrors: [] };
  for (const b of blocks) {
    if (b.type === "server_tool_use" && b.name === "web_search") a.searches++;
    if (b.type === "server_tool_use" && b.name === "web_fetch") a.fetches++;
    if (/_tool_result$/.test(b.type) && b.content && !Array.isArray(b.content) && b.content.error_code) a.toolErrors.push(`${b.type.replace("_tool_result", "")}: ${b.content.error_code}`);
  }
  return a;
}

// Runs async jobs with at most `n` in flight.
export async function pool(items, n, fn) {
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}
