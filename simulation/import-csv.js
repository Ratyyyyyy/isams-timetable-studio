(function (root) {
  "use strict";

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  function readCsv(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    let closedQuote = false;
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (quoted) {
        if (char === '"') {
          if (source[i + 1] === '"') { field += '"'; i += 1; }
          else { quoted = false; closedQuote = true; }
        } else field += char;
      } else if (char === ",") {
        row.push(field); field = ""; closedQuote = false;
      } else if (char === "\n" || char === "\r") {
        row.push(field); rows.push(row); row = []; field = ""; closedQuote = false;
        if (char === "\r" && source[i + 1] === "\n") i += 1;
      } else if (char === '"' && !field.trim() && !closedQuote) {
        field = ""; quoted = true;
      } else if (closedQuote) {
        if (!/\s/.test(char)) throw new Error("Invalid CSV quoting. Download the original CSV from iSAMS.");
      } else {
        if (char === '"') throw new Error("Invalid CSV quoting. Download the original CSV from iSAMS.");
        field += char;
      }
    }
    if (quoted) throw new Error("The CSV is incomplete. Download it again from iSAMS.");
    row.push(field);
    if (row.some(function (value) { return value.trim(); })) rows.push(row);
    return rows;
  }

  function clean(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return /^(?:null|undefined|n\/a)(?:\s+(?:null|undefined|n\/a))*$/i.test(text) ? "" : text;
  }

  function periodLabel(value) {
    const text = clean(value);
    if (/^(?:reg|registration)(?:\s+period)?$/i.test(text)) return "Reg";
    const match = text.match(/^(?:period\s*|p\s*)0*(\d{1,2})(?:\s*\([^)]*\))?$/i);
    return match && Number(match[1]) >= 1 && Number(match[1]) <= 14 ? "P" + Number(match[1]) : null;
  }

  function normalizeTime(value) {
    const match = clean(value).match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const start = Number(match[1]) * 60 + Number(match[2]);
    const end = Number(match[3]) * 60 + Number(match[4]);
    if (Number(match[1]) > 23 || Number(match[3]) > 23 || Number(match[2]) > 59 || Number(match[4]) > 59 || end <= start) return null;
    return match[1].padStart(2, "0") + ":" + match[2] + "–" + match[3].padStart(2, "0") + ":" + match[4];
  }

  function parse(text, filename, defaultPeriods) {
    const rows = readCsv(text);
    const cells = {};
    const times = {};
    const weeks = new Set();
    let day = null;
    let columns = null;
    let foundHeader = false;
    rows.forEach(function (values, index) {
      if (!values.some(function (value) { return value.trim(); })) return;
      const first = clean(values[0]);
      const headingDay = DAYS.find(function (value) { return value.toLowerCase() === first.toLowerCase(); });
      if (headingDay && values.slice(1).every(function (value) { return !value.trim(); })) {
        day = headingDay; columns = null; return;
      }
      const headings = values.map(function (value) { return clean(value).toLowerCase(); });
      if (headings.includes("period") && headings.includes("subject")) {
        columns = {};
        ["period", "week", "time", "subject", "teacher", "room", "day"].forEach(function (name) { columns[name] = headings.indexOf(name); });
        if (columns.time < 0 || columns.teacher < 0 || columns.room < 0) throw new Error("CSV columns missing. Download the School Timetable CSV from iSAMS.");
        foundHeader = true; return;
      }
      if (!columns) throw new Error("CSV format not recognised at row " + (index + 1) + ". Use the original iSAMS School Timetable CSV.");
      const rowDay = columns.day >= 0
        ? DAYS.find(function (value) { return value.toLowerCase() === clean(values[columns.day]).toLowerCase(); })
        : day;
      const label = periodLabel(values[columns.period]);
      const time = normalizeTime(values[columns.time]);
      if (!rowDay || !label || !time) throw new Error("Invalid day, period or time at CSV row " + (index + 1) + ".");
      if (times[label] && times[label] !== time) throw new Error(label + " has different times in this CSV. Export one timetable week at a time.");
      times[label] = time;
      const week = columns.week >= 0 ? clean(values[columns.week]) : "";
      if (week) weeks.add(week);
      const course = clean(values[columns.subject]);
      if (!course || /^free(?:\s+period)?$/i.test(course)) return;
      const cellKey = label + "|" + rowDay;
      const cell = { course: course, teacher: clean(values[columns.teacher]), room: clean(values[columns.room]), note: "" };
      if (cells[cellKey] && JSON.stringify(cells[cellKey]) !== JSON.stringify(cell)) throw new Error("More than one lesson at " + rowDay + " " + label + ". Export one timetable week at a time.");
      cells[cellKey] = cell;
    });
    if (!foundHeader) throw new Error("CSV format not recognised. Use the iSAMS School Timetable download.");
    if (weeks.size > 1) throw new Error("This CSV contains several timetable weeks. Export one week at a time.");
    if (!Object.keys(cells).length) throw new Error("No lessons found in this CSV. Check the selected timetable week in iSAMS.");
    const name = String(filename || "").replace(/^.*[\\/]/, "").match(/^(.*?)\s+[-–—]\s+School Timetable(?:\s+[-–—].*)?\.csv$/i);
    return {
      periods: defaultPeriods.map(function (period) { return { label: period[0], time: times[period[0]] || period[1] }; }),
      cells: cells,
      profile: { schoolName: "", studentName: name ? name[1].trim() : "", className: "" },
      personalBlocks: [],
      standingCourses: {},
      source: "Imported iSAMS CSV" + (weeks.size ? " · " + Array.from(weeks)[0] : "")
    };
  }

  const api = { parse: parse };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.IsamsCsv = api;
})(typeof window !== "undefined" ? window : globalThis);
