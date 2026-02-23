type TandimBridge = {
  getPendingRoom: () => Promise<string | null>;
  onDeepLinkRoom: (handler: (roomId: string) => void) => void;
};

declare global {
  interface Window {
    tandem?: TandimBridge;
  }
}

export {};
