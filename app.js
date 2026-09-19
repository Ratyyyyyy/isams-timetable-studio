const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const STORAGE_KEY = "yiyao-timetable-studio-v1";

const PERIODS = [
  ["Reg", "07:45"],
  ["P1", "08:00–08:40"],
  ["P2", "08:45–09:25"],
  ["P3", "09:35–10:15"],
  ["P4", "10:25–11:05"],
  ["P5", "11:10–11:50"],
  ["P6", "11:55–12:35"],
  ["P7", "12:40–13:20"],
  ["P8", "13:30–14:10"],
  ["P9", "14:15–14:55"],
  ["P10", "15:05–15:45"],
  ["P11", "15:50–16:30"],
  ["P12", "16:35–17:00"],
  ["P13", "17:00–18:15"],
  ["P14", "18:15–20:00"],
  ["Transition", "20:00–20:15"],
  ["P15", "20:15–21:30"],
  ["Home", "21:30–22:45"],
  ["Sleep", "22:45–07:00"],
];

const emptyCell = () => ({ course: "", teacher: "", room: "", note: "" });

function key(period, day) {
  return `${period}|${day}`;
}

function lesson(course, teacher = "", room = "", note = "") {
  return { course, teacher, room, note };
}

function makeDefaultState() {
  return {
    periods: PERIODS.map(([label, time]) => ({ label, time })),
    cells: {},
    updatedAt: Date.now(),
  };
}

function normaliseState(candidate) {
  if (!candidate || !Array.isArray(candidate.periods) || typeof candidate.cells !== "object") {
    throw new Error("Invalid timetable file");
  }
  const base = makeDefaultState();
  return {
    periods: base.periods.map((period, index) => ({
      label: String(candidate.periods[index]?.label || period.label),
      time: String(candidate.periods[index]?.time || period.time),
    })),
    cells: { ...base.cells, ...candidate.cells },
    updatedAt: Date.now(),
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return makeDefaultState();
  try {
    return normaliseState(JSON.parse(raw));
  } catch {
    return makeDefaultState();
  }
}

let state = loadState();
let selection = null;

const timetable = document.querySelector("#timetable");
const editorTitle = document.querySelector("#editorTitle");
const courseInput = document.querySelector("#courseInput");
const teacherInput = document.querySelector("#teacherInput");
const roomInput = document.querySelector("#roomInput");
const noteInput = document.querySelector("#noteInput");
const periodLabelInput = document.querySelector("#periodLabelInput");
const periodTimeInput = document.querySelector("#periodTimeInput");
const copyDownButton = document.querySelector("#copyDownButton");
const clearCellButton = document.querySelector("#clearCellButton");
const deviceSelect = document.querySelector("#deviceSelect");
const versionSelect = document.querySelector("#versionSelect");
const canvas = document.querySelector("#wallpaperCanvas");

const editorInputs = [courseInput, teacherInput, roomInput, noteInput];

function getPeriodIndex(label) {
  return state.periods.findIndex((period) => period.label === label);
}

function getCell(period, day) {
  return state.cells[key(period, day)] || emptyCell();
}

function saveState() {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cellLines(cell) {
  const details = [cell.room, cell.note].filter(Boolean).join(" · ");
  return [cell.course, cell.teacher, details].filter(Boolean);
}

function renderTable() {
  const header = `<thead><tr><th>P</th>${DAYS.map((day) => `<th>${day}</th>`).join("")}</tr></thead>`;
  const rows = state.periods
    .map((period, periodIndex) => {
      const shared = ["P13", "Transition", "P15", "Home", "Sleep"].includes(period.label);
      const periodCell = `<th class="period-cell" data-period-index="${periodIndex}">${period.label}<span>${period.time}</span></th>`;
      if (shared) {
        const cell = getCell(period.label, "all");
        return `<tr>${periodCell}${renderLessonCell(period.label, "all", cell, true)}</tr>`;
      }
      return `<tr>${periodCell}${DAYS.map((day) => renderLessonCell(period.label, day, getCell(period.label, day), false)).join("")}</tr>`;
    })
    .join("");
  timetable.innerHTML = `${header}<tbody>${rows}</tbody>`;

  timetable.querySelectorAll(".lesson-cell").forEach((cell) => {
    cell.addEventListener("click", () => selectCell(cell.dataset.period, cell.dataset.day));
  });

  timetable.querySelectorAll(".period-cell").forEach((cell) => {
    cell.addEventListener("click", () => selectPeriod(Number(cell.dataset.periodIndex)));
  });
}

function renderLessonCell(period, day, cell, shared) {
  const isSelected = selection && selection.period === period && selection.day === day;
  const lines = cellLines(cell);
  const content = lines.length
    ? lines.map((line, index) => `<span class="${index === 0 ? "lesson-title" : index === 1 ? "lesson-teacher" : "lesson-room"}">${escapeHtml(line)}</span>`).join("")
    : "";
  return `<td ${shared ? 'colspan="5"' : ""} class="lesson-cell${isSelected ? " selected" : ""}" data-period="${period}" data-day="${day}">${content}</td>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectCell(period, day) {
  selection = { period, day, periodIndex: getPeriodIndex(period) };
  const cell = getCell(period, day);
  editorTitle.textContent = day === "all" ? `${period} · All weekdays` : `${period} · ${day}`;
  editorInputs.forEach((input) => (input.disabled = false));
  courseInput.value = cell.course || "";
  teacherInput.value = cell.teacher || "";
  roomInput.value = cell.room || "";
  noteInput.value = cell.note || "";
  clearCellButton.disabled = false;
  copyDownButton.disabled = day === "all" || selection.periodIndex >= state.periods.length - 1;
  setPeriodEditor(selection.periodIndex);
  renderTable();
}

function selectPeriod(index) {
  const period = state.periods[index];
  selection = { period: period.label, day: null, periodIndex: index };
  editorTitle.textContent = `${period.label} · Period settings`;
  editorInputs.forEach((input) => {
    input.value = "";
    input.disabled = true;
  });
  clearCellButton.disabled = true;
  copyDownButton.disabled = true;
  setPeriodEditor(index);
  renderTable();
}

function setPeriodEditor(index) {
  const period = state.periods[index];
  periodLabelInput.disabled = false;
  periodTimeInput.disabled = false;
  periodLabelInput.value = period.label;
  periodTimeInput.value = period.time;
}

function updateSelectedCell() {
  if (!selection || !selection.day) return;
  state.cells[key(selection.period, selection.day)] = {
    course: courseInput.value.trim(),
    teacher: teacherInput.value.trim(),
    room: roomInput.value.trim(),
    note: noteInput.value.trim(),
  };
  saveState();
  renderTable();
  drawWallpaper();
}

editorInputs.forEach((input) => input.addEventListener("input", updateSelectedCell));

periodLabelInput.addEventListener("change", () => {
  if (!selection) return;
  const index = selection.periodIndex;
  const previous = state.periods[index].label;
  const next = periodLabelInput.value.trim() || previous;
  if (next !== previous) {
    const updated = {};
    Object.entries(state.cells).forEach(([cellKey, value]) => {
      updated[cellKey.startsWith(`${previous}|`) ? cellKey.replace(`${previous}|`, `${next}|`) : cellKey] = value;
    });
    state.cells = updated;
    state.periods[index].label = next;
    selection.period = next;
  }
  saveState();
  renderTable();
  drawWallpaper();
});

periodTimeInput.addEventListener("input", () => {
  if (!selection) return;
  state.periods[selection.periodIndex].time = periodTimeInput.value;
  saveState();
  renderTable();
  drawWallpaper();
});

copyDownButton.addEventListener("click", () => {
  if (!selection || !selection.day) return;
  const nextPeriod = state.periods[selection.periodIndex + 1];
  if (!nextPeriod) return;
  state.cells[key(nextPeriod.label, selection.day)] = { ...getCell(selection.period, selection.day) };
  saveState();
  renderTable();
  drawWallpaper();
});

clearCellButton.addEventListener("click", () => {
  if (!selection || !selection.day) return;
  state.cells[key(selection.period, selection.day)] = emptyCell();
  selectCell(selection.period, selection.day);
  saveState();
  drawWallpaper();
});

document.querySelector("#resetButton").addEventListener("click", () => {
  if (!window.confirm("Reset the timetable to the supplied default schedule?")) return;
  state = makeDefaultState();
  selection = null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  editorTitle.textContent = "Select a timetable cell";
  editorInputs.forEach((input) => {
    input.value = "";
    input.disabled = true;
  });
  periodLabelInput.value = "";
  periodTimeInput.value = "";
  periodLabelInput.disabled = true;
  periodTimeInput.disabled = true;
  renderTable();
  drawWallpaper();
});

document.querySelector("#exportJsonButton").addEventListener("click", () => {
  downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }), "timetable-data.json");
});

const importInput = document.querySelector("#importInput");
document.querySelector("#importButton").addEventListener("click", () => importInput.click());
importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;
  try {
    state = normaliseState(JSON.parse(await file.text()));
    saveState();
    selection = null;
    renderTable();
    drawWallpaper();
  } catch (error) {
    window.alert(error.message || "Could not import this file.");
  } finally {
    importInput.value = "";
  }
});

deviceSelect.addEventListener("change", drawWallpaper);
versionSelect.addEventListener("change", drawWallpaper);
document.querySelector("#downloadButton").addEventListener("click", downloadWallpaper);

document.querySelectorAll(".quick-export").forEach((button) => {
  button.addEventListener("click", () => {
    deviceSelect.value = button.dataset.device;
    versionSelect.value = button.dataset.version;
    drawWallpaper();
    downloadWallpaper();
  });
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadWallpaper() {
  drawWallpaper();
  const filename = `Timetable_${deviceSelect.value === "ipad" ? "iPad" : "Phone"}_${versionSelect.value === "full" ? "Full_Day" : "Campus"}.png`;
  canvas.toBlob((blob) => blob && downloadBlob(blob, filename), "image/png");
}

function drawWallpaper() {
  const device = deviceSelect.value;
  const full = versionSelect.value === "full";
  const config = device === "ipad"
    ? { width: 2090, height: 3012, x: 120, y: 912, tableWidth: 1850, logoX: 94, logoY: 625, compact: false }
    : { width: 1080, height: 2400, x: 80, y: 640, tableWidth: 920, logoX: 58, logoY: 473, compact: true };

  canvas.width = config.width;
  canvas.height = config.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawBrand(ctx, config);

  const lastIndex = full ? state.periods.length - 1 : state.periods.findIndex((period) => period.label === "P14");
  const periods = state.periods.slice(0, lastIndex + 1);
  drawCanvasTable(ctx, config, periods);
}

function drawBrand(ctx, config) {
  const s = config.compact ? 0.62 : 1;
  const x = config.logoX;
  const y = config.logoY;
  ctx.save();
  ctx.fillStyle = "#ec302f";
  ctx.fillRect(x, y, 15 * s, 104 * s);
  ctx.fillStyle = "#15469a";
  ctx.fillRect(x + 25 * s, y, 16 * s, 118 * s);
  ctx.fillStyle = "#ec302f";
  ctx.fillRect(x + 53 * s, y, 15 * s, 104 * s);
  ctx.fillStyle = "#15469a";
  ctx.font = `700 ${34 * s}px Arial`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("ULINK", x + 85 * s, y + 9 * s);
  ctx.fillText("COLLEGE", x + 85 * s, y + 42 * s);
  ctx.font = `400 ${23 * s}px Arial`;
  ctx.fillText("SHANGHAI", x + 85 * s, y + 78 * s);
  ctx.restore();
}

function drawCanvasTable(ctx, config, periods) {
  const { x, y, tableWidth, compact, height } = config;
  const headerHeight = compact ? 44 : 73;
  const bottomMargin = compact ? 120 : 105;
  const available = height - y - bottomMargin - headerHeight;
  const baseHeight = Math.floor(available / periods.length);
  const timeWidth = Math.round(tableWidth * 0.092);
  const dayWidth = (tableWidth - timeWidth) / 5;
  const lineWidth = compact ? 1.4 : 2.2;
  const grid = "#85898c";

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = grid;
  ctx.fillStyle = "#d0d0d0";
  ctx.fillRect(x, y, tableWidth, headerHeight);
  ctx.strokeRect(x, y, tableWidth, headerHeight);
  ctx.beginPath();
  ctx.moveTo(x + timeWidth, y);
  ctx.lineTo(x + timeWidth, y + headerHeight);
  for (let i = 1; i < 5; i += 1) {
    const lineX = x + timeWidth + dayWidth * i;
    ctx.moveTo(lineX, y);
    ctx.lineTo(lineX, y + headerHeight);
  }
  ctx.stroke();

  ctx.fillStyle = "#3f4346";
  ctx.font = `${compact ? 15 : 28}px Arial`;
  ctx.fillText("P", x + timeWidth / 2, y + headerHeight / 2);
  DAYS.forEach((day, index) => {
    ctx.fillText(day, x + timeWidth + dayWidth * (index + 0.5), y + headerHeight / 2);
  });

  let currentY = y + headerHeight;
  periods.forEach((period, periodIndex) => {
    let rowHeight = baseHeight;
    if (period.label === "Reg") rowHeight = Math.round(baseHeight * 0.72);
    if (["P13", "P14"].includes(period.label)) rowHeight = Math.round(baseHeight * 1.08);
    if (periodIndex === periods.length - 1) {
      rowHeight = Math.min(rowHeight, height - bottomMargin - currentY);
    }

    const shared = ["P13", "Transition", "P15", "Home", "Sleep"].includes(period.label);
    ctx.fillStyle = periodIndex % 2 === 0 ? "#fafafa" : "#ffffff";
    ctx.fillRect(x, currentY, tableWidth, rowHeight);
    if (shared) {
      ctx.fillStyle = "#f4f4f4";
      ctx.fillRect(x + timeWidth, currentY, tableWidth - timeWidth, rowHeight);
    }
    ctx.strokeStyle = grid;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, currentY, tableWidth, rowHeight);
    ctx.beginPath();
    ctx.moveTo(x + timeWidth, currentY);
    ctx.lineTo(x + timeWidth, currentY + rowHeight);
    if (!shared) {
      for (let i = 1; i < 5; i += 1) {
        const lineX = x + timeWidth + dayWidth * i;
        ctx.moveTo(lineX, currentY);
        ctx.lineTo(lineX, currentY + rowHeight);
      }
    }
    ctx.stroke();

    drawPeriodLabel(ctx, x, currentY, timeWidth, rowHeight, period, compact);
    if (shared) {
      drawCanvasCell(ctx, x + timeWidth, currentY, tableWidth - timeWidth, rowHeight, getCell(period.label, "all"), compact);
    } else {
      DAYS.forEach((day, dayIndex) => {
        drawCanvasCell(ctx, x + timeWidth + dayWidth * dayIndex, currentY, dayWidth, rowHeight, getCell(period.label, day), compact);
      });
    }
    currentY += rowHeight;
  });
  ctx.restore();
}

function drawPeriodLabel(ctx, x, y, width, height, period, compact) {
  ctx.save();
  ctx.fillStyle = "#44484b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${compact ? 13 : 24}px Arial`;
  ctx.fillText(period.label, x + width / 2, y + height / 2 - (compact ? 7 : 12));
  ctx.font = `${compact ? 11 : 20}px Arial`;
  ctx.fillText(period.time, x + width / 2, y + height / 2 + (compact ? 8 : 14));
  ctx.restore();
}

function drawCanvasCell(ctx, x, y, width, height, cell, compact) {
  const lines = cellLines(cell);
  if (!lines.length) return;
  const base = compact ? 18 : 29;
  const sizes = lines.map((_, index) => Math.max(compact ? 11 : 18, base - index * (compact ? 3 : 4)));
  const gap = compact ? 5 : 9;
  const lineHeights = sizes.map((size) => size * 1.05);
  const total = lineHeights.reduce((sum, value) => sum + value, 0) + gap * (lines.length - 1);
  let cursor = y + (height - total) / 2;

  ctx.save();
  ctx.fillStyle = "#3e4245";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    let size = sizes[index];
    ctx.font = `${size}px Arial`;
    while (ctx.measureText(line).width > width - (compact ? 10 : 18) && size > (compact ? 9 : 14)) {
      size -= 1;
      ctx.font = `${size}px Arial`;
    }
    ctx.fillText(line, x + width / 2, cursor);
    cursor += lineHeights[index] + gap;
  });
  ctx.restore();
}

renderTable();
drawWallpaper();
