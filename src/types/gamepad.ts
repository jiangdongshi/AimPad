export type GamepadType = 'xbox' | 'playstation' | 'switch' | 'unknown';

export interface ButtonMapping {
  A: number;
  B: number;
  X: number;
  Y: number;
  LB: number;
  RB: number;
  LT: number;
  RT: number;
  LS: number;
  RS: number;
  Start: number;
  Select: number;
  DPadUp: number;
  DPadDown: number;
  DPadLeft: number;
  DPadRight: number;
}
