import type { GamepadType, ButtonMapping } from '@/types/gamepad';

const GAMEPAD_MAPPINGS: Record<GamepadType, ButtonMapping> = {
  xbox: {
    A: 0, B: 1, X: 2, Y: 3,
    LB: 4, RB: 5, LT: 6, RT: 7,
    Select: 8, Start: 9, LS: 10, RS: 11,
    DPadUp: 12, DPadDown: 13, DPadLeft: 14, DPadRight: 15,
  },
  playstation: {
    A: 0, B: 1, X: 2, Y: 3,    // Cross, Circle, Square, Triangle
    LB: 4, RB: 5, LT: 6, RT: 7, // L1, R1, L2, R2
    Select: 8, Start: 9, LS: 10, RS: 11,
    DPadUp: 12, DPadDown: 13, DPadLeft: 14, DPadRight: 15,
  },
  switch: {
    A: 1, B: 0, X: 3, Y: 2,    // Nintendo 布局交换
    LB: 4, RB: 5, LT: 6, RT: 7,
    Select: 8, Start: 9, LS: 10, RS: 11,
    DPadUp: 12, DPadDown: 13, DPadLeft: 14, DPadRight: 15,
  },
  unknown: {
    A: 0, B: 1, X: 2, Y: 3,
    LB: 4, RB: 5, LT: 6, RT: 7,
    Select: 8, Start: 9, LS: 10, RS: 11,
    DPadUp: 12, DPadDown: 13, DPadLeft: 14, DPadRight: 15,
  },
};

export function detectGamepadType(gamepad: Gamepad): GamepadType {
  const id = gamepad.id.toLowerCase();
  if (id.includes('xbox') || id.includes('xinput')) return 'xbox';
  if (id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense')) return 'playstation';
  if (id.includes('switch') || id.includes('pro controller')) return 'switch';
  return 'unknown';
}

export function getButtonMapping(gamepad: Gamepad): ButtonMapping {
  const type = detectGamepadType(gamepad);
  return GAMEPAD_MAPPINGS[type];
}

export function getButtonIndex(gamepad: Gamepad, buttonName: keyof ButtonMapping): number {
  const mapping = getButtonMapping(gamepad);
  return mapping[buttonName];
}
