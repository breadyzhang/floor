'use client';

type Listener<T> = (payload: T, envelope: MessageEnvelope<T>) => void;

interface MessageEnvelope<T> {
  type: string;
  payload: T;
  sourceId: string;
  timestamp: number;
}

interface ChannelHandle<T> {
  publish: (type: string, payload: T) => void;
  subscribe: (type: string, listener: Listener<T>) => () => void;
  destroy: () => void;
}

const channelName = "floor-round-sync";

let channelInstance: BroadcastChannel | null = null;
const listenersByType = new Map<
  string,
  Set<(payload: unknown, envelope: MessageEnvelope<unknown>) => void>
>();

const getChannel = () => {
  if (typeof window === "undefined") {
    return null;
  }
  if (!channelInstance) {
    channelInstance = new BroadcastChannel(channelName);
    channelInstance.onmessage = (event) => {
      const message = event.data as MessageEnvelope<unknown>;
      const listeners = listenersByType.get(message.type);
      if (!listeners || listeners.size === 0) {
        return;
      }
      listeners.forEach((listener) => {
        try {
          listener(message.payload, message);
        } catch (error) {
          console.error("Broadcast listener error", error);
        }
      });
    };
  }
  return channelInstance;
};

const localSourceId =
  typeof window === "undefined"
    ? "server"
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const createBroadcastHandle = <T,>(): ChannelHandle<T> => {
  const publish = (type: string, payload: T) => {
    const channel = getChannel();
    if (!channel) {
      return;
    }
    const envelope: MessageEnvelope<T> = {
      type,
      payload,
      sourceId: localSourceId,
      timestamp: Date.now(),
    };
    channel.postMessage(envelope);
  };

  const subscribe = (type: string, listener: Listener<T>) => {
    const listeners =
      listenersByType.get(type) ??
      new Set<(payload: unknown, envelope: MessageEnvelope<unknown>) => void>();
    listeners.add(listener as (payload: unknown, envelope: MessageEnvelope<unknown>) => void);
    listenersByType.set(type, listeners);

    return () => {
      const set = listenersByType.get(type);
      if (!set) {
        return;
      }
      set.delete(listener as Listener<unknown>);
      if (set.size === 0) {
        listenersByType.delete(type);
      }
    };
  };

  const destroy = () => {
    if (channelInstance) {
      channelInstance.close();
      channelInstance = null;
    }
    listenersByType.clear();
  };

  return { publish, subscribe, destroy };
};

export const isFromLocalSource = (sourceId: string) => sourceId === localSourceId;
