import Anthropic from "@anthropic-ai/sdk";

export interface CommentaryRequest {
  /** What's being explained, e.g. "EBITDA — Germany, FY2023". */
  title: string;
  currencyLabel: string;
  /** The specific figure the user asked about. */
  focus: { label: string; actual: number; budget: number; variance: number; pctVariance: number | null };
  /** Full P&L context so the model can identify real offsetting drivers, not invent them. */
  fullPl: Array<{ label: string; actual: number; budget: number; variance: number; pctVariance: number | null }>;
}

export interface CommentaryResult {
  text: string;
}

export interface CommentaryError {
  error: string;
}

const SYSTEM_PROMPT = `You write concise, management-ready commentary explaining validated financial variances for an FP&A team.

Rules:
- You are explaining numbers that have already been calculated and validated. Never recalculate, restate a different number, or invent a figure not given to you.
- Structure your answer in exactly this order, as flowing prose (not headings): what happened, how significant it is, why it happened (using the P&L lines provided to identify real drivers), and what — if anything — offset it.
- Every number you cite must come directly from the data provided. Do not estimate or guess a driver that isn't in the data.
- Keep it to 2-4 sentences. Write like the example: "Germany's EBITDA is €6.2M below budget (-7.8%), primarily driven by an unfavorable OPEX variance of €8.1M, particularly Marketing & Advertising. Higher revenue of €15.9M partially offset the impact."
- If the data doesn't clearly show a driver, say the variance is broad-based across lines rather than inventing a specific cause.`;

function buildUserPrompt(req: CommentaryRequest): string {
  const fmt = (n: number) => `${req.currencyLabel} ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const pct = (n: number | null) => (n === null ? "n/a" : `${(n * 100).toFixed(1)}%`);
  const lines = req.fullPl
    .map((l) => `- ${l.label}: actual ${fmt(l.actual)}, budget ${fmt(l.budget)}, variance ${fmt(l.variance)} (${pct(l.pctVariance)})`)
    .join("\n");
  return `Explain this variance: ${req.title}

Focus line: ${req.focus.label} — actual ${fmt(req.focus.actual)}, budget ${fmt(req.focus.budget)}, variance ${fmt(req.focus.variance)} (${pct(req.focus.pctVariance)})

Full P&L for context (use this to find real offsetting drivers):
${lines}`;
}

/** Returns null if no API key is configured — callers should show a clear "not configured" state, not a crash. */
export async function generateCommentary(req: CommentaryRequest): Promise<CommentaryResult | CommentaryError> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "AI Commentary is unavailable: ANTHROPIC_API_KEY is not configured on this server." };
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(req) }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { error: "AI Commentary returned no text (the model may have refused or used only tool calls)." };
    }
    return { text: textBlock.text };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { error: "AI Commentary is unavailable: the configured Anthropic API key was rejected." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { error: "AI Commentary is temporarily rate-limited. Try again shortly." };
    }
    if (err instanceof Anthropic.APIError) {
      return { error: `AI Commentary failed: ${err.message}` };
    }
    throw err;
  }
}
