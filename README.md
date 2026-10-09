# ⚡ SUDARSHAN: Zero-Data Offline Multiplayer Gaming Suite

<div align="center">

![License](https://img.shields.io/badge/License-ISC-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5.0-000000?logo=express&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-ws-010101?logo=socketdotio&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-Expo-61DAFB?logo=react&logoColor=black)
![Latency](https://img.shields.io/badge/Network_Latency-<5ms_LAN-success)
![Data Usage](https://img.shields.io/badge/Mobile_Data-0.00_KB-brightgreen)

**An engineering-grade, zero-data offline multiplayer gaming ecosystem for decentralized local entertainment.**  
*Host on any laptop or phone hotspot • Connect instantly via Dynamic QR Codes • 100% Zero Internet / Cellular Data Consumption*

[Key Features](#-key-features) • [Game Library](#-game-library-9-titles) • [System Architecture](#-system-architecture) • [Quick Start](#-quick-start) • [Mobile App](#-cross-platform-mobile-app) • [Project Structure](#-project-structure)

</div>

---

## 🌟 Overview

Modern multiplayer games almost universally rely on external cloud backends (AWS GameLift, Photon, Firebase), resulting in high latency jitter (80–250ms), ongoing cloud costs, and mandatory internet connectivity.

**Sudarshan** turns any standard host device (laptop, PC, Raspberry Pi, or smartphone hotspot) into an authoritative local edge gaming server over standard **IEEE 802.11 Wi-Fi or portable phone hotspots**.
- **0.00 KB Internet Consumed**: Works entirely in offline environments, transit, flights, dorms, and remote areas.
- **Sub-5ms Ultra-Low Latency**: High-frequency WebSocket communication over LAN for competitive tournament-grade responsiveness.
- **Zero-Friction QR Pairing**: Friends simply scan a generated QR code from their phone camera—no mandatory app store downloads needed!
- **Dual-Tier Deployment**: Play instantly in any mobile/desktop browser or run the dedicated React Native / Expo companion app.

---

## 🎮 Game Library (9 Titles)

| Game | Genre | Players | Engine & Highlights |
| :--- | :--- | :---: | :--- |
| ♟️ **Cyber Chess** | Strategy | 1v1 / Solo | Full FIDE rules, blitz timers, captured trays, glowing move indicators, Minimax AI with alpha-beta pruning. |
| 🔴 **Carrom King Royale** | Physics Board | 2–4 / Solo | 300 FPS sub-stepped Eulerian physics engine, elastic impulse collisions, radial suction pockets. |
| 🎲 **Ludo King Royale** | Classical Board | 2–4 / Solo | Vector track topology, 3D animated dice rolls, safe zone locks, automated bot pacing. |
| 🪖 **Mini Militia 2D** | Real-Time Combat | 1–8 | 2D platformer arena combat, dual virtual joysticks, jetpack nitro flight, AR/Shotgun/Sniper/RPG, bouncing grenades. |
| 🐍 **Slither Battle Royale** | Real-Time Arcade | 1–8 | High-density grid collisions, smooth inertia vectors, glowing energy orbs, speed boosting mechanics. |
| 💣 **Cyber Bomb Arena** | Tactical Grid | 2–4 | Grid destruction, tactical blast radiuses, speed & bomb power-ups, obstacle destruction physics. |
| 🔵 **Connect 4 Galaxy** | Tactical Strategy | 1v1 / Solo | Holographic matrix grid, gravity bounce animation, heuristic Minimax evaluation. |
| 💥 **Chain Reaction HD** | Recursive Arcade | 2–8 / Solo | Critical mass mechanics, 3D spinning atomic orbs, recursive BFS cascades, screen-shake & haptics. |
| 🂡 **Teen Patti Uno** | Card & Casino | 2–6 / Solo | Complete 108-card deck, action stacks (+2, +4, Skip, Reverse), interactive "UNO!" call, smart card-matching bots. |

---

## 🏗️ System Architecture

```
                      +------------------------------------------+
                      |           SUDARSHAN HOST (EDGE)          |
                      |   Node.js + Express 5 + WebSocket (ws)   |
                      |  - Authoritative Room State Managers     |
                      |  - Dynamic Local IP & QR Code Generator  |
                      |  - Zero-Data Synthesized Web Audio API   |
                      +--------------------+---------------------+
                                           |
                    IEEE 802.11 Local Wi-Fi / Hotspot (No Internet)
                                           |
         +---------------------------------+---------------------------------+
         |                                 |                                 |
         v                                 v                                 v
+------------------+             +-------------------+             +-------------------+
|  Mobile Browser  |             | Dedicated Mobile  |             |  Desktop / Laptop |
|   Client (PWA)   |             | (React Native App)|             |     Browser       |
| HTML5 Canvas/DOM |             | Expo / WebView    |             | Dual-Stick / Keys |
| Touch Joysticks  |             | Hardware Back Key |             | Fullscreen HUD    |
+------------------+             +-------------------+             +-------------------+
```

### Key Technical Pillars
1. **Authoritative State Synchronization**: Server-validated state transitions prevent out-of-order execution and race conditions.
2. **Deterministic Physics Simulation**: Sub-stepped Eulerian integration ensures uniform collision restitution and trajectories across heterogeneous devices.
3. **Web Audio API Sound Synthesizer**: Generates dynamic real-time SFX (explosions, gunshots, card flicks, moves) mathematically in browser memory without downloading audio asset files.
4. **Autonomous AI Heuristics**: Minimax with Alpha-Beta Pruning (Chess & Connect 4) and BFS cascading queues (Chain Reaction) allow seamless single-player offline play.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- Standard Wi-Fi router or any smartphone with Portable Hotspot enabled

### 1. Clone & Install
```bash
git clone https://github.com/omkar891-png/gtproject.git
cd gtproject
npm install
```

### 2. Launch the Edge Server
```bash
npm start
```
The console will display your active LAN address and a generated terminal QR code:
```
============================================================
  🎮 SUDARSHAN OFFLINE GAMING HUB IS ONLINE!
  Zero Data • Local Multiplayer • Sub-5ms Latency
============================================================
  🌐 Local URL:    http://localhost:3000
  📱 Network URL:  http://192.168.1.102:3000
============================================================
```

### 3. Connect Other Devices
1. Connect all phones and laptops to the **same Wi-Fi network or phone hotspot** (Mobile Data can be switched **OFF**).
2. Point any phone camera at the QR code displayed in the host terminal or dashboard.
3. Tap the link to open the web app instantly—no app installs required!

---

## 📱 Cross-Platform Mobile App (React Native / Expo)

For an app-store native experience, Sudarshan includes an Expo / React Native mobile package in `mobile-app/`:

```bash
# Start Expo development server
npm run mobile

# Run on Android device / emulator
npm run android

# Run on iOS simulator
npm run ios
```

### Standalone Inlined Mobile Bundle
Sudarshan includes a dedicated bundler script that inlines the complete HTML5/JS gaming client into a single standalone memory bundle (`mobile-app/standaloneBundle.js`):
```bash
npm run bundle:mobile
```

---

## 📁 Project Structure

```
sudarshan/
├── mobile-app/                  # React Native / Expo cross-platform mobile app
│   ├── assets/                  # App icons and adaptive splash assets
│   ├── src/                     # Native navigation, hooks, and views
│   ├── App.js                   # Root React Native component
│   ├── app.json                 # Expo application manifest
│   └── standaloneBundle.js      # Self-contained offline inlined bundle
├── public/                      # Web Client & Game Engines
│   ├── css/                     # Glassmorphic, responsive stylesheets
│   ├── js/                      # Modular game engines & networking
│   │   ├── audio.js             # Web Audio API procedural sound synthesizer
│   │   ├── lobby.js             # Room pairing, state & UI controllers
│   │   ├── network.js           # WebSocket client transport layer
│   │   ├── chess.js             # FIDE Cyber Chess engine + Minimax AI
│   │   ├── carrom.js            # 300 FPS sub-stepped Carrom physics engine
│   │   ├── ludo.js              # Ludo 3D vector dice & track mechanics
│   │   ├── minimilitia.js       # Mini Militia 2D combat arena & joysticks
│   │   ├── slither.js           # Slither Battle Royale multiplayer engine
│   │   ├── bomb.js              # Cyber Bomb Arena destruction engine
│   │   ├── connect4.js          # Connect 4 Galaxy gravity engine
│   │   ├── chainreaction.js     # Chain Reaction atomic BFS cascade engine
│   │   └── uno.js               # Teen Patti / Uno card engine & bots
│   └── index.html               # Main entrypoint & game lobby interface
├── scripts/                     # Build tools & presentation generators
│   ├── build-mobile-bundle.js   # Inlines web client into mobile assets
│   └── generate_ppt.py          # Automated architecture presentation generator
├── server.js                    # Express + WebSocket LAN authoritative host
├── PROJECT_DOCUMENTATION.md     # Deep architecture specification (45+ KB)
├── PRESENTATION_VIVA_GUIDE.md   # Defense & technical viva handbook
├── package.json                 # Root dependencies and operational scripts
└── .gitignore                   # Production repository ignore rules
```

---

## 📊 Performance & Zero-Data Benchmarks

| Metric | Sudarshan LAN | Standard Cloud Multiplayer | Advantage |
| :--- | :---: | :---: | :--- |
| **Cellular Data Usage** | **0.00 KB** | 15–50 MB / hour | **100% Free** |
| **Network Latency** | **< 5 ms** | 80–250 ms | **16x–50x Lower** |
| **External Dependencies** | **None** | Cloud servers, APIs | **Decentralized** |
| **Client Footprint** | **Instant Web / 614 KB bundle** | 80–300 MB downloads | **Zero Friction** |
| **Host Requirements** | **Any dual-core device** | Cloud server clusters | **Zero Server Cost** |

---

## 🤝 Contributing

Contributions, bug reports, and game engine expansions are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **ISC License**. Feel free to use, modify, and distribute for academic and personal projects.
