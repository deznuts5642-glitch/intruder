# INTRUDER PvP

Your original Three.js house FPS, converted to free-for-all multiplayer for up to 8 players per room. No bots or waves.

## Play on this computer

Install Node.js 20 or newer from https://nodejs.org/ if needed. Double-click `start-game.cmd`, keep its terminal open, then visit **http://localhost:3000**. Alternatively run `npm start` in this folder. Runtime libraries are bundled; no npm download is needed to play.

Enter a callsign, click **Create Room**, and then **Click to Resume** to capture your mouse. Open a second browser tab, enter the displayed room code, and click **Join** to test another player. Each browser session is a separate player.

## Play with a friend on the same Wi-Fi

Run `ipconfig` on the hosting computer and find its Wi-Fi/Ethernet IPv4 address (for example `192.168.1.50`). Your friend opens **http://192.168.1.50:3000**, enters their name and your room code, and joins. If Windows asks, allow Node.js on your private network. Guest/campus Wi-Fi can block connections between devices. A copied localhost invitation works only on the hosting computer; copy the invitation from the LAN address when inviting another computer.

## Play over the internet

The project is ready to run on a Node.js host with WebSocket support. Upload this folder, excluding `node_modules`, `.npm-cache`, tests, and screenshots; include `vendor` and `public/vendor`. Set install command to `npm ci --omit=dev` and start command to `npm start`. The server listens on `0.0.0.0` and uses the hosting service's `PORT` environment variable. Serve the page and `/ws` WebSocket endpoint from the same HTTPS origin. Share the resulting public URL and room code. A static HTML host alone cannot run the multiplayer server.

This build has been tested locally; no public internet deployment is included. Rooms, scores, and purchases are kept in memory and reset when the server restarts. A disconnected player returns to the lobby and must rejoin; their previous score/loadout is not restored. This is a private-room prototype with input rate limits, not a public matchmaking/account service.

## Rules and controls

- Free-for-all, up to 8 players; scoreboard sorts by kills, then fewer deaths.
- Start with $900 and a pistol. Each elimination awards $500.
- Death respawns you after 3 seconds, with full health/ammo and your owned weapons.
- Spawns are chosen away from living players; 2.5 seconds of protection ends when you shoot.
- WASD: move; mouse: look; Space: jump; left mouse: shoot; right mouse: sniper scope.
- R: reload; 1–6: switch weapons; B: armory; hold Tab: scoreboard; Esc: release mouse.
- Opening the armory or releasing the mouse does not pause the match. You can still be shot.
- Map boundaries keep fights near the house.

## Implementation

`public/index.html` preserves your map, procedural textures, renderer, viewmodels, audio, and HUD. `public/multiplayer.js` connects input and UI to real players. `server.js` owns movement, collisions, hit detection, health, ammo, cash, purchases, and respawns. `public/shared.js` shares movement/collision rules across server and client; the client predicts movement and blends server corrections. Other characters interpolate toward received snapshots. The server simulates at 60 Hz and sends state at 20 Hz. Gunshots use server-side hitscan with spread and wall occlusion; headshots deal double damage. There is no lag compensation yet, so high latency can make hits feel delayed.

Three.js r170 and the MIT-licensed `ws` library are bundled, with no runtime CDN dependency. The Three.js upgrade includes color-space and light adjustments to keep the house readable. `transport.js` and `public/connection.js` implement a small event/acknowledgement protocol over standard WebSockets. The ceiling and a Z-wall door lintel have corrected collision geometry. `original-index.html` is retained as reference with the lintel correction. The original Downloads file was not changed. `convert.py` and `generate.cjs` are conversion tools; ordinary play does not require Python or regenerating files. Third-party notices are in `public/vendor/THREE-LICENSE.txt` and `vendor/ws/LICENSE`.

## Validation

Run `npm test` for server integration tests; no installation is needed. To run the visual browser tests on a fresh computer, install the test-only dependency with `npm install --no-save playwright`, then run `npm run test:browser` (Google Chrome at its standard Windows install path, or set `CHROME_PATH` to another Chromium executable). Browser checks cover joining, visible remote players, movement, purchases, shooting, reload, scoreboard, player death/automatic respawn, and disconnects.
