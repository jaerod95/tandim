import React from "react";
import { createRoot } from "react-dom/client";
import { CallApp } from "./renderer/CallApp";
import { LobbyApp } from "./renderer/Lobby/LobbyApp";
import "./styles/globals.css";

const mount = document.getElementById("root");
if (!mount) {
  throw new Error("Missing root container");
}

const mode = window.location.hash.startsWith("#call") ? "call" : "lobby";
createRoot(mount).render(mode === "call" ? <CallApp /> : <LobbyApp />);
