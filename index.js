#!/usr/bin/env node

const os = require('os');
const si = require('systeminformation');
const blessed = require('blessed');
const contrib = require('blessed-contrib');

const screen = blessed.screen({
  smartCSR: true,
  title: 'Server Metrics Dashboard',
  fullUnicode: true,
});

const grid = new contrib.grid({ rows: 12, cols: 12, screen });

const cpuGauge = grid.set(0, 0, 3, 4, contrib.gauge, {
  label: ' CPU Usage ',
  stroke: 'cyan',
  fill: 'white',
  percent: 0,
});

const memGauge = grid.set(0, 4, 3, 4, contrib.gauge, {
  label: ' Memory Usage ',
  stroke: 'green',
  fill: 'white',
  percent: 0,
});

const swapGauge = grid.set(0, 8, 3, 4, contrib.gauge, {
  label: ' Swap Usage ',
  stroke: 'yellow',
  fill: 'white',
  percent: 0,
});

const cpuLine = grid.set(3, 0, 4, 8, contrib.line, {
  label: ' CPU % (last 60s) ',
  showLegend: true,
  style: { line: 'cyan', text: 'white', baseline: 'gray' },
  minY: 0,
  maxY: 100,
});

const tempTable = grid.set(3, 8, 4, 4, contrib.table, {
  label: ' Temperatures (°C) ',
  keys: false,
  interactive: false,
  columnSpacing: 2,
  columnWidth: [16, 8],
});

const voltageTable = grid.set(7, 0, 3, 4, contrib.table, {
  label: ' Voltages / Power ',
  keys: false,
  interactive: false,
  columnSpacing: 2,
  columnWidth: [18, 10],
});

const diskTable = grid.set(7, 4, 3, 4, contrib.table, {
  label: ' Disks ',
  keys: false,
  interactive: false,
  columnSpacing: 2,
  columnWidth: [10, 8, 6, 6],
});

const netSpark = grid.set(7, 8, 3, 4, contrib.sparkline, {
  label: ' Network (KB/s) ',
  tags: true,
  style: { fg: 'magenta' },
});

const sysInfo = grid.set(10, 0, 2, 8, blessed.box, {
  label: ' System ',
  border: { type: 'line' },
  style: { border: { fg: 'gray' } },
  tags: true,
  padding: { left: 1, right: 1 },
});

const help = grid.set(10, 8, 2, 4, blessed.box, {
  label: ' Controls ',
  border: { type: 'line' },
  style: { border: { fg: 'gray' } },
  tags: true,
  padding: { left: 1, right: 1 },
  content:
    '{cyan-fg}q{/} / {cyan-fg}Esc{/} / {cyan-fg}Ctrl+C{/}  quit\n' +
    '{cyan-fg}r{/}  force refresh\n\nUpdates every 1s',
});

const cpuHistory = Array(60).fill(0);
const netRxHist = Array(30).fill(0);
const netTxHist = Array(30).fill(0);
let staticInfo = null;

const fmtBytes = (b) => {
  if (!b || b < 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(1)} ${u[i]}`;
};

const na = (v, suffix = '') =>
  v === null || v === undefined || Number.isNaN(v) ? 'N/A' : `${v}${suffix}`;

async function loadStatic() {
  const [cpu, osInfo, sys] = await Promise.all([
    si.cpu(),
    si.osInfo(),
    si.system(),
  ]);
  staticInfo = { cpu, osInfo, sys };
}

async function refresh() {
  try {
    const [load, mem, temp, disks, fs, net, battery] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.cpuTemperature(),
      si.diskLayout(),
      si.fsSize(),
      si.networkStats(),
      si.battery(),
    ]);

    const cpuPct = Math.round(load.currentLoad || 0);
    cpuGauge.setPercent(cpuPct);
    cpuHistory.push(cpuPct);
    cpuHistory.shift();
    cpuLine.setData([{
      title: `${cpuPct}%`,
      x: cpuHistory.map((_, i) => `${i}`),
      y: cpuHistory,
      style: { line: 'cyan' },
    }]);

    const memPct = Math.round((mem.active / mem.total) * 100);
    memGauge.setPercent(memPct);
    const swapPct = mem.swaptotal ? Math.round((mem.swapused / mem.swaptotal) * 100) : 0;
    swapGauge.setPercent(swapPct);

    const tempRows = [];
    if (temp.main !== null && temp.main !== undefined) tempRows.push(['CPU Package', temp.main.toFixed(1)]);
    if (temp.max !== null && temp.max !== undefined && temp.max !== temp.main) tempRows.push(['CPU Max', temp.max.toFixed(1)]);
    if (Array.isArray(temp.cores)) {
      temp.cores.forEach((c, i) => {
        if (c !== null && c !== undefined) tempRows.push([`Core ${i}`, c.toFixed(1)]);
      });
    }
    if (temp.chipset) tempRows.push(['Chipset', temp.chipset.toFixed(1)]);
    if (temp.socket && Array.isArray(temp.socket)) {
      temp.socket.forEach((s, i) => tempRows.push([`Socket ${i}`, s.toFixed(1)]));
    }
    try {
      const gfx = await si.graphics();
      (gfx.controllers || []).forEach((g, i) => {
        if (g.temperatureGpu) tempRows.push([`GPU ${i}`, g.temperatureGpu.toFixed(1)]);
      });
    } catch (_) {}
    disks.forEach((d, i) => {
      if (d.temperature) tempRows.push([`Disk ${i}`, String(d.temperature)]);
    });
    if (tempRows.length === 0) tempRows.push(['No sensors', 'N/A']);
    tempTable.setData({ headers: ['Sensor', '°C'], data: tempRows });

    const vRows = [];
    if (battery.hasBattery) {
      if (battery.voltage) vRows.push(['Battery', `${battery.voltage.toFixed(2)} V`]);
      if (battery.percent !== null) vRows.push(['Bat Charge', `${battery.percent}%`]);
      if (battery.acConnected !== undefined) vRows.push(['AC Power', battery.acConnected ? 'Yes' : 'No']);
      if (battery.designedCapacity) vRows.push(['Design Cap', `${battery.designedCapacity} mWh`]);
      if (battery.maxCapacity) vRows.push(['Max Cap', `${battery.maxCapacity} mWh`]);
    }
    try {
      const cpuCur = await si.cpuCurrentSpeed();
      if (cpuCur.avg) vRows.push(['CPU Speed', `${cpuCur.avg.toFixed(2)} GHz`]);
      if (cpuCur.min) vRows.push(['CPU Min', `${cpuCur.min.toFixed(2)} GHz`]);
      if (cpuCur.max) vRows.push(['CPU Max', `${cpuCur.max.toFixed(2)} GHz`]);
    } catch (_) {}
    if (staticInfo?.cpu?.voltage) vRows.push(['CPU Voltage', `${staticInfo.cpu.voltage} V`]);
    if (vRows.length === 0) vRows.push(['No sensors', 'N/A']);
    voltageTable.setData({ headers: ['Metric', 'Value'], data: vRows });

    const dRows = fs.slice(0, 6).map((d) => [
      (d.mount || d.fs || '?').slice(0, 10),
      fmtBytes(d.size),
      `${Math.round(d.use)}%`,
      d.type || '',
    ]);
    if (dRows.length === 0) dRows.push(['N/A', '', '', '']);
    diskTable.setData({ headers: ['Mount', 'Size', 'Used', 'Type'], data: dRows });

    const primary = net[0] || { rx_sec: 0, tx_sec: 0, iface: 'n/a' };
    const rxKB = Math.max(0, (primary.rx_sec || 0) / 1024);
    const txKB = Math.max(0, (primary.tx_sec || 0) / 1024);
    netRxHist.push(rxKB); netRxHist.shift();
    netTxHist.push(txKB); netTxHist.shift();
    netSpark.setData(
      [`RX ${rxKB.toFixed(1)} KB/s`, `TX ${txKB.toFixed(1)} KB/s`],
      [netRxHist.map(Math.round), netTxHist.map(Math.round)]
    );

    const uptime = os.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    sysInfo.setContent(
      `{bold}Host:{/}    ${os.hostname()}   {bold}OS:{/} ${staticInfo?.osInfo?.distro || os.type()} ${staticInfo?.osInfo?.release || os.release()}\n` +
      `{bold}CPU:{/}     ${staticInfo?.cpu?.manufacturer || ''} ${staticInfo?.cpu?.brand || ''} (${os.cpus().length} cores)\n` +
      `{bold}Memory:{/}  ${fmtBytes(mem.active)} / ${fmtBytes(mem.total)}   ` +
      `{bold}Free:{/} ${fmtBytes(mem.available)}   {bold}Swap:{/} ${fmtBytes(mem.swapused)} / ${fmtBytes(mem.swaptotal)}\n` +
      `{bold}Uptime:{/}  ${h}h ${m}m   {bold}Load:{/} ${os.loadavg().map((n) => n.toFixed(2)).join('  ')}   {bold}Iface:{/} ${primary.iface}`
    );

    screen.render();
  } catch (err) {
    sysInfo.setContent(`{red-fg}Error:{/} ${err.message}`);
    screen.render();
  }
}

screen.key(['q', 'escape', 'C-c'], () => process.exit(0));
screen.key(['r'], refresh);

(async () => {
  await loadStatic();
  await refresh();
  setInterval(refresh, 1000);
})();
