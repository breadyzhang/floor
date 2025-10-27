'use client';

import { useEffect } from "react";
import {
  getRoundSnapshot,
  selectRoundSnapshot,
  useRoundStore,
  type RoundSnapshot,
} from "@/state/roundStore";
import {
  createBroadcastHandle,
  isFromLocalSource,
} from "@/utils/broadcastChannel";

type SnapshotMessage = {
  snapshot: RoundSnapshot;
};

type SyncMode = "host" | "stage";

const SNAPSHOT_EVENT = "round/snapshot";
const REQUEST_EVENT = "round/request";

const channelHandle = createBroadcastHandle<SnapshotMessage | null>();

export const useRoundSync = (mode: SyncMode) => {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyingRef = { current: false };
    const { publish, subscribe } = channelHandle;

    const unsubscribeSnapshot = subscribe(
      SNAPSHOT_EVENT,
      (payload, envelope) => {
        if (!payload || isFromLocalSource(envelope.sourceId)) {
          return;
        }
        applyingRef.current = true;
        const incomingSnapshot =
          mode === "stage"
            ? payload.snapshot
            : payload.snapshot;
        useRoundStore.getState().hydrateFromSnapshot(incomingSnapshot);
        applyingRef.current = false;
      }
    );

    const unsubscribeRequest = subscribe(
      REQUEST_EVENT,
      (_payload, envelope) => {
        if (mode !== "host" || isFromLocalSource(envelope.sourceId)) {
          return;
        }
        publish(SNAPSHOT_EVENT, { snapshot: getRoundSnapshot() });
      }
    );

    let unsubscribeStore: (() => void) | undefined;
    if (mode === "host") {
      unsubscribeStore = useRoundStore.subscribe((state) => {
        if (applyingRef.current) {
          return;
        }
        publish(SNAPSHOT_EVENT, { snapshot: selectRoundSnapshot(state) });
      });
      publish(SNAPSHOT_EVENT, { snapshot: getRoundSnapshot() });
    } else {
      // ask the host for the latest snapshot
      publish(REQUEST_EVENT, null);
    }

    return () => {
      unsubscribeSnapshot();
      unsubscribeRequest();
      unsubscribeStore?.();
    };
  }, [mode]);
};
