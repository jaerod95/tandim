// import React, { useEffect, useState } from "react";
// import type { CallSession } from "../types";
// import { ROOMS } from "../types";
import { AppSidebar } from "@/renderer/Lobby/LobbySidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export function LobbyApp() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties
          }
        >
          <AppSidebar variant="inset" />
          <SidebarInset>
            <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
              <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mx-2" />
                <h1 className="text-base font-medium">Documents</h1>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="ghost"
                    asChild
                    size="sm"
                    className="hidden sm:flex"
                  >
                    <a
                      href="https://github.com/shadcn-ui/ui/tree/main/apps/v4/app/(examples)/dashboard"
                      rel="noopener noreferrer"
                      target="_blank"
                      className="dark:text-foreground"
                    >
                      GitHub
                    </a>
                  </Button>
                </div>
              </div>
            </header>
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                  <p>Content goes here</p>
                </div>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

// const [apiUrl, setApiUrl] = useState("http://localhost:3000");
// const [workspaceId, setWorkspaceId] = useState("team-local");
// const [displayName, setDisplayName] = useState("Jrod");
// const [selectedRoom, setSelectedRoom] = useState<string | null>(
//   "Team Standup",
// );
// const [status, setStatus] = useState("");
// const [showRoomPanel, setShowRoomPanel] = useState(false);

// useEffect(() => {
//   window.tandem?.getPendingRoom().then((pending) => {
//     if (pending) {
//       setSelectedRoom(pending);
//       setShowRoomPanel(true);
//     }
//   });
//   window.tandem?.onDeepLinkRoom((nextRoom) => {
//     setSelectedRoom(nextRoom);
//     setShowRoomPanel(true);
//     setStatus(`Loaded deep link room ${nextRoom}`);
//   });
// }, []);

// async function joinRoom(audioEnabled = true): Promise<void> {
//   if (!selectedRoom) return;

//   const payload: CallSession = {
//     apiUrl: apiUrl.trim(),
//     workspaceId: workspaceId.trim(),
//     roomId: selectedRoom,
//     displayName: displayName.trim() || "Engineer",
//     userId: `u-${Math.random().toString(36).slice(2, 8)}`,
//   };

//   try {
//     await window.tandem?.openCallWindow(payload);
//     setStatus(
//       audioEnabled
//         ? `Joined ${selectedRoom}`
//         : `Listening to ${selectedRoom}`,
//     );
//   } catch (error) {
//     const message = (error as Error).message || "unknown error";
//     if (message.includes("No handler registered")) {
//       setStatus("Main process is stale; restart the desktop app once.");
//     } else {
//       setStatus(`Failed to open call: ${message}`);
//     }
//   }
// }

// function selectRoom(roomName: string) {
//   setSelectedRoom(roomName);
//   setShowRoomPanel(true);
// }

// const selectedRoomObj = ROOMS.find((r) => r.name === selectedRoom);

// return (
//   <main className="tandem-shell">
//     <section className={`lobby ${showRoomPanel ? "with-panel" : ""}`}>
//       {/* Left Sidebar - Rooms */}
//       <aside className="rooms-col">
//         <div className="section-block">
//           <div className="section-header">
//             <span>MY MEETINGS</span>
//             <button className="small-icon-btn" title="Calendar">
//               <svg
//                 width="14"
//                 height="14"
//                 viewBox="0 0 16 16"
//                 fill="currentColor"
//               >
//                 <path d="M4 0a1 1 0 011 1v1h6V1a1 1 0 112 0v1h1a2 2 0 012 2v10a2 2 0 01-2 2H2a2 2 0 01-2-2V4a2 2 0 012-2h1V1a1 1 0 011-1zM2 6v8h12V6H2z" />
//               </svg>
//             </button>
//             <button className="small-icon-btn" title="New Meeting">
//               +
//             </button>
//           </div>
//           <div className="no-meetings">No more meetings today 🤘</div>
//         </div>

//         <div className="section-block">
//           <div className="section-header">
//             <span>ROOMS</span>
//             <button className="small-icon-btn" title="Add Room">
//               +
//             </button>
//           </div>
//           <ul className="rooms-list">
//             {ROOMS.map((room) => (
//               <li
//                 key={room.name}
//                 className={room.name === selectedRoom ? "active" : ""}
//                 onClick={() => selectRoom(room.name)}
//               >
//                 <span className="room-icon">🔊</span>
//                 <span className="room-emoji">{room.emoji}</span>
//                 <span className="room-name">{room.name}</span>
//                 {room.name === selectedRoom ? (
//                   <button
//                     className="join-inline"
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       void joinRoom();
//                     }}
//                   >
//                     Join
//                   </button>
//                 ) : null}
//               </li>
//             ))}
//           </ul>
//         </div>
//       </aside>

//       {/* Center Panel - Team */}
//       <section className="team-col">
//         <div className="section-header">
//           <span>TEAM</span>
//           <button className="small-icon-btn" title="More options">
//             •••
//           </button>
//           <button className="small-icon-btn" title="Add Member">
//             +
//           </button>
//         </div>

//         <div className="team-list">
//           <div className="team-member you">
//             <img
//               src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jrod"
//               alt="Jrod"
//               className="member-avatar"
//             />
//             <div className="member-info">
//               <div className="member-name">
//                 {displayName} <span className="you-badge">(you)</span>
//               </div>
//             </div>
//           </div>
//           <div className="team-member offline">
//             <img
//               src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jordin"
//               alt="Jordin"
//               className="member-avatar"
//             />
//             <div className="member-info">
//               <div className="member-name">Jordin</div>
//             </div>
//           </div>
//         </div>

//         <button className="primary wide invite-btn">
//           <svg
//             width="16"
//             height="16"
//             viewBox="0 0 16 16"
//             fill="currentColor"
//             style={{ marginRight: "6px" }}
//           >
//             <path d="M8 0a3 3 0 100 6 3 3 0 000-6zM14 10a2 2 0 00-2-2H4a2 2 0 00-2 2v1a2 2 0 002 2h8a2 2 0 002-2v-1z" />
//             <path d="M13 7h-1V6a1 1 0 112 0v1zm0 2h1a1 1 0 110 2h-1a1 1 0 110-2z" />
//           </svg>
//           Invite Teammates
//         </button>

//         {status && <div className="status-message">{status}</div>}

//         {/* Dev settings - collapsible */}
//         <details className="dev-settings">
//           <summary>Developer Settings</summary>
//           <label className="field">
//             <span>API URL</span>
//             <input
//               value={apiUrl}
//               onChange={(e) => setApiUrl(e.target.value)}
//             />
//           </label>
//           <label className="field">
//             <span>Workspace ID</span>
//             <input
//               value={workspaceId}
//               onChange={(e) => setWorkspaceId(e.target.value)}
//             />
//           </label>
//           <label className="field">
//             <span>Display name</span>
//             <input
//               value={displayName}
//               onChange={(e) => setDisplayName(e.target.value)}
//             />
//           </label>
//         </details>
//       </section>

//       {/* Right Panel - Room Details (conditionally shown) */}
//       {showRoomPanel && selectedRoomObj && (
//         <aside className="details-col">
//           <div className="room-panel-header">
//             <h3 className="room-panel-title">
//               {selectedRoomObj.emoji} {selectedRoom}
//             </h3>
//             <button
//               className="icon-btn close-btn"
//               onClick={() => setShowRoomPanel(false)}
//               title="Close"
//             >
//               ✕
//             </button>
//           </div>

//           <div className="room-actions">
//             <button
//               className="primary wide join-btn"
//               onClick={() => void joinRoom(true)}
//             >
//               <svg
//                 width="16"
//                 height="16"
//                 viewBox="0 0 16 16"
//                 fill="currentColor"
//                 style={{ marginRight: "6px" }}
//               >
//                 <path d="M8 0a3 3 0 100 6 3 3 0 000-6z" />
//                 <path d="M12 8a2 2 0 00-2-2H6a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2V8z" />
//               </svg>
//               Join
//             </button>

//             <button
//               className="ghost wide"
//               onClick={() => void joinRoom(false)}
//               title="Join as listener only"
//             >
//               <svg
//                 width="16"
//                 height="16"
//                 viewBox="0 0 16 16"
//                 fill="currentColor"
//                 style={{ marginRight: "6px" }}
//               >
//                 <path d="M3 2a1 1 0 011-1h8a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V2zm5 10a1 1 0 100 2 1 1 0 000-2z" />
//               </svg>
//               Listen
//             </button>

//             <button
//               className="ghost wide"
//               onClick={() => void joinRoom(false)}
//               title="Join without audio"
//             >
//               <svg
//                 width="16"
//                 height="16"
//                 viewBox="0 0 16 16"
//                 fill="currentColor"
//                 style={{ marginRight: "6px" }}
//               >
//                 <path d="M8 0a3 3 0 00-3 3v5a3 3 0 006 0V3a3 3 0 00-3-3zM4 8a1 1 0 10-2 0 6 6 0 0012 0 1 1 0 10-2 0 4 4 0 01-8 0z" />
//                 <path d="M1 1l14 14" stroke="currentColor" strokeWidth="2" />
//               </svg>
//               Join w/o audio
//             </button>

//             <button className="ghost wide" title="Add Kiosks">
//               <svg
//                 width="16"
//                 height="16"
//                 viewBox="0 0 16 16"
//                 fill="currentColor"
//                 style={{ marginRight: "6px" }}
//               >
//                 <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm7 11h2v1H7v-1z" />
//                 <path d="M5 14h6v1H5v-1z" />
//               </svg>
//               Add Kiosks
//             </button>
//           </div>

//           <div className="room-description">
//             <div className="description-header">
//               <span>DESCRIPTION</span>
//               <button className="text-btn">
//                 Edit{" "}
//                 <svg
//                   width="12"
//                   height="12"
//                   viewBox="0 0 16 16"
//                   fill="currentColor"
//                   style={{ marginLeft: "4px" }}
//                 >
//                   <path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10z" />
//                 </svg>
//               </button>
//             </div>
//             <p className="description-text">
//               Come here to run your team's standup. Pro tip: type /random in
//               chat to get a standup order.
//             </p>
//           </div>

//           <div className="room-visibility">
//             <svg
//               width="14"
//               height="14"
//               viewBox="0 0 16 16"
//               fill="currentColor"
//               style={{ marginRight: "6px" }}
//             >
//               <path d="M8 0a3 3 0 100 6 3 3 0 000-6z" />
//               <path d="M12 8a2 2 0 00-2-2H6a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2V8z" />
//             </svg>
//             Visible to everyone
//           </div>

//           <div className="room-footer">
//             <a href="#" className="slack-link">
//               Also send to Slack →
//             </a>
//             <div className="chat-input-container">
//               <input
//                 type="text"
//                 placeholder="Type a message..."
//                 className="chat-input"
//               />
//               <div className="chat-actions">
//                 <button className="icon-btn" title="Format">
//                   <svg
//                     width="14"
//                     height="14"
//                     viewBox="0 0 16 16"
//                     fill="currentColor"
//                   >
//                     <path d="M3 3h10v2H3V3zm0 4h10v2H3V7zm0 4h6v2H3v-2z" />
//                   </svg>
//                 </button>
//                 <button className="icon-btn" title="Attach">
//                   <svg
//                     width="14"
//                     height="14"
//                     viewBox="0 0 16 16"
//                     fill="currentColor"
//                   >
//                     <path d="M13.5 3a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 011.5 3V1.5A1.5 1.5 0 013 0h9a1.5 1.5 0 011.5 1.5V3z" />
//                   </svg>
//                 </button>
//               </div>
//             </div>
//           </div>
//         </aside>
//       )}
//     </section>
//   </main>
// );
