// SOURCE: harness@9b67e8012e531063cdfabebe57f62b661ba154aa src/telegram-core/chunker.ts (synced 2026-04-24)
/**
 * Chunker — pure state machine for streaming text to Telegram as
 * paragraph-sized bubbles. boundary() and flush() bypass the interval gate;
 * flush() additionally bypasses balance.
 */
export interface ChunkerOpts {
  minIntervalMs?: number;
  now?: () => number;
}

export class Chunker {
  private buffer = '';
  // -Infinity so the very first push can emit without waiting for an interval.
  private lastFlushAt = -Infinity;
  private readonly minIntervalMs: number;
  private readonly now: () => number;

  constructor(opts: ChunkerOpts = {}) {
    this.minIntervalMs = opts.minIntervalMs ?? 3000;
    this.now = opts.now ?? Date.now;
  }

  push(delta: string): string[] {
    if (delta) this.buffer += delta;
    return this.emitIfReady({ forceInterval: false, forceBalance: false });
  }

  boundary(): string[] {
    if (this.buffer.length === 0) return [];
    this.buffer += '\n\n';
    return this.emitIfReady({ forceInterval: true, forceBalance: true });
  }

  flush(): string[] {
    if (this.buffer.length === 0) return [];
    const chunk = this.buffer.trim();
    this.buffer = '';
    this.lastFlushAt = this.now();
    return chunk.length > 0 ? [chunk] : [];
  }

  private emitIfReady(opts: {
    forceInterval: boolean;
    forceBalance: boolean;
  }): string[] {
    if (
      !opts.forceInterval &&
      this.now() - this.lastFlushAt < this.minIntervalMs
    ) {
      return [];
    }
    // Walk paragraph boundaries from latest to earliest; flush at the
    // latest boundary that is not inside an unclosed markdown construct
    // (unless forceBalance bypasses the check). This is per-boundary —
    // an unclosed construct in a trailing paragraph does not block earlier
    // clean paragraphs from emitting.
    let searchFrom = this.buffer.length;
    while (true) {
      const idx = this.buffer.lastIndexOf('\n\n', searchFrom);
      if (idx < 0) return [];
      if (opts.forceBalance || isBalanced(this.buffer.slice(0, idx))) {
        const chunk = this.buffer.slice(0, idx).trim();
        if (chunk.length === 0) return [];
        this.buffer = this.buffer.slice(idx + 2);
        this.lastFlushAt = this.now();
        return [chunk];
      }
      // Move the search window strictly earlier so we don't infinite-loop
      // on the same position.
      searchFrom = idx - 1;
      if (searchFrom < 0) return [];
    }
  }
}

/**
 * Returns true iff every markdown construct we track is closed at the
 * end of `text`. Constructs: triple-backtick fence, single-backtick inline
 * code, **bold**, *italic*, _italic_, ~strike~, ||spoiler||, [link](url).
 *
 * This scanner is intentionally conservative — it prefers "hold the
 * buffer" over "emit something that might render wrong." Edge cases
 * around escaped characters are not handled; the markdown translator's
 * plain-text fallback catches anything we miss.
 */
function isBalanced(text: string): boolean {
  let i = 0;
  let inFence = false;
  let inInlineCode = false;
  let inBold = false;
  let inItalicStar = false;
  let inItalicUnd = false;
  let inStrike = false;
  let inSpoiler = false;
  // Link state: 0=outside, 1=inside [text], 2=after ](, expecting )
  let linkState: 0 | 1 | 2 = 0;

  while (i < text.length) {
    const ch = text[i];
    const next2 = text.slice(i, i + 2);
    const next3 = text.slice(i, i + 3);

    // Triple-backtick fences take precedence — everything inside is literal
    if (next3 === '```') {
      inFence = !inFence;
      i += 3;
      continue;
    }
    if (inFence) {
      i += 1;
      continue;
    }

    // Inline code
    if (ch === '`') {
      inInlineCode = !inInlineCode;
      i += 1;
      continue;
    }
    if (inInlineCode) {
      i += 1;
      continue;
    }

    // Bold ** before italic * (longest match wins)
    if (next2 === '**') {
      inBold = !inBold;
      i += 2;
      continue;
    }
    if (ch === '*') {
      inItalicStar = !inItalicStar;
      i += 1;
      continue;
    }
    if (ch === '_') {
      inItalicUnd = !inItalicUnd;
      i += 1;
      continue;
    }

    // Spoiler || before strike ~
    if (next2 === '||') {
      inSpoiler = !inSpoiler;
      i += 2;
      continue;
    }
    if (ch === '~') {
      inStrike = !inStrike;
      i += 1;
      continue;
    }

    // Links
    if (ch === '[' && linkState === 0) {
      linkState = 1;
      i += 1;
      continue;
    }
    if (next2 === '](' && linkState === 1) {
      linkState = 2;
      i += 2;
      continue;
    }
    if (ch === ']' && linkState === 1) {
      // Stray `]` without `(` — not a markdown link, just a bracket.
      // Reset linkState so `[N]` footnotes and bracket lists don't trap
      // the scanner.
      linkState = 0;
      i += 1;
      continue;
    }
    if (ch === ')' && linkState === 2) {
      linkState = 0;
      i += 1;
      continue;
    }

    i += 1;
  }

  return (
    !inFence &&
    !inInlineCode &&
    !inBold &&
    !inItalicStar &&
    !inItalicUnd &&
    !inStrike &&
    !inSpoiler &&
    linkState === 0
  );
}
