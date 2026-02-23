type TandimBridge = {
  getPendingRoom: () => Promise<string | null>;
  onDeepLinkRoom: (handler: (roomId: string) => void) => void;
  openCallWindow: (payload: {
    apiUrl: string;
    workspaceId: string;
    roomId: string;
    displayName: string;
    userId: string;
  }) => Promise<{ sessionId: string }>;
  getCallSession: (
    sessionId: string
  ) => Promise<{ apiUrl: string; workspaceId: string; roomId: string; displayName: string; userId: string } | null>;
};

declare global {
  interface Window {
    tandem?: TandimBridge;
  }
}

export {};
