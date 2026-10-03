const test = require("node:test");
const assert = require("node:assert/strict");
const { parse } = require("../import-csv.js");
const periods = [["Reg", "07:45"], ...Array.from({ length: 14 }, (_, i) => ["P" + (i + 1), "default time"])];
const header = "Period,Week,Time,Subject,Teacher,Room";

test("sectioned iSAMS CSV maps lessons and leaves omitted periods empty", () => {
  const result = parse("Monday\n" + header + "\nPeriod 1,Senior Week,08:00 - 08:40,Chemistry 化学,Alex Teacher,A312\nTuesday\n" + header + "\nPeriod 6 (Lunch),Senior Week,11:55 - 12:35,English,Chris Teacher,A315", "Example Student - School Timetable - Week 3.csv", periods);
  assert.equal(Object.keys(result.cells).length, 2);
  assert.deepEqual(result.cells["P1|Monday"], { course: "Chemistry 化学", teacher: "Alex Teacher", room: "A312", note: "" });
  assert.equal(result.cells["P6|Tuesday"].course, "English");
  assert.equal(result.cells["P13|Monday"], undefined);
  assert.equal(result.cells["P14|Friday"], undefined);
  assert.equal(result.profile.studentName, "Example Student");
  assert.equal(result.profile.schoolName, "");
  assert.equal(result.profile.className, "");
});

test("BOM, CRLF, quoted commas, escaped quotes and embedded newlines", () => {
  const result = parse('\uFEFFMonday\r\n' + header + '\r\nPeriod 1,Senior Week,08:00 - 08:40,"English, \"\"Language\"\"\nStudies","Teacher, A",A312\r\n', "Timetable.CSV", periods);
  assert.equal(result.cells["P1|Monday"].course, 'English, "Language" Studies');
  assert.equal(result.cells["P1|Monday"].teacher, "Teacher, A");
  assert.equal(result.profile.studentName, "");
});

test("activities and Open Period are retained, null placeholders and free periods are blank", () => {
  const result = parse("Thursday\n" + header + "\nPeriod 7,Senior Week,12:40 - 13:20,Open Period,null null,\nPeriod 11,Senior Week,15:50 - 16:30,Activities,null null,\nPeriod 12,Senior Week,16:35 - 17:15,FREE PERIOD,null null,", "Timetable.csv", periods);
  assert.equal(result.cells["P7|Thursday"].course, "Open Period");
  assert.equal(result.cells["P11|Thursday"].course, "Activities");
  assert.equal(result.cells["P11|Thursday"].teacher, "");
  assert.equal(result.cells["P12|Thursday"], undefined);
  assert.equal(result.periods.find(p => p.label === "P12").time, "16:35–17:15");
});

test("P13/P14 import when explicitly present", () => {
  const result = parse("Monday\n" + header + "\nP13,Senior Week,17:15 - 18:00,Study,Teacher,Library\nP14,Senior Week,18:15 - 20:00,Salon,Teacher,TBC", "Timetable.csv", periods);
  assert.equal(result.cells["P14|Monday"].course, "Salon");
  assert.equal(result.periods.find(p => p.label === "P14").time, "18:15–20:00");
});

test("flat CSV with Day column and reordered fields", () => {
  const result = parse("Subject,Room,Day,Teacher,Period,Time,Week\nPhysics,A407,Friday,Teacher,Period 9,14:15 - 14:55,Senior Week", "Timetable.csv", periods);
  assert.equal(result.cells["P9|Friday"].room, "A407");
});

test("invalid and conflicting records fail instead of silently dropping lessons", () => {
  assert.throws(() => parse('Monday\n' + header + '\nPeriod 1,Senior Week,08:00 - 08:40,"Unfinished', "Timetable.csv", periods), /incomplete/);
  assert.throws(() => parse("name,age\nExample,18", "Timetable.csv", periods), /not recognised/);
  assert.throws(() => parse("Monday\n" + header + "\nPeriod 1,Senior Week,08:99 - 09:40,Chemistry,Teacher,A312", "Timetable.csv", periods), /Invalid/);
  assert.throws(() => parse("Monday\n" + header + "\nPeriod 1,Senior Week,08:00 - 08:40,Chemistry,Teacher,A312\nPeriod 1,Senior Week,08:00 - 08:40,Physics,Teacher,A303", "Timetable.csv", periods), /More than one lesson/);
  assert.throws(() => parse("Monday\n" + header + "\nPeriod 1,Week A,08:00 - 08:40,Chemistry,Teacher,A312\nPeriod 2,Week B,08:45 - 09:25,Physics,Teacher,A303", "Timetable.csv", periods), /several timetable weeks/);
});
