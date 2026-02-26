import { useCallback, useEffect, useRef, useState } from "react";

export type RoomDefinition = {
  id: string;
  name: string;
  emoji: string;
  order: number;
};

type UseRoomDefinitionsOptions = {
  apiUrl: string;
  pollIntervalMs?: number;
};

type UseRoomDefinitionsReturn = {
  rooms: RoomDefinition[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useRoomDefinitions({
  apiUrl,
  pollIntervalMs = 30_000,
}: UseRoomDefinitionsOptions): UseRoomDefinitionsReturn {
  const [rooms, setRooms] = useState<RoomDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/room-definitions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRooms(data.rooms);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rooms");
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Initial fetch
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchRooms();
    }
  }, [fetchRooms]);

  // Polling
  useEffect(() => {
    const id = setInterval(fetchRooms, pollIntervalMs);
    return () => clearInterval(id);
  }, [fetchRooms, pollIntervalMs]);

  return { rooms, loading, error, refetch: fetchRooms };
}
