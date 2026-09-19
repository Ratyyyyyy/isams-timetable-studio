const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

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
  ["P13", "17:00–18:00"],
  ["P14", "18:00–20:00"],
];

const STORAGE_KEY = "pupil-timetable-system-v2";
const PERIOD_LABELS = new Set(PERIODS.map(function (period) { return period[0]; }));

function key(period, day) {
  return period + "|" + day;
}

function emptyCell() {
  return { course: "", teacher: "", room: "", note: "" };
}

function lesson(course, teacher, room, note) {
  return {
    course: course || "",
    teacher: teacher || "",
    room: room || "",
    note: note || "",
  };
}

function makeDefaultState() {
  return {
    periods: PERIODS.map(function (period) {
      return { label: period[0], time: period[1] };
    }),
    cells: {},
    standingCourses: {},
    source: "Blank campus template",
    updatedAt: Date.now(),
  };
}

function makeDemoState() {
  const demo = makeDefaultState();
  const put = function (period, day, course, teacher, room, note) {
    demo.cells[key(period, day)] = lesson(course, teacher, room, note);
  };

  put("P1", "Monday", "AS/Chemistry", "LCA", "A312");
  put("P1", "Wednesday", "AS/Physics", "CHU", "A303");
  put("P1", "Friday", "AS/Mathematics", "ZJY", "A315");
  put("P2", "Tuesday", "AS/Chemistry", "LCA", "A312");
  put("P2", "Thursday", "AS/Physics", "CHU", "A303");
  put("P3", "Monday", "AS/Course Loop", "SRE", "Library");
  put("P3", "Wednesday", "AS/Chemistry", "LCA", "A312");
  put("P4", "Monday", "AS/Course Loop", "SRE", "Library");
  put("P4", "Thursday", "AS/Course Loop", "SRE", "Library");
  put("P6", "Tuesday", "AS/English", "YLI", "A315");
  put("P7", "Wednesday", "AS/Physics", "CHU", "S203");
  put("P8", "Monday", "AS/Physics", "CHU", "A303");
  put("P8", "Tuesday", "AS/Chemistry", "LCA", "A312");
  put("P8", "Friday", "AS/Tutor", "", "");
  put("P10", "Monday", "AS/Mathematics", "ZJY", "A315");
  put("P10", "Thursday", "AS/Chemistry", "LCA", "A312");
  put("P11", "Wednesday", "AS/Act", "", "");
  put("P12", "Friday", "AS/Review", "", "", "Weekly check");

  demo.source = "Built-in demonstration";
  return demo;
}

function normalizePeriodLabel(value) {
  const raw = String(value || "").trim().replace(/\s+/g, "").toUpperCase();
  if (raw === "REG") return "Reg";
  const match = raw.match(/^P0*(\d{1,2})$/);
  if (!match) return null;
  const number = Number(match[1]);
  return number >= 1 && number <= 14 ? "P" + number : null;
}

function normalizeCell(candidate) {
  const value = candidate && typeof candidate === "object" ? candidate : {};
  return {
    course: String(value.course ?? value.subject ?? value.activity ?? value.name ?? "").trim(),
    teacher: String(value.teacher ?? value.staff ?? "").trim(),
    room: String(value.room ?? value.location ?? "").trim(),
    note: String(value.note ?? value.notes ?? value.time ?? "").trim(),
  };
}

function normaliseState(candidate) {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Invalid timetable file");
  }

  const base = makeDefaultState();
  const sourcePeriods = Array.isArray(candidate.periods) ? candidate.periods : [];
  const periods = base.periods.map(function (period) {
    const match = sourcePeriods.find(function (candidatePeriod) {
      return normalizePeriodLabel(candidatePeriod && candidatePeriod.label) === period.label;
    });
    return {
      label: period.label,
      time: String(match && match.time ? match.time : period.time).trim(),
    };
  });
  const cells = {};

  function putCell(period, day, value) {
    const normalizedPeriod = normalizePeriodLabel(period);
    const normalizedDay = String(day || "").trim();
    if (!normalizedPeriod || !DAYS.includes(normalizedDay)) return;
    const cell = normalizeCell(value);
    if (cell.course || cell.teacher || cell.room || cell.note) {
      cells[key(normalizedPeriod, normalizedDay)] = cell;
    }
  }

  if (candidate.cells && typeof candidate.cells === "object") {
    Object.entries(candidate.cells).forEach(function (entry) {
      const parts = String(entry[0]).split("|");
      putCell(parts[0], parts[1], entry[1]);
    });
  }

  const entries = Array.isArray(candidate.entries)
    ? candidate.entries
    : Array.isArray(candidate.lessons)
      ? candidate.lessons
      : [];
  entries.forEach(function (entry) {
    if (!entry || typeof entry !== "object") return;
    putCell(entry.period || entry.label, entry.day || entry.weekday, entry);
  });

  return {
    periods: periods,
    cells: cells,
    standingCourses: candidate.standingCourses && typeof candidate.standingCourses === "object"
      ? candidate.standingCourses
      : {},
    source: String(candidate.source || "Imported timetable"),
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
const exportModeSelect = document.querySelector("#exportModeSelect");
const canvas = document.querySelector("#wallpaperCanvas");
const importInput = document.querySelector("#importInput");
const importStatus = document.querySelector("#importStatus");
const dropzone = document.querySelector("#dropzone");
const standingInput = document.querySelector("#standingInput");
const courseStatsTable = document.querySelector("#courseStatsTable");
const courseStatsTotal = document.querySelector("#courseStatsTotal");
const bulkCourseSelect = document.querySelector("#bulkCourseSelect");
const bulkBlockSelect = document.querySelector("#bulkBlockSelect");
const bulkDayChecks = document.querySelector("#bulkDayChecks");
const bulkStandingInput = document.querySelector("#bulkStandingInput");
const bulkAddButton = document.querySelector("#bulkAddButton");
const bulkAddHint = document.querySelector("#bulkAddHint");
const manualDaySelect = document.querySelector("#manualDaySelect");
const manualPeriodSelect = document.querySelector("#manualPeriodSelect");
const manualCourseInput = document.querySelector("#manualCourseInput");
const manualTeacherInput = document.querySelector("#manualTeacherInput");
const manualRoomInput = document.querySelector("#manualRoomInput");
const manualNoteInput = document.querySelector("#manualNoteInput");
const manualStandingInput = document.querySelector("#manualStandingInput");
const manualAddButton = document.querySelector("#manualAddButton");
const funScenarioSelect = document.querySelector("#funScenarioSelect");
const batchGrid = document.querySelector("#batchGrid");
const batchSelectionStatus = document.querySelector("#batchSelectionStatus");
const batchCourseInput = document.querySelector("#batchCourseInput");
const batchTeacherInput = document.querySelector("#batchTeacherInput");
const batchRoomInput = document.querySelector("#batchRoomInput");
const batchNoteInput = document.querySelector("#batchNoteInput");
const batchStandingInput = document.querySelector("#batchStandingInput");
const logoImage = new Image();
if (window.UCS_LOGO_DATA) logoImage.src = window.UCS_LOGO_DATA;

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const editorInputs = [courseInput, teacherInput, roomInput, noteInput];

function getPeriodIndex(label) {
  return state.periods.findIndex(function (period) {
    return period.label === label;
  });
}

function getCell(period, day) {
  return state.cells[key(period, day)] || emptyCell();
}

function saveState() {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const statusDot = document.querySelector(".portal-status span");
  if (statusDot) statusDot.classList.add("saved-pulse");
}

function cellLines(cell) {
  return [cell.course, cell.teacher, cell.room, cell.note].filter(Boolean);
}

function renderTable() {
  const header = "<thead><tr><th>P</th>" +
    DAYS.map(function (day) { return "<th>" + day + "</th>"; }).join("") +
    "</tr></thead>";

  const rows = state.periods.map(function (period, periodIndex) {
    const periodCell =
      "<th class=\"period-cell\" data-period-index=\"" + periodIndex + "\">" +
      escapeHtml(period.label) + "<span>" + escapeHtml(period.time) + "</span></th>";
    const cells = DAYS.map(function (day) {
      return renderLessonCell(period.label, day, getCell(period.label, day));
    }).join("");
    return "<tr>" + periodCell + cells + "</tr>";
  }).join("");

  timetable.innerHTML = header + "<tbody>" + rows + "</tbody>";

  timetable.querySelectorAll(".lesson-cell").forEach(function (cell) {
    cell.addEventListener("click", function () {
      selectCell(cell.dataset.period, cell.dataset.day);
    });
  });

  timetable.querySelectorAll(".period-cell").forEach(function (cell) {
    cell.addEventListener("click", function () {
      selectPeriod(Number(cell.dataset.periodIndex));
    });
  });
  renderBatchGrid();
}

function selectedBatchCells() {
  return batchGrid ? Array.from(batchGrid.querySelectorAll("input[data-batch-cell]:checked")).map(function (input) { return input.dataset.batchCell; }) : [];
}

function updateBatchSelectionStatus() {
  if (batchSelectionStatus) {
    const count = selectedBatchCells().length;
    batchSelectionStatus.textContent = count ? count + " cell" + (count === 1 ? "" : "s") + " selected." : "No cells selected.";
  }
}

function renderBatchGrid() {
  if (!batchGrid) return;
  const header = "<table class=\"batch-grid\"><thead><tr><th>P</th>" + DAYS.map(function (day) { return "<th>" + day + "</th>"; }).join("") + "</tr></thead><tbody>";
  const rows = state.periods.map(function (period) {
    const cells = DAYS.map(function (day) {
      const cell = getCell(period.label, day);
      const label = cell.course ? escapeHtml(cell.course) : "<span class=\"batch-empty\">Empty</span>";
      return "<td><label class=\"batch-cell\"><input type=\"checkbox\" data-batch-cell=\"" + escapeHtml(key(period.label, day)) + " /><span class=\"batch-cell-content\"><strong>" + label + "</strong><small>" + escapeHtml([cell.teacher, cell.room].filter(Boolean).join(" · ")) + "</small></span></label></td>";
    }).join("");
    return "<tr><th class=\"period-cell\">" + escapeHtml(period.label) + "<span>" + escapeHtml(period.time) + "</span></th>" + cells + "</tr>";
  }).join("");
  batchGrid.innerHTML = header + rows + "</tbody></table>";
  batchGrid.querySelectorAll("input[data-batch-cell]").forEach(function (input) { input.addEventListener("change", updateBatchSelectionStatus); });
  updateBatchSelectionStatus();
}

function applyBatchEntry(clearOnly) {
  const selected = selectedBatchCells();
  if (!selected.length) { if (batchSelectionStatus) batchSelectionStatus.textContent = "Select at least one cell first."; return; }
  selected.forEach(function (cellKey) {
    if (clearOnly) {
      delete state.cells[cellKey];
      delete state.standingCourses[cellKey];
    } else {
      state.cells[cellKey] = lesson(batchCourseInput.value.trim(), batchTeacherInput.value.trim(), batchRoomInput.value.trim(), batchNoteInput.value.trim());
      if (batchStandingInput.checked) state.standingCourses[cellKey] = true;
      else delete state.standingCourses[cellKey];
    }
  });
  saveState();
  renderTable();
  drawWallpaper();
  if (batchSelectionStatus) batchSelectionStatus.textContent = (clearOnly ? "Cleared " : "Applied lesson to ") + selected.length + " selected cell" + (selected.length === 1 ? "" : "s") + ".";
}

function renderLessonCell(period, day, cell) {
  const isSelected = selection &&
    selection.period === period &&
    selection.day === day;
  const lines = cellLines(cell);
  const content = lines.map(function (line, index) {
    const className = index === 0
      ? "lesson-title"
      : index === 1
        ? "lesson-teacher"
        : index === 2
          ? "lesson-room"
          : "lesson-note";
    return "<span class=\"" + className + "\">" + escapeHtml(line) + "</span>";
  }).join("");
  return "<td class=\"lesson-cell" + (isSelected ? " selected" : "") +
    "\" data-period=\"" + escapeHtml(period) + "\" data-day=\"" + escapeHtml(day) + "\">" +
    content + "</td>";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function selectCell(period, day) {
  selection = { period: period, day: day, periodIndex: getPeriodIndex(period) };
  const cell = getCell(period, day);
  editorTitle.textContent = period + " · " + day;
  editorInputs.forEach(function (input) { input.disabled = false; });
  if (standingInput) standingInput.disabled = false;
  courseInput.value = cell.course;
  teacherInput.value = cell.teacher;
  roomInput.value = cell.room;
  noteInput.value = cell.note;
  if (standingInput) standingInput.checked = Boolean(state.standingCourses[key(period, day)]);
  clearCellButton.disabled = false;
  copyDownButton.disabled =
    selection.periodIndex < 0 || selection.periodIndex >= state.periods.length - 1;
  setPeriodEditor(selection.periodIndex);
  renderTable();
}

function selectPeriod(index) {
  const period = state.periods[index];
  selection = { period: period.label, day: null, periodIndex: index };
  editorTitle.textContent = period.label + " · Period settings";
  editorInputs.forEach(function (input) {
    input.value = "";
    input.disabled = true;
  });
  if (standingInput) { standingInput.checked = false; standingInput.disabled = true; }
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
  if (standingInput && standingInput.checked) state.standingCourses[key(selection.period, selection.day)] = true;
  else delete state.standingCourses[key(selection.period, selection.day)];
  saveState();
  renderTable();
  drawWallpaper();
}

if (standingInput) {
  standingInput.addEventListener("change", updateSelectedCell);
}

editorInputs.forEach(function (input) {
  input.addEventListener("input", updateSelectedCell);
});

periodLabelInput.addEventListener("change", function () {
  if (!selection) return;
  const index = selection.periodIndex;
  const previous = state.periods[index].label;
  const next = normalizePeriodLabel(periodLabelInput.value) || previous;
  const duplicate = state.periods.some(function (period, periodIndex) {
    return periodIndex !== index && period.label === next;
  });
  if (next !== previous && !duplicate && PERIOD_LABELS.has(next)) {
    const updated = {};
    Object.entries(state.cells).forEach(function (entry) {
      const oldKey = entry[0];
      const nextKey = oldKey.startsWith(previous + "|")
        ? oldKey.replace(previous + "|", next + "|")
        : oldKey;
      updated[nextKey] = entry[1];
    });
    state.cells = updated;
    state.periods[index].label = next;
    selection.period = next;
  } else {
    periodLabelInput.value = previous;
  }
  saveState();
  renderTable();
  drawWallpaper();
});

periodTimeInput.addEventListener("input", function () {
  if (!selection) return;
  state.periods[selection.periodIndex].time = periodTimeInput.value.trim();
  saveState();
  renderTable();
  drawWallpaper();
});

copyDownButton.addEventListener("click", function () {
  if (!selection || !selection.day) return;
  const nextPeriod = state.periods[selection.periodIndex + 1];
  if (!nextPeriod) return;
  state.cells[key(nextPeriod.label, selection.day)] =
    normalizeCell(getCell(selection.period, selection.day));
  saveState();
  renderTable();
  drawWallpaper();
});

clearCellButton.addEventListener("click", function () {
  if (!selection || !selection.day) return;
  delete state.cells[key(selection.period, selection.day)];
  selectCell(selection.period, selection.day);
  saveState();
  drawWallpaper();
});

function resetState() {
  if (!window.confirm("Reset to the blank Campus timetable?")) return;
  state = makeDefaultState();
  selection = null;
  saveState();
  editorTitle.textContent = "Select a timetable cell";
  editorInputs.forEach(function (input) {
    input.value = "";
    input.disabled = true;
  });
  if (standingInput) { standingInput.checked = false; standingInput.disabled = true; }
  periodLabelInput.value = "";
  periodTimeInput.value = "";
  periodLabelInput.disabled = true;
  periodTimeInput.disabled = true;
  setImportStatus("Blank Campus template restored.", "neutral");
  renderTable();
  drawWallpaper();
}

document.querySelector("#resetButton").addEventListener("click", resetState);

function applyState(nextState, message, kind) {
  state = normaliseState(nextState);
  selection = null;
  saveState();
  editorTitle.textContent = "Select a timetable cell";
  editorInputs.forEach(function (input) {
    input.value = "";
    input.disabled = true;
  });
  periodLabelInput.value = "";
  periodTimeInput.value = "";
  periodLabelInput.disabled = true;
  periodTimeInput.disabled = true;
  renderTable();
  renderCourseTools();
  drawWallpaper();
  setImportStatus(message, kind || "success");
}

function courseBlocks() {
  const groups = {};
  Object.entries(state.cells).forEach(function (entry) {
    const parts = entry[0].split("|");
    const cell = entry[1];
    if (!cell.course) return;
    const signature = [cell.course, cell.teacher, cell.room, cell.note].join("¦");
    if (!groups[signature]) groups[signature] = { signature: signature, course: cell.course, teacher: cell.teacher, room: cell.room, note: cell.note, occurrences: [] };
    groups[signature].occurrences.push({ period: parts[0], day: parts[1] });
  });
  return Object.values(groups).sort(function (a, b) { return b.occurrences.length - a.occurrences.length || a.course.localeCompare(b.course); });
}

function renderCourseTools() {
  if (!courseStatsTable) return;
  const blocks = courseBlocks();
  if (courseStatsTotal) courseStatsTotal.textContent = blocks.length + (blocks.length === 1 ? " course" : " courses");
  courseStatsTable.innerHTML = "<thead><tr><th>Course</th><th>Lessons</th><th>Blocks</th><th>Standing</th></tr></thead><tbody>" +
    (blocks.length ? blocks.map(function (block) {
      const standing = block.occurrences.filter(function (item) { return state.standingCourses[key(item.period, item.day)]; }).length;
      const blockLabels = Array.from(new Set(block.occurrences.map(function (item) { return item.period; }))).join(", ");
      return "<tr><td><strong>" + escapeHtml(block.course) + "</strong><small>" + escapeHtml([block.teacher, block.room].filter(Boolean).join(" · ")) + "</small></td><td>" + block.occurrences.length + "</td><td>" + escapeHtml(blockLabels) + "</td><td>" + (standing || "—") + "</td></tr>";
    }).join("") : "<tr><td colspan=\"4\" class=\"empty-state\">No course cells yet.</td></tr>") + "</tbody>";
  const previousCourse = bulkCourseSelect && bulkCourseSelect.value;
  if (bulkCourseSelect) {
    bulkCourseSelect.innerHTML = blocks.length ? blocks.map(function (block) { return "<option value=\"" + escapeHtml(block.signature) + "\">" + escapeHtml(block.course) + " · " + block.occurrences.length + " lessons</option>"; }).join("") : "<option value=\"\">No course blocks detected</option>";
    if (blocks.some(function (block) { return block.signature === previousCourse; })) bulkCourseSelect.value = previousCourse;
    updateBulkBlocks();
  }
  if (manualDaySelect && !manualDaySelect.options.length) manualDaySelect.innerHTML = DAYS.map(function (day) { return "<option>" + day + "</option>"; }).join("");
  if (manualPeriodSelect && !manualPeriodSelect.options.length) manualPeriodSelect.innerHTML = state.periods.map(function (period) { return "<option value=\"" + period.label + "\">" + period.label + " · " + period.time + "</option>"; }).join("");
  if (bulkDayChecks && !bulkDayChecks.children.length) bulkDayChecks.innerHTML = DAYS.map(function (day) { return "<label><input type=\"checkbox\" value=\"" + day + "\" checked />" + day.slice(0, 3) + "</label>"; }).join("");
}

function updateBulkBlocks() {
  const block = courseBlocks().find(function (item) { return item.signature === (bulkCourseSelect && bulkCourseSelect.value); });
  if (!bulkBlockSelect) return;
  bulkBlockSelect.innerHTML = block ? block.occurrences.map(function (item, index) { return "<option value=\"" + index + "\">" + item.period + " · " + item.day + "</option>"; }).join("") : "<option value=\"\">Choose a course first</option>";
  if (bulkAddHint) bulkAddHint.textContent = block ? [block.teacher, block.room, block.note].filter(Boolean).join(" · ") || "Detected course block" : "Blocks are extracted from the current timetable.";
}

function selectedBulkDays() {
  return bulkDayChecks ? Array.from(bulkDayChecks.querySelectorAll("input:checked")).map(function (input) { return input.value; }) : [];
}

function addBulkBlock() {
  const block = courseBlocks().find(function (item) { return item.signature === bulkCourseSelect.value; });
  const source = block && block.occurrences[Number(bulkBlockSelect.value)];
  if (!block || !source || !selectedBulkDays().length) return;
  selectedBulkDays().forEach(function (day) {
    state.cells[key(source.period, day)] = lesson(block.course, block.teacher, block.room, block.note);
    if (bulkStandingInput.checked) state.standingCourses[key(source.period, day)] = true;
  });
  saveState(); renderTable(); renderCourseTools(); drawWallpaper();
  setImportStatus("Bulk-added " + block.course + " to " + selectedBulkDays().length + " day(s).", "success");
}

function addManualLesson() {
  const course = manualCourseInput.value.trim();
  if (!course) { manualCourseInput.focus(); return; }
  const cellKey = key(manualPeriodSelect.value, manualDaySelect.value);
  state.cells[cellKey] = lesson(course, manualTeacherInput.value, manualRoomInput.value, manualNoteInput.value);
  if (manualStandingInput.checked) state.standingCourses[cellKey] = true;
  else delete state.standingCourses[cellKey];
  saveState(); renderTable(); renderCourseTools(); drawWallpaper();
  setImportStatus("Added " + course + " to " + manualDaySelect.value + " " + manualPeriodSelect.value + ".", "success");
}

function runFunPlanner() {
  const occupied = Object.entries(state.cells).map(function (entry) { return { key: entry[0], cell: entry[1] }; }).filter(function (item) { return item.cell.course; });
  const counts = DAYS.map(function (day) { return occupied.filter(function (item) { return item.key.endsWith("|" + day); }).length; });
  const periods = state.periods.filter(function (period) { return /^P(?:1|[2-9]|1[0-2])$/.test(period.label); });
  const latest = function (count) { return count ? periods[Math.min(count - 1, periods.length - 1)].label : "—"; };
  const friday = counts[4];
  const earlyShare = occupied.length ? Math.round(occupied.filter(function (item) { return /^P[1-4]$/.test(item.key.split("|")[0]); }).length / occupied.length * 100) : 0;
  const scenario = funScenarioSelect ? funScenarioSelect.value : "early";
  const cards = [
    ["All lessons early", "Pack each day's lessons from P1 upward.", counts.map(latest).join(" / "), "The week keeps the same lesson counts, but every day starts as early as possible."],
    ["Friday finish first", "Compress Friday to the earliest available periods.", latest(friday), friday ? "Friday's last class would be " + latest(friday) + "." : "Friday is already free."],
    ["Fewest daily gaps", "Remove gaps inside each day while keeping day totals.", counts.reduce(function (sum, count) { return sum + count; }, 0) + " lessons", "This is a simulated layout for reducing idle gaps; it does not move or download your real data."],
  ];
  const container = document.querySelector("#funPlannerResults");
  if (container) container.innerHTML = cards.map(function (card) { return "<article class=\"fun-card\"><p class=\"eyebrow\">" + escapeHtml(card[0]) + "</p><h3>" + escapeHtml(card[2]) + "</h3><p>" + escapeHtml(card[1]) + "</p><small>" + escapeHtml(card[3]) + "</small></article>"; }).join("") + "<p class=\"fun-footnote\">Current timetable: " + occupied.length + " occupied lesson cells · P1–P4 share " + earlyShare + "%. The selected option is previewed below.</p>";
  renderFunPreview(scenario);
}

function fantasyCells(scenario) {
  const fantasy = {};
  const regularPeriods = state.periods.filter(function (period) { return /^P(?:[1-9]|1[0-2])$/.test(period.label); });
  DAYS.forEach(function (day) {
    const shouldPack = scenario === "early" || scenario === "compact" || (scenario === "friday" && day === "Friday");
    const occupied = regularPeriods.filter(function (period) { return getCell(period.label, day).course; });
    if (shouldPack) {
      occupied.forEach(function (source, index) {
        const target = regularPeriods[index];
        if (target) fantasy[key(target.label, day)] = getCell(source.label, day);
      });
    } else {
      occupied.forEach(function (period) { fantasy[key(period.label, day)] = getCell(period.label, day); });
    }
    ["P13", "P14"].forEach(function (label) {
      const cell = getCell(label, day);
      if (cell.course) fantasy[key(label, day)] = cell;
    });
  });
  return fantasy;
}

function renderFunPreview(scenario) {
  const preview = document.querySelector("#funPreview");
  if (!preview) return;
  const fantasy = fantasyCells(scenario);
  const header = "<div class=\"fun-preview-heading\"><strong>Simulated timetable preview</strong><span>Preview only · the real timetable is unchanged</span></div>";
  const tableHead = "<thead><tr><th>P</th>" + DAYS.map(function (day) { return "<th>" + day + "</th>"; }).join("") + "</tr></thead>";
  const rows = state.periods.map(function (period) {
    const cells = DAYS.map(function (day) {
      const lines = cellLines(fantasy[key(period.label, day)] || emptyCell());
      return "<td>" + lines.map(function (line, index) { return "<span class=\"" + (index === 0 ? "lesson-title" : "") + "\">" + escapeHtml(line) + "</span>"; }).join("") + "</td>";
    }).join("");
    return "<tr><th class=\"period-cell\">" + escapeHtml(period.label) + "<span>" + escapeHtml(period.time) + "</span></th>" + cells + "</tr>";
  }).join("");
  preview.innerHTML = header + "<div class=\"fun-preview-table-wrap\"><table class=\"fun-preview-table\">" + tableHead + "<tbody>" + rows + "</tbody></table></div>";
}

document.querySelectorAll("[data-add-mode]").forEach(function (button) {
  button.addEventListener("click", function () {
    document.querySelectorAll("[data-add-mode]").forEach(function (item) { item.classList.toggle("active", item === button); });
    document.querySelector("#bulkAddPane").classList.toggle("hidden", button.dataset.addMode !== "bulk");
    document.querySelector("#manualAddPane").classList.toggle("hidden", button.dataset.addMode !== "manual");
  });
});
if (bulkCourseSelect) bulkCourseSelect.addEventListener("change", updateBulkBlocks);
if (bulkAddButton) bulkAddButton.addEventListener("click", addBulkBlock);
if (manualAddButton) manualAddButton.addEventListener("click", addManualLesson);
const batchApplyButton = document.querySelector("#batchApplyButton");
const batchClearCellsButton = document.querySelector("#batchClearCellsButton");
const batchSelectAllButton = document.querySelector("#batchSelectAllButton");
const batchClearSelectionButton = document.querySelector("#batchClearSelectionButton");
if (batchApplyButton) batchApplyButton.addEventListener("click", function () { applyBatchEntry(false); });
if (batchClearCellsButton) batchClearCellsButton.addEventListener("click", function () { applyBatchEntry(true); });
if (batchSelectAllButton) batchSelectAllButton.addEventListener("click", function () {
  batchGrid.querySelectorAll("input[data-batch-cell]").forEach(function (input) { input.checked = true; });
  updateBatchSelectionStatus();
});
if (batchClearSelectionButton) batchClearSelectionButton.addEventListener("click", function () {
  batchGrid.querySelectorAll("input[data-batch-cell]").forEach(function (input) { input.checked = false; });
  updateBatchSelectionStatus();
});
const runFunPlannerButton = document.querySelector("#runFunPlannerButton");
if (runFunPlannerButton) runFunPlannerButton.addEventListener("click", runFunPlanner);
if (funScenarioSelect) funScenarioSelect.addEventListener("change", runFunPlanner);

document.querySelector("#demoButton").addEventListener("click", function () {
  applyState(makeDemoState(), "Demo timetable loaded. You can edit it or import a real PDF.", "success");
  document.querySelector("#timetableSection").scrollIntoView({ behavior: "smooth", block: "start" });
});

if (deviceSelect) deviceSelect.addEventListener("change", drawWallpaper);
if (exportModeSelect) exportModeSelect.addEventListener("change", drawWallpaper);
const downloadButton = document.querySelector("#downloadButton");
if (downloadButton) downloadButton.addEventListener("click", downloadWallpaper);

document.querySelectorAll(".quick-export").forEach(function (button) {
  button.addEventListener("click", function () {
    if (deviceSelect) deviceSelect.value = button.dataset.device;
    if (exportModeSelect) exportModeSelect.value = button.dataset.mode || "native";
    drawWallpaper();
    downloadWallpaper();
  });
});

document.querySelector("#exportJsonButton").addEventListener("click", function () {
  downloadBlob(
    new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    "campus-timetable.json"
  );
});

document.querySelector("#importButton").addEventListener("click", function () {
  importInput.click();
});

dropzone.addEventListener("click", function () {
  importInput.click();
});

dropzone.addEventListener("dragover", function (event) {
  event.preventDefault();
  dropzone.classList.add("dragging");
});

dropzone.addEventListener("dragleave", function () {
  dropzone.classList.remove("dragging");
});

dropzone.addEventListener("drop", function (event) {
  event.preventDefault();
  dropzone.classList.remove("dragging");
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) importFile(file);
});

importInput.addEventListener("change", function () {
  const file = importInput.files && importInput.files[0];
  if (file) importFile(file);
  importInput.value = "";
});

async function importFile(file) {
  const lowerName = file.name.toLowerCase();
  setImportStatus("Reading " + file.name + "…", "working");
  try {
    if (lowerName.endsWith(".json") || file.type === "application/json") {
      const parsed = JSON.parse(await file.text());
      applyState(parsed, "JSON imported. Campus rows were kept; missing P13/P14 remain blank.", "success");
      return;
    }

    if (!lowerName.endsWith(".pdf") && file.type !== "application/pdf") {
      throw new Error("Please choose an iSAMS PDF or a Pupil Timetable System JSON file.");
    }

    const items = await extractPdfTextItems(file);
    const parsed = parseIsamsPdfItems(items);
    const recognised = Object.keys(parsed.cells).length;
    if (!recognised) {
      throw new Error("The PDF opened, but no timetable cells were recognised. Try the iSAMS Print My Timetable PDF.");
    }
    applyState(
      parsed,
      "PDF imported: " + recognised + " timetable cells recognised. P13/P14 were kept when present; later rows were ignored.",
      "success"
    );
  } catch (error) {
    setImportStatus(error.message || "Could not import this file.", "error");
  }
}

async function extractPdfTextItems(file) {
  if (!window.pdfjsLib) {
    throw new Error("The PDF reader is still loading. Refresh once and try again.");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const documentProxy = await window.pdfjsLib.getDocument({ data: data }).promise;
  const items = [];

  for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
    const page = await documentProxy.getPage(pageNumber);
    const textContent = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });

    textContent.items.forEach(function (item) {
      const text = String(item.str || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      items.push({
        text: text,
        x: Number(transform[4]) || 0,
        y: Number(transform[5]) || 0,
        width: Number(item.width) || 0,
        page: pageNumber,
      });
    });
  }

  return items;
}

function isTimeText(text) {
  return /^\d{1,2}:\d{2}(?:\s*[–—-]\s*\d{1,2}:\d{2})?$/.test(String(text).trim());
}

function median(values) {
  if (!values.length) return 0;
  const ordered = values.slice().sort(function (a, b) { return a - b; });
  return ordered[Math.floor(ordered.length / 2)];
}

function parseIsamsPdfItems(items) {
  const dayItems = DAYS.map(function (day) {
    return items.find(function (item) {
      return item.text.toLowerCase() === day.toLowerCase();
    });
  }).filter(Boolean);

  if (dayItems.length < 3) {
    throw new Error("Could not find the Monday–Friday timetable header in this PDF.");
  }

  const dayCenters = DAYS.map(function (day) {
    const item = items.find(function (candidate) {
      return candidate.text.toLowerCase() === day.toLowerCase();
    });
    return item ? item.x + item.width / 2 : null;
  }).filter(function (value) { return value !== null; });

  const columnGaps = dayCenters.slice(1).map(function (center, index) {
    return center - dayCenters[index];
  }).filter(function (gap) { return gap > 0; });
  const columnStep = median(columnGaps) || 100;

  const periodRows = [];
  const seenLabels = new Set();
  items.forEach(function (item) {
    const label = normalizePeriodLabel(item.text);
    if (!label || seenLabels.has(label)) return;
    seenLabels.add(label);
    periodRows.push({
      label: label,
      y: item.y,
      items: [],
    });
  });

  if (periodRows.length < 3) {
    throw new Error("Could not find period rows in this PDF.");
  }

  periodRows.sort(function (a, b) { return b.y - a.y; });
  const gaps = periodRows.slice(1).map(function (row, index) {
    return Math.abs(periodRows[index].y - row.y);
  }).filter(function (gap) { return gap > 3; });
  const rowStep = median(gaps) || 50;
  const rowThreshold = Math.max(20, Math.min(42, rowStep * 0.68));

  function nearestRow(item) {
    if (item.y > periodRows[0].y + 4) return null;
    for (let index = 0; index < periodRows.length; index += 1) {
      const row = periodRows[index];
      const previous = periodRows[index - 1];
      const next = periodRows[index + 1];
      const previousGap = previous ? Math.abs(previous.y - row.y) : rowStep;
      const nextGap = next ? Math.abs(row.y - next.y) : previousGap;
      const top = previous
        ? previous.y - previousGap * 0.82
        : row.y + 4;
      const bottom = next
        ? next.y + nextGap * 0.18
        : row.y - previousGap * 0.82;
      if (item.y <= top && item.y >= bottom) return row;
    }

    let best = null;
    let bestDistance = Infinity;
    periodRows.forEach(function (row) {
      const distance = Math.abs(item.y - row.y);
      if (distance < bestDistance) {
        best = row;
        bestDistance = distance;
      }
    });
    return bestDistance <= rowThreshold ? best : null;
  }

  function nearestDay(item) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    dayCenters.forEach(function (center, index) {
      const distance = Math.abs(item.x + item.width / 2 - center);
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    });
    return bestDistance <= columnStep * 0.56 ? bestIndex : -1;
  }

  items.forEach(function (item) {
    const row = nearestRow(item);
    if (!row) return;
    const dayIndex = nearestDay(item);
    if (dayIndex >= 0) {
      row.items.push({ item: item, dayIndex: dayIndex });
    } else if (isTimeText(item.text)) {
      row.time = item.text;
    }
  });

  function getCellLines(row, dayIndex) {
    const cellItems = row.items
      .filter(function (entry) { return entry.dayIndex === dayIndex; })
      .sort(function (a, b) {
        if (a.item.y !== b.item.y) return b.item.y - a.item.y;
        return a.item.x - b.item.x;
      });

    const groups = [];
    cellItems.forEach(function (entry) {
      const text = entry.item.text.trim();
      const last = groups[groups.length - 1];
      if (last && Math.abs(last.y - entry.item.y) <= 2) {
        last.text += " " + text;
      } else {
        groups.push({ y: entry.item.y, text: text });
      }
    });

    const lines = [];
    groups.forEach(function (group) {
      const line = group.text.replace(/\s+/g, " ").trim();
      if (line && !isTimeText(line)) lines.push(line);
    });
    return lines;
  }

  const cells = {};
  const parsedTimes = {};
  periodRows.forEach(function (row) {
    parsedTimes[row.label] = row.time || "";
    DAYS.forEach(function (day, dayIndex) {
      const lines = getCellLines(row, dayIndex);
      if (!lines.length) return;
      cells[key(row.label, day)] = {
        course: lines[0] || "",
        teacher: lines[1] || "",
        room: lines[2] || "",
        note: lines.slice(3).join(" · "),
      };
    });
  });

  const periods = PERIODS.map(function (period) {
    return {
      label: period[0],
      time: parsedTimes[period[0]] || period[1],
    };
  });

  return {
    periods: periods,
    cells: cells,
    source: "Imported iSAMS PDF",
  };
}

function setImportStatus(message, kind) {
  importStatus.textContent = message;
  importStatus.className = "import-status " + (kind || "neutral");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function selectedExportMode() {
  return exportModeSelect && exportModeSelect.value === "p13p14" ? "p13p14" : "native";
}

function downloadWallpaper() {
  drawWallpaper();
  const filename = "CampusTimetable_" +
    (deviceSelect && deviceSelect.value === "ipad" ? "iPad" : "Phone") + "_" +
    (selectedExportMode() === "p13p14" ? "P13-P14" : "Native") + ".png";
  canvas.toBlob(function (blob) {
    if (blob) downloadBlob(blob, filename);
  }, "image/png");
}

function drawWallpaper() {
  const config = deviceSelect && deviceSelect.value === "ipad"
    ? {
      width: 2048,
      height: 2732,
      x: 112,
      y: 820,
      tableWidth: 1824,
      logoX: 112,
      logoY: 642,
      bottomMargin: 155,
      compact: false,
    }
    : {
      width: 1080,
      height: 2400,
      x: 36,
      y: 455,
      tableWidth: 1008,
      logoX: 36,
      logoY: 338,
      bottomMargin: 365,
      compact: true,
    };

  canvas.width = config.width;
  canvas.height = config.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawBrand(ctx, config);
  const periods = selectedExportMode() === "p13p14"
    ? state.periods
    : state.periods.filter(function (period) {
      return period.label !== "P13" && period.label !== "P14";
    });
  drawCanvasTable(ctx, config, periods);
}

function drawBrand(ctx, config) {
  if (logoImage.complete && logoImage.naturalWidth) {
    const width = config.compact ? 250 : 430;
    const height = width * logoImage.naturalHeight / logoImage.naturalWidth;
    ctx.drawImage(logoImage, config.logoX, config.logoY, width, height);
    return;
  }

  ctx.save();
  ctx.fillStyle = "#123f91";
  ctx.font = "700 " + (config.compact ? 24 : 38) + "px Arial";
  ctx.fillText("PUPIL TIMETABLE SYSTEM", config.logoX, config.logoY + 24);
  ctx.restore();
}

function drawCanvasTable(ctx, config, periods) {
  const headerHeight = config.compact ? 48 : 58;
  const available = config.height - config.y - config.bottomMargin - headerHeight;
  const rowWeights = periods.map(function (period) {
    if (period.label === "Reg") return 0.68;
    if (period.label === "P13") return 1.05;
    if (period.label === "P14") return 1.22;
    return 1;
  });
  const weightTotal = rowWeights.reduce(function (sum, value) { return sum + value; }, 0);
  const timeWidth = Math.round(config.tableWidth * (config.compact ? 0.105 : 0.098));
  const dayWidth = (config.tableWidth - timeWidth) / 5;
  const lineWidth = config.compact ? 1.4 : 2.2;
  const grid = "#85898c";

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = grid;
  ctx.fillStyle = "#d0d0d0";
  ctx.fillRect(config.x, config.y, config.tableWidth, headerHeight);
  ctx.strokeRect(config.x, config.y, config.tableWidth, headerHeight);
  ctx.beginPath();
  ctx.moveTo(config.x + timeWidth, config.y);
  ctx.lineTo(config.x + timeWidth, config.y + headerHeight);
  for (let i = 1; i < 5; i += 1) {
    const lineX = config.x + timeWidth + dayWidth * i;
    ctx.moveTo(lineX, config.y);
    ctx.lineTo(lineX, config.y + headerHeight);
  }
  ctx.stroke();

  ctx.fillStyle = "#3f4346";
  ctx.font = "500 " + (config.compact ? 17 : 23) + "px Arial";
  ctx.fillText("P", config.x + timeWidth / 2, config.y + headerHeight / 2);
  DAYS.forEach(function (day, index) {
    ctx.fillText(
      day,
      config.x + timeWidth + dayWidth * (index + 0.5),
      config.y + headerHeight / 2
    );
  });

  let currentY = config.y + headerHeight;
  periods.forEach(function (period, periodIndex) {
    const remaining = config.height - config.bottomMargin - currentY;
    const rowHeight = periodIndex === periods.length - 1
      ? remaining
      : Math.round((available * rowWeights[periodIndex]) / weightTotal);

    ctx.fillStyle = periodIndex % 2 === 0 ? "#fafafa" : "#ffffff";
    ctx.fillRect(config.x, currentY, config.tableWidth, rowHeight);
    ctx.strokeStyle = grid;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(config.x, currentY, config.tableWidth, rowHeight);
    ctx.beginPath();
    ctx.moveTo(config.x + timeWidth, currentY);
    ctx.lineTo(config.x + timeWidth, currentY + rowHeight);
    for (let i = 1; i < 5; i += 1) {
      const lineX = config.x + timeWidth + dayWidth * i;
      ctx.moveTo(lineX, currentY);
      ctx.lineTo(lineX, currentY + rowHeight);
    }
    ctx.stroke();

    drawPeriodLabel(ctx, config.x, currentY, timeWidth, rowHeight, period, config.compact);
    DAYS.forEach(function (day, dayIndex) {
      drawCanvasCell(
        ctx,
        config.x + timeWidth + dayWidth * dayIndex,
        currentY,
        dayWidth,
        rowHeight,
        getCell(period.label, day),
        config.compact
      );
    });
    currentY += rowHeight;
  });
  ctx.restore();
}

function drawPeriodLabel(ctx, x, y, width, height, period, compact) {
  ctx.save();
  ctx.fillStyle = "#44484b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const labelSize = Math.max(compact ? 12 : 15, Math.min(compact ? 17 : 21, height * 0.23));
  const timeSize = Math.max(compact ? 10 : 13, Math.min(compact ? 14 : 17, height * 0.18));
  const separation = Math.max(8, height * 0.13);
  ctx.font = "500 " + labelSize + "px Arial";
  ctx.fillText(period.label, x + width / 2, y + height / 2 - separation);
  ctx.font = timeSize + "px Arial";
  ctx.fillText(period.time, x + width / 2, y + height / 2 + separation);
  ctx.restore();
}

function drawCanvasCell(ctx, x, y, width, height, cell, compact) {
  const lines = cellLines(cell);
  if (!lines.length) return;
  const minimum = compact ? 10 : 13;
  const maximum = compact ? 18 : 24;
  const verticalBudget = height * 0.78;
  const base = Math.max(minimum, Math.min(maximum, verticalBudget / Math.max(lines.length * 1.16, 1)));
  const sizes = lines.map(function (_, index) {
    return Math.max(minimum, base - (index === 0 ? 0 : compact ? 1 : 2));
  });
  const gap = Math.max(compact ? 3 : 4, Math.min(compact ? 7 : 9, height * 0.055));
  const lineHeights = sizes.map(function (size) { return size * 1.12; });
  const total = lineHeights.reduce(function (sum, value) { return sum + value; }, 0) +
    gap * (lines.length - 1);
  let cursor = y + (height - total) / 2;

  ctx.save();
  ctx.fillStyle = "#3e4245";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach(function (line, index) {
    let size = sizes[index];
    ctx.font = (index === 0 ? "500 " : "400 ") + size + "px Arial";
    while (ctx.measureText(line).width > width - (compact ? 16 : 22) &&
      size > (compact ? 9 : 12)) {
      size -= 1;
      ctx.font = (index === 0 ? "500 " : "400 ") + size + "px Arial";
    }
    ctx.fillText(line, x + width / 2, cursor);
    cursor += lineHeights[index] + gap;
  });
  ctx.restore();
}

function setupGuideImages() {
  const images = Array.isArray(window.GUIDE_IMAGES) ? window.GUIDE_IMAGES : [];
  document.querySelectorAll("[data-guide-image]").forEach(function (image) {
    const index = Number(image.dataset.guideImage);
    if (images[index]) image.src = images[index];
  });
}

function showPage(page) {
  document.querySelectorAll("[data-page-section]").forEach(function (section) {
    section.classList.toggle("active", section.dataset.pageSection === page);
  });
  document.querySelectorAll("[data-page]").forEach(function (button) {
    button.classList.toggle("active", button.dataset.page === page);
  });
  if (location.hash !== "#" + page) history.replaceState(null, "", "#" + page);
  window.scrollTo(0, 0);
}

document.querySelectorAll("[data-page]").forEach(function (button) {
  button.addEventListener("click", function () {
    showPage(button.dataset.page);
    if (button.dataset.homeHelp === "true") {
      const guide = document.querySelector("#howToUse");
      if (guide) guide.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

setupGuideImages();
renderTable();
renderCourseTools();
drawWallpaper();
showPage(location.hash.slice(1) || "home");
runFunPlanner();
logoImage.addEventListener("load", drawWallpaper);
