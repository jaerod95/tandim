import { useCallContext } from "./CallContext";

function CallFooter() {
  const { currentCall } = useCallContext();
  return <footer>{currentCall?.displayName ?? "You"}</footer>;
}

export default CallFooter;
