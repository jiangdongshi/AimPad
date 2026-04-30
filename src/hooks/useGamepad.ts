import { useEffect, useRef, useState, useCallback } from 'react';
import { GamepadAdapter } from '@/game/input/GamepadAdapter';
import type { GamepadState } from '@/game/input/GamepadAdapter';

export function useGamepad(deadzone = 0.1) {
  const adapterRef = useRef<GamepadAdapter | null>(null);
  const [state, setState] = useState<GamepadState>({
    connected: false,
    type: 'unknown',
    id: '',
    leftStick: { x: 0, y: 0 },
    rightStick: { x: 0, y: 0 },
    buttons: {},
  });

  useEffect(() => {
    adapterRef.current = new GamepadAdapter(deadzone);

    const handleConnect = (e: GamepadEvent) => {
      console.log('Gamepad connected:', e.gamepad.id);
    };

    const handleDisconnect = () => {
      setState(prev => ({ ...prev, connected: false }));
    };

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);

    // 每帧轮询手柄状态
    let animationId: number;
    const poll = () => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (gp && adapterRef.current) {
          setState(adapterRef.current.update(gp));
          break;
        }
      }
      animationId = requestAnimationFrame(poll);
    };
    animationId = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
      cancelAnimationFrame(animationId);
    };
  }, [deadzone]);

  const setDeadzone = useCallback((value: number) => {
    adapterRef.current?.setDeadzone(value);
  }, []);

  return { ...state, setDeadzone };
}
