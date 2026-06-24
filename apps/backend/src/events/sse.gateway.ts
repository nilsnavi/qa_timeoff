import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Response } from 'express';
import { EventBusService } from './event-bus.service';

const MAX_CLIENTS_PER_USER = 3;
const MAX_TOTAL_CLIENTS = 1000;

interface SseClient {
  id: string;
  response: Response;
  userId: string;
  teamId?: string;
}

@Injectable()
export class SseGateway implements OnModuleInit, OnModuleDestroy {
  private clients = new Map<string, SseClient>();
  private readonly bridgeListener: (payload: unknown) => void;

  constructor(private readonly eventBus: EventBusService) {
    this.bridgeListener = (payload: unknown) => this.broadcast(payload);
  }

  onModuleInit() {
    this.eventBus.on('leave-request.created', this.bridgeListener);
    this.eventBus.on('leave-request.approved', this.bridgeListener);
    this.eventBus.on('leave-request.rejected', this.bridgeListener);
    this.eventBus.on('calendar-event.created', this.bridgeListener);
    this.eventBus.on('calendar-event.updated', this.bridgeListener);
    this.eventBus.on('calendar-event.deleted', this.bridgeListener);
    this.eventBus.on('calendar-event.approved', this.bridgeListener);
  }

  onModuleDestroy() {
    this.eventBus.off('leave-request.created', this.bridgeListener);
    this.eventBus.off('leave-request.approved', this.bridgeListener);
    this.eventBus.off('leave-request.rejected', this.bridgeListener);
    this.eventBus.off('calendar-event.created', this.bridgeListener);
    this.eventBus.off('calendar-event.updated', this.bridgeListener);
    this.eventBus.off('calendar-event.deleted', this.bridgeListener);
    this.eventBus.off('calendar-event.approved', this.bridgeListener);
    for (const client of this.clients.values()) {
      client.response.end();
    }
    this.clients.clear();
  }

  canAcceptClient(userId: string): boolean {
    if (this.clients.size >= MAX_TOTAL_CLIENTS) return false;
    const userCount = Array.from(this.clients.values()).filter((c) => c.userId === userId).length;
    return userCount < MAX_CLIENTS_PER_USER;
  }

  addClient(client: SseClient) {
    this.clients.set(client.id, client);
    client.response.on('close', () => {
      this.clients.delete(client.id);
    });
  }

  removeClient(id: string) {
    this.clients.delete(id);
  }

  private broadcast(payload: unknown) {
    const event = payload as { userId?: string; teamId?: string | null };
    if (!event) return;

    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients.values()) {
      if (event.userId === client.userId) {
        this.tryWrite(client, data);
        continue;
      }
      if (event.teamId && event.teamId === client.teamId) {
        this.tryWrite(client, data);
        continue;
      }
    }
  }

  private tryWrite(client: SseClient, data: string) {
    try {
      client.response.write(data);
    } catch {
      this.clients.delete(client.id);
    }
  }
}
