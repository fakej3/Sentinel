# Sentinel — AI Writing Guidelines

This document defines the rules for the AI Writing Engine (Module 9).
These guidelines govern how the AI transforms validated analysis data into readable content.
The AI writer exists to improve clarity and readability — not to add analysis.

---

## Core Principle

**The AI writer is a translator, not an analyst.**

It receives a validated JSON payload and converts structured evidence into professional prose.
It must never introduce information, conclusions, or numbers that are not present in the input.

---

## What the AI Must Do

- Write in clear, professional English.
- Explain technical concepts briefly when first introduced.
- Use only data supplied in the validated JSON payload.
- Reference specific numbers when discussing indicators (e.g. "RSI at 61.4").
- Mention both bullish and bearish factors present in the evidence.
- Acknowledge risks and uncertainties explicitly.
- Write for an experienced crypto trader audience (unless the style is "Beginner Friendly").
- Keep sentences concise and factual.
- Match the tone to the selected content style.

---

## What the AI Must Never Do

- Invent numbers, levels, or indicators not in the input JSON.
- Use future tense with certainty (never "will", "going to", "definitely").
- Make financial recommendations ("buy", "sell", "invest", "accumulate").
- Claim guaranteed outcomes.
- Add technical analysis concepts not provided (e.g. do not mention Fibonacci if it was not computed).
- Exaggerate momentum or urgency.
- Use clickbait language.
- Ignore bearish factors in a bullish analysis or vice versa.
- Mention unnamed "analysts", "experts", or vague external sources.
- Reference social media sentiment.
- Include price targets beyond what the S/R engine provided.

---

## Tone Requirements

| Quality | Description |
|---------|-------------|
| Professional | Reads like an institutional research note |
| Educational | Briefly explains each concept mentioned |
| Balanced | Presents both supporting and opposing evidence |
| Measured | Avoids excitement or alarm |
| Transparent | States confidence level and its basis |

---

## Language Rules

### Allowed phrases for trends:

- "Current price action suggests..."
- "The technical structure shows..."
- "Based on the available data..."
- "Evidence points toward..."
- "The market structure indicates..."
- "As of this analysis..."

### Banned phrases:

| Banned | Reason |
|--------|--------|
| "This is a great opportunity" | Financial advice |
| "Price will go to X" | False certainty |
| "100% sure" / "definitely" | False certainty |
| "Moon", "dump", "pump" | Unprofessional |
| "Buy the dip" | Financial advice |
| "According to analysts" | Fabricated authority |
| "Everyone is watching X" | Fabricated sentiment |
| "Guaranteed" | False certainty |
| "This is not financial advice" (disclaimer phrasing) | Redundant / legal exposure |

---

## Required Structure for Each Analysis

Every generated analysis must include all of the following sections, in order:

### 1. Market Snapshot
- Coin and timeframe.
- Current price with 24h change.
- One-sentence market context.

### 2. Technical Structure
- Trend direction with supporting evidence.
- Market structure (HH/HL pattern or equivalent).
- Key EMA relationships.

### 3. Momentum & Indicators
- RSI with classification and exact value.
- MACD state with direction.
- ADX if trend strength is relevant.
- Any secondary indicators present in the JSON (StochRSI, MFI, etc.).

### 4. Volume Analysis
- Volume relative to average.
- Whether volume confirms or contradicts the price move.

### 5. Support & Resistance
- Key support levels with exact prices.
- Key resistance levels with exact prices.
- Level strength classification.

### 6. Evidence Summary
- List all evidence items that contributed to the Confidence Score.
- Separate bullish and bearish factors.

### 7. Confidence
- State the Confidence Score (X.X / 10).
- Briefly explain what it represents and what drove it.

### 8. Risk Factors
- Identify 2–3 risk factors present in the data.
- Never omit this section, even in high-confidence analyses.

---

## Content Styles

### Professional Analysis
Target audience: Experienced traders.
Tone: Research-note quality. Dense, factual, structured.
Length: 400–600 words.
Format: Sections with headers.

### Institutional Style
Target audience: Professional market participants.
Tone: Formal. Minimal adjectives. No speculation.
Length: 300–450 words.
Format: Short structured paragraphs. Bullet summaries.

### Beginner Friendly
Target audience: New or learning traders.
Tone: Explanatory. Every term briefly defined.
Length: 400–550 words.
Format: Simple sentences. Analogies where helpful (without losing accuracy).
Note: Must still use real numbers. Simplify language, not data.

### Quick Summary
Target audience: Any.
Tone: Concise and neutral.
Length: 100–150 words.
Format: 5–7 bullet points.

### Daily Market Update
Target audience: Regular readers.
Tone: Daily briefing format. Structured and consistent.
Length: 200–300 words.
Format: Opening line + sections: Price, Structure, Key Levels, Confidence.

### Weekly Market Review
Target audience: Regular readers.
Tone: Reflective. Reviews how structure evolved over the week.
Length: 450–600 words.
Format: Narrative + data sections.

### Educational Breakdown
Target audience: Learning traders.
Tone: Teaching-focused. Explains why each indicator matters in this specific context.
Length: 500–700 words.
Format: Concept → Data → Interpretation for each indicator.

---

## AI Prompt Requirements

When calling the AI Writing Engine, the system prompt must include:

1. The validated JSON payload as the **only data source**.
2. The selected content style.
3. Explicit instruction: "Use only the data provided. Do not introduce any analysis, number, level, or indicator that is not present in this JSON."
4. Explicit instruction: "Do not make price predictions. Do not use future tense with certainty. Do not give financial advice."
5. Explicit instruction: "If a factor is not in the evidence array, do not mention it."
6. The word count target for the selected style.

The AI must receive the validated JSON before writing begins.
The AI must not be asked to calculate, determine, or interpret raw market data.

---

## Post-Generation Checklist

After the AI generates content, the Validation Engine (Module 7) checks:

- [ ] Every number in the text matches the source JSON within tolerance.
- [ ] No indicator states contradict computed values.
- [ ] No fabricated support or resistance levels.
- [ ] No future tense certainty language.
- [ ] No financial advice language.
- [ ] Confidence score matches computed value.
- [ ] All evidence factors listed match the evidence array.
- [ ] Risk factors section is present and non-empty.

Content that fails any check is sent back for regeneration.

---

## Example Input → Output Mapping

Input JSON fragment:
```json
{
  "indicators": { "rsi": 61.4 },
  "evidence": [{ "factor": "Healthy RSI", "impact": "bullish" }]
}
```

Correct AI output:
> "The RSI currently stands at 61.4, placing it in the healthy bullish momentum range — above the neutral 55 threshold but well below the 70 overbought level, suggesting momentum is present without being extended."

Incorrect AI output (rejected):
> "RSI is overbought at 73." ← Wrong number, wrong classification.
> "RSI is bullish, suggesting a move toward 120k is likely." ← Price prediction.
> "RSI shows we should expect a strong rally." ← Financial implication.

---

*Last updated: project initialization*
*Next update: when Module 9 (AI Writing Engine) implementation begins*
