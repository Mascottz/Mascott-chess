# Mascott Chess PWA

A responsive chess Progressive Web App with:

- Player vs computer gameplay
- Tight Elo-based computer levels from 400 to 2400 in 50-point steps
- Legal move highlighting for every touched/clicked piece
- Responsive computer replies to the player's move
- Full chess rules: check, checkmate, stalemate, castling, en passant, promotion, and the fifty-move draw rule
- A pure-beginner tutorial page explaining the goal of chess, the board, every piece's movement, captures, check/checkmate, special moves, app controls, and Elo suggestions
- Installable PWA manifest and offline service worker
- Mobile-friendly touch UI

## Run locally

From this folder:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

The service worker only registers when served over `localhost` or HTTPS. Opening `index.html` directly from the file system will still let you play, but PWA install/offline caching will not activate.

## Files

```text
index.html              Bundled app markup, styling, and scripts for reliable preview/play
index.modular.html      Same app using separate CSS/JS files
tutorial.html           Static tutorial page
styles.css              Responsive UI styling source
js/chess-engine.js      Chess rules, legal move generation, AI search source
js/app.js               Browser UI and PWA behavior source
manifest.webmanifest    PWA manifest
sw.js                   Offline cache service worker
icons/                  App icons
```

If a previously opened version appears stuck, reload the page once or clear the browser's site data so the updated service worker cache is replaced.

## Windows version

Two Windows deliverables are available one folder above this project:

```text
MascottChess-Windows-Portable.zip   Portable Windows package with a double-click launcher
MascottChess-Electron-Source.zip    Electron source project for building an installer or .exe on Windows
```

For the portable version, extract the zip and double-click `Start Mascott Chess.cmd`.
