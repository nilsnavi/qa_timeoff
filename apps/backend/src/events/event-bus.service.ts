import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class EventBusService {
  private readonly emitter = new EventEmitter();
  private readonly maxListeners = 50;

  constructor() {
    this.emitter.setMaxListeners(this.maxListeners);
  }

  emit(event: string, payload: unknown): void {
    this.emitter.emit(event, payload);
  }

  on(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.on(event, listener);
  }

  off(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.off(event, listener);
  }

  once(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.once(event, listener);
  }
}
