/**
 * 输入平滑器 - 用于平滑手柄摇杆输入
 * 通过缓冲区对连续输入值进行平均，减少抖动
 */
export class InputSmoother {
  private buffer: number[] = [];
  private bufferSize: number;

  constructor(bufferSize = 3) {
    this.bufferSize = bufferSize;
  }

  smooth(value: number): number {
    this.buffer.push(value);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
    return this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length;
  }

  reset() {
    this.buffer = [];
  }

  setBufferSize(size: number) {
    this.bufferSize = Math.max(1, Math.min(10, size));
  }
}

/**
 * 2D 向量输入平滑器
 */
export class VectorSmoother {
  private xSmoother: InputSmoother;
  private ySmoother: InputSmoother;

  constructor(bufferSize = 3) {
    this.xSmoother = new InputSmoother(bufferSize);
    this.ySmoother = new InputSmoother(bufferSize);
  }

  smooth(x: number, y: number): { x: number; y: number } {
    return {
      x: this.xSmoother.smooth(x),
      y: this.ySmoother.smooth(y),
    };
  }

  reset() {
    this.xSmoother.reset();
    this.ySmoother.reset();
  }
}
