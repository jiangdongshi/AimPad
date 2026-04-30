import { GamepadAdapter } from './GamepadAdapter';

export interface InputState {
  // 视角控制
  lookX: number;   // -1 到 1
  lookY: number;   // -1 到 1
  // 射击
  shoot: boolean;
  shootPressed: boolean;  // 单次按下检测
  // 移动
  moveX: number;   // -1 到 1
  moveY: number;   // -1 到 1
  // 动作
  reload: boolean;
  pause: boolean;
}

export class InputManager {
  private gamepadAdapter: GamepadAdapter;
  private mouseState = { x: 0, y: 0, shoot: false, lastShoot: false };
  private currentState: InputState;
  private useGamepad: boolean = false;

  constructor() {
    this.gamepadAdapter = new GamepadAdapter();
    this.currentState = this.getEmptyState();
    this.setupMouseListeners();
  }

  private getEmptyState(): InputState {
    return {
      lookX: 0, lookY: 0,
      shoot: false, shootPressed: false,
      moveX: 0, moveY: 0,
      reload: false, pause: false,
    };
  }

  private setupMouseListeners() {
    window.addEventListener('mousemove', (e) => {
      this.mouseState.x = e.movementX / 100;
      this.mouseState.y = e.movementY / 100;
    });
    window.addEventListener('mousedown', () => {
      this.mouseState.shoot = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouseState.shoot = false;
    });
  }

  update(): InputState {
    const gamepads = navigator.getGamepads();
    let gp: Gamepad | null = null;
    for (const g of gamepads) {
      if (g) { gp = g; break; }
    }

    if (gp) {
      this.useGamepad = true;
      const gpState = this.gamepadAdapter.update(gp);
      const prevShoot = this.currentState.shoot;

      this.currentState = {
        lookX: gpState.rightStick.x,
        lookY: gpState.rightStick.y,
        shoot: gpState.buttons[7]?.pressed || gpState.buttons[0]?.pressed || false,
        shootPressed: false,
        moveX: gpState.leftStick.x,
        moveY: gpState.leftStick.y,
        reload: gpState.buttons[2]?.pressed || false, // X/Square
        pause: gpState.buttons[9]?.pressed || false,  // Start
      };

      this.currentState.shootPressed = this.currentState.shoot && !prevShoot;
    } else {
      this.useGamepad = false;
      const prevShoot = this.currentState.shoot;
      this.currentState = {
        lookX: this.mouseState.x,
        lookY: this.mouseState.y,
        shoot: this.mouseState.shoot,
        shootPressed: this.mouseState.shoot && !prevShoot,
        moveX: 0,
        moveY: 0,
        reload: false,
        pause: false,
      };
      // 重置鼠标增量
      this.mouseState.x = 0;
      this.mouseState.y = 0;
    }

    return this.currentState;
  }

  isUsingGamepad(): boolean {
    return this.useGamepad;
  }

  dispose() {
    // 清理事件监听
  }
}
