import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const matterStyles = readFileSync(
  new URL('./matter-workbench.css', import.meta.url),
  'utf8',
);
const terminalStyles = readFileSync(
  new URL('./terminal-theme.css', import.meta.url),
  'utf8',
);

function tokenValue(block: string, token: string) {
  const match = block.match(new RegExp(`${token}:\\s*([^;]+);`));
  if (!match) throw new Error(`Missing ${token}`);
  return match[1]!.trim();
}

function rgb(hex: string) {
  const raw = hex.replace('#', '');
  const normalized =
    raw.length === 3
      ? [...raw].map((channel) => `${channel}${channel}`).join('')
      : raw;
  return [0, 2, 4].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255,
  );
}

function luminance(hex: string) {
  const channels = rgb(hex).map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

function classicBlock(mode: 'light' | 'dark') {
  const start =
    mode === 'dark'
      ? matterStyles.indexOf(".thread-ui-shell.thread-ui-shell[data-theme-effective='dark']")
      : matterStyles.indexOf('.thread-ui-shell.thread-ui-shell,');
  const end = matterStyles.indexOf('\n}', start);
  if (start < 0 || end < 0) throw new Error(`Missing Classic ${mode} tokens`);
  return matterStyles.slice(start, end);
}

describe('Classic workbench palette', () => {
  it('uses neutral actions and reference-based focus accents in both modes', () => {
    const light = classicBlock('light');
    const dark = classicBlock('dark');

    expect(tokenValue(light, '--thread-gc-primary')).toBe('#171717');
    expect(tokenValue(light, '--thread-gc-focus-ring')).toBe('#28377a');
    expect(tokenValue(dark, '--thread-gc-primary')).toBe('#f0f1f5');
    expect(tokenValue(dark, '--thread-gc-primary-fg')).toBe('#0a0f1f');
    expect(tokenValue(dark, '--thread-gc-focus-ring')).toBe('#e64c7f');
    expect(light + dark).not.toMatch(/#00a764|#00cc76|#008b53|#007a49/i);
  });

  it('keeps text, action labels, accent and focus contrast above their targets', () => {
    const light = classicBlock('light');
    const dark = classicBlock('dark');

    expect(
      contrast(
        tokenValue(light, '--thread-gc-fg-muted'),
        tokenValue(light, '--thread-gc-bg'),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        tokenValue(light, '--thread-gc-fg-muted'),
        '#f5f5f5',
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        tokenValue(light, '--thread-gc-primary-fg'),
        tokenValue(light, '--thread-gc-primary'),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        tokenValue(light, '--thread-gc-accent-strong'),
        tokenValue(light, '--thread-gc-bg'),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        tokenValue(dark, '--thread-gc-fg-muted'),
        tokenValue(dark, '--thread-gc-bg'),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        tokenValue(dark, '--thread-gc-primary-fg'),
        tokenValue(dark, '--thread-gc-primary'),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        tokenValue(dark, '--thread-gc-accent-strong'),
        tokenValue(dark, '--thread-gc-bg'),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        tokenValue(dark, '--thread-gc-accent-strong'),
        tokenValue(dark, '--thread-gc-workspace'),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps Terminal phosphor green and ink-blue focus independent', () => {
    expect(terminalStyles).toContain('--theme-focus-ring: #4de3a2');
    expect(terminalStyles).toContain('--theme-focus-ring: #0a47c4');
    expect(terminalStyles).toContain('--theme-accent-solid: #4de3a2');
  });
});
