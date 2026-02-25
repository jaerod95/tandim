import { useCallContext } from "./CallContext";

function CallHeader() {
  const { currentCall, isLoading, error } = useCallContext();

  if (isLoading) {
    return <header>Connecting to call...</header>;
  }

  if (error) {
    return <header>{error}</header>;
  }

  return <header>{currentCall?.roomId ?? "Call"}</header>;
}

export default CallHeader;
