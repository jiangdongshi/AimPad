import { Color3, Color4 } from '@babylonjs/core';

function getCSSVariable(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return [
    parseInt(match[1], 16) / 255,
    parseInt(match[2], 16) / 255,
    parseInt(match[3], 16) / 255,
  ];
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const FALLBACK_BG: [number, number, number] = [0.04, 0.04, 0.06];

function readBgRgb(): [number, number, number] {
  const bg = getCSSVariable('--color-bg-primary');
  return hexToRgb(bg) ?? FALLBACK_BG;
}

// --- Public API ---

export function getSceneBackgroundRgb(): [number, number, number] {
  return readBgRgb();
}

export function getSceneClearColor(): Color4 {
  const [r, g, b] = readBgRgb();
  return new Color4(r, g, b, 1);
}

/** Ground: slightly lighter than background, low specular */
export function getSceneGroundColor(): Color3 {
  const [r, g, b] = readBgRgb();
  const isLight = luminance(r, g, b) > 0.4;
  const offset = isLight ? -0.04 : 0.05;
  return new Color3(clamp(r + offset), clamp(g + offset), clamp(b + offset));
}

/** Wall: slightly lighter than ground */
export function getSceneWallColor(): Color3 {
  const [r, g, b] = readBgRgb();
  const isLight = luminance(r, g, b) > 0.4;
  const offset = isLight ? -0.02 : 0.07;
  return new Color3(clamp(r + offset), clamp(g + offset), clamp(b + offset));
}

/** Grid/guide lines: contrast against background, min difference 0.1 */
export function getSceneGridColor(): Color3 {
  const [r, g, b] = readBgRgb();
  const isLight = luminance(r, g, b) > 0.4;
  const offset = isLight ? -0.12 : 0.1;
  const cr = clamp(r + offset);
  const cg = clamp(g + offset);
  const cb = clamp(b + offset);
  if (Math.abs(cr - r) < 0.06) return new Color3(r > 0.5 ? r - 0.1 : r + 0.1, g > 0.5 ? g - 0.1 : g + 0.1, b > 0.5 ? b - 0.1 : b + 0.1);
  return new Color3(cr, cg, cb);
}

/** HUD background: opaque, derived from scene bg with good contrast */
export function getSceneHudBg(): string {
  const [r, g, b] = readBgRgb();
  const isLight = luminance(r, g, b) > 0.4;
  if (isLight) {
    return `rgb(${Math.round((r - 0.08) * 255)}, ${Math.round((g - 0.08) * 255)}, ${Math.round((b - 0.08) * 255)})`;
  }
  return `rgb(${Math.round((r + 0.06) * 255)}, ${Math.round((g + 0.06) * 255)}, ${Math.round((b + 0.06) * 255)})`;
}
