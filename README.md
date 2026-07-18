# Server Metrics Dashboard

A live CLI dashboard that shows your machine's real-time system metrics in the terminal — CPU usage, temperatures, voltage, memory, disks (including disk temperature when available), and network throughput.

Built with Node.js, [systeminformation](https://www.npmjs.com/package/systeminformation), and [blessed-contrib](https://www.npmjs.com/package/blessed-contrib).

## Features

- Live CPU usage graph + gauge
- Memory usage gauge
- CPU temperatures (package + per-core) and voltage
- CPU current speed (min / avg / max)
- Physical disk info with temperature (S.M.A.R.T.)
- Filesystem usage per mount point
- Live network RX/TX chart (KB/s)
- System info panel (host, OS, CPU model, cores, RAM)
- Auto-refreshes every 1.5s
- Auto-launches the dashboard when run — no menus

## Requirements

- Node.js 18 or newer
- npm (bundled with Node.js)

### Optional (for full sensor data)

Some metrics depend on OS-level tools:

- **Linux:** `sudo apt install lm-sensors smartmontools` then `sudo sensors-detect`
- **macOS:** temperature sensors work out of the box; disk temps limited
- **Windows:** run the terminal as Administrator for full temperature/voltage data

Without these, the dashboard still runs — unavailable sensors just show `-`.

## Install

```bash
git clone https://github.com/<your-username>/CLI-Server-Metrics-Dashboard.git
cd CLI-Server-Metrics-Dashboard
npm install
```

## Run

```bash
npm start
```

Or directly:

```bash
node index.js
```

The dashboard opens immediately and starts streaming metrics. Press `q`, `Esc`, or `Ctrl+C` to quit.

## Install globally (optional)

```bash
npm install -g .
metrics
```

Now you can run `metrics` from anywhere.

## Project structure

```
.
├── index.js       # the dashboard
├── package.json
└── README.md
```

## Troubleshooting

- **Temperatures show `-`**: install `lm-sensors` (Linux) or run as Administrator (Windows).
- **Disk temp missing**: install `smartmontools` and ensure the drive supports S.M.A.R.T.
- **Network shows 0**: the first sample is a baseline; values populate after a second.

