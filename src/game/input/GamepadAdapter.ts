import { detectGamepadType, getButtonMapping } from '@/utils/gamepadMap';
import type { GamepadType, ButtonMapping } from '@/types/gamepad';

export interface GamepadState {
  connected: boolean;
  type: GamepadType;
  id: string;
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  buttons: Record<string, { pressed: boolean; value: number }>;
}

const DEFAULT_DEADZONE = 0.1;

export class GamepadAdapter {
  private state: GamepadState;
  private leftDeadzone: number;
  private rightDeadzone: number;
  private mapping: ButtonMapping | null = null;

  constructor(leftDeadzone = DEFAULT_DEADZONE, rightDeadzone = DEFAULT_DEADZONE) {
    this.leftDeadzone = leftDeadzone;
    this.rightDeadzone = rightDeadzone;
    this.state = {
      connected: false,
      type: 'unknown',
      id: '',
      leftStick: { x: 0, y: 0 },
      rightStick: { x: 0, y: 0 },
      buttons: {},
    };
  }

  update(gamepad: Gamepad | null): GamepadState {
    if (!gamepad) {
      const prev = this.state;
      this.state = { ...prev, connected: false };
      return this.state;
    }

    if (!this.mapping || this.state.id !== gamepad.id) {
      this.mapping = getButtonMapping(gamepad);
    }

    // 更新摇杆状态（左右摇杆各自独立死区）
    const leftStick = this.applyDeadzone({
      x: gamepad.axes[0] || 0,
      y: gamepad.axes[1] || 0,
    }, this.leftDeadzone);
    const rightStick = this.applyDeadzone({
      x: gamepad.axes[2] || 0,
      y: gamepad.axes[3] || 0,
    }, this.rightDeadzone);

    // 更新按钮状态
    const buttons: Record<string, { pressed: boolean; value: number }> = {};
    gamepad.buttons.forEach((button, index) => {
      buttons[index] = {
        pressed: button.pressed,
        value: button.value,
      };
    });

    this.state = {
      connected: true,
      type: detectGamepadType(gamepad),
      id: gamepad.id,
      leftStick,
      rightStick,
      buttons,
    };
    return this.state;
  }

  private applyDeadzone(stick: { x: number; y: number }, deadzone: number) {
    const magnitude = Math.sqrt(stick.x ** 2 + stick.y ** 2);
    if (magnitude < deadzone) {
      return { x: 0, y: 0 };
    }
    // 重新映射以保持平滑过渡
    const scale = (magnitude - deadzone) / (1 - deadzone);
    return {
      x: (stick.x / magnitude) * scale,
      y: (stick.y / magnitude) * scale,
    };
  }

  getState(): GamepadState {
    return { ...this.state };
  }

  setLeftDeadzone(value: number) {
    this.leftDeadzone = Math.max(0, Math.min(0.5, value));
  }

  setRightDeadzone(value: number) {
    this.rightDeadzone = Math.max(0, Math.min(0.5, value));
  }
}
