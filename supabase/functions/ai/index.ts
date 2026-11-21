// Idea Canvas : l'IA de la toile. Appelée par la page (connectée) ; la clé Anthropic reste ici, dans les secrets Supabase.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM =
  "You help Yusuf organise ideas in his personal canvas (founder of Pharmaxity, a professional network for the pharmacy world in France; pharmacy job and studies; personal life). " +
  "Write in the language of the content (French or English). Be short and concrete. Plain text or simple markdown lists only, no headings unless asked, no em dashes. " +
  "Never invent facts, names, dates or numbers that are not in the content.";

const leaf = { type: "object", properties: { t: { type: "string" } }, required: ["t"], additionalProperties: false };
const l2 = { type: "object", properties: { t: { type: "string" }, c: { type: "array", items: leaf } }, required: ["t", "c"], additionalProperties: false };
const l1 = { type: "object", properties: { t: { type: "string" }, c: { type: "array", items: l2 } }, required: ["t", "c"], additionalProperties: false };
const MINDMAP = { type: "object", properties: { t: { type: "string" }, c: { type: "array", items: l1 } }, required: ["t", "c"], additionalProperties: false };
const IDEAS = { type: "object", properties: { ideas: { type: "array", items: { type: "string" } } }, required: ["ideas"], additionalProperties: false };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Seul un compte connecté de la toile peut appeler l'IA (les inscriptions sont fermées).
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "Sign in to use AI." }, 401);
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Add your Anthropic API key in Supabase: Edge Functions, Secrets, name ANTHROPIC_API_KEY.", code: "no_key" }, 500);

    const body = await req.json();
    const task = String(body.task || "");
    const text = String(body.text || "").slice(0, 60000);
    const today = String(body.today || new Date().toISOString().slice(0, 10));
    let prompt = "", schema: unknown = null, effort = "low";
    if (task === "summary") prompt = `Summarise this content in 3 to 6 short bullet points, each line starting with "- ".\n\n${text}`;
    else if (task === "steps") { prompt = `Suggest 3 to 7 concrete next steps for this content, as a to-do list: one per line, each starting with "- [ ] ". Short and actionable.\n\n${text}`; effort = "medium"; }
    else if (task === "tasks") prompt = `Today is ${today}. List every task or commitment stated in this content, one per line, each starting with "- [ ] ". When the content gives a date, end the line with " @YYYY-MM-DD". If there is none, answer exactly NONE.\n\n${text}`;
    else if (task === "mindmap") { prompt = `Build a mind map of this content: a short central title, 3 to 7 main branches, each with up to 5 short sub-ideas (and sub-sub-ideas only when useful). At most 6 words per idea. Use only what the content says.\n\n${text}`; schema = MINDMAP; effort = "medium"; }
    else if (task === "ideas") { prompt = `Mind map about "${String(body.root || "").slice(0, 200)}". Suggest 5 new, specific ideas for the branch "${String(body.branch || "").slice(0, 200)}" (path: ${String(body.path || "").slice(0, 400)}). Existing ideas there, do not repeat them: ${String(body.existing || "none").slice(0, 2000)}. At most 6 words each.`; schema = IDEAS; }
    else if (task === "clean") prompt = `Fix punctuation, capitalisation and obvious dictation mistakes in this text. Keep the wording, meaning and language. Return only the corrected text.\n\n${text}`;
    else if (task === "ask") { prompt = `Question: ${String(body.question || "").slice(0, 2000)}\n\nAnswer it using this content (say so if the content does not answer it):\n\n${text}`; effort = "medium"; }
    else return json({ error: "Unknown task." }, 400);

    const client = new Anthropic({ apiKey });
    // deno-lint-ignore no-explicit-any
    const params: any = {
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
      output_config: { effort },
    };
    if (schema) params.output_config.format = { type: "json_schema", schema };
    const r = await client.beta.messages.create(params);
    if (r.stop_reason === "refusal") return json({ error: "Claude declined this request." }, 422);
    // deno-lint-ignore no-explicit-any
    const out = r.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    return json(schema ? { data: JSON.parse(out) } : { text: out });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "Your Anthropic API key was refused. Check it in Supabase secrets." }, 500);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Too many AI requests. Try again in a minute." }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: "Claude is unavailable right now. Try again." }, 502);
    return json({ error: "AI failed: " + ((e as Error)?.message || String(e)) }, 500);
  }
});
