import { Router } from "express";
import { getIceConfigFromEnv } from "../services/iceConfig";
import type { RoomStateStore } from "../services/roomState";
import slackRouter from "./slack";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "api"
  });
});

router.get("/ice-config", (_req, res) => {
  res.json(getIceConfigFromEnv(process.env));
});

router.use("/slack", slackRouter);

export default router;

/**
 * Create additional API routes that require server context.
 * Mounted by the entrypoint after the signal server is created.
 */
export function createRoomsRouter(roomStateStore: RoomStateStore): Router {
  const roomsRouter = Router();

  roomsRouter.get("/", (_req, res) => {
    const rooms = roomStateStore.getAllRooms();
    res.json({ rooms });
  });

  roomsRouter.get("/:workspaceId/:roomId", (req, res) => {
    const { workspaceId, roomId } = req.params;
    const details = roomStateStore.getRoomDetails(workspaceId, roomId);

    if (!details) {
      res.json({ peers: [], activeScreenSharerUserId: null, crosstalks: [] });
      return;
    }

    res.json({
      peers: details.peers.map((p) => ({ userId: p.userId, displayName: p.displayName })),
      activeScreenSharerUserId: details.activeScreenSharerUserId,
      crosstalks: details.crosstalks.map((ct) => ({
        id: ct.id,
        initiatorUserId: ct.initiatorUserId,
        participantUserIds: Array.from(ct.participantUserIds),
      })),
    });
  });

  return roomsRouter;
}
