/**
 * Loads people and courses from two CSV files into a Supabase project, and gives everyone a sign-in account.
 * Courses go through create_course, the same function as the admin's form, so their lessons are made the same way.
 * Run it again after editing the files: it adds what is missing and updates names, and changes nothing else.
 *
 *   node --env-file=<file> scripts/import-demo-data.mjs <folder> <password>
 *
 * The env file holds SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY.
 * people.csv:  תעודת זהות,שם,תפקיד     (תפקיד: סטודנט, מרצה, מתרגל או מנהל)
 * courses.csv: מספר,שם,ת.ז. מרצה,יום,התחלה,סיום,תאריך ראשון,שבועות,סטודנטים
 *              (סטודנטים: "כולם", or ID numbers separated by spaces; a course with two weekly slots has two rows)
 * Save the files as "CSV UTF-8" in Excel, so Hebrew stays readable.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const EMAIL_DOMAIN = "users.lesson.invalid";
const ROLES = { סטודנט: "student", מרצה: "teacher", מתרגל: "teacher", מנהל: "admin" };
const DAYS = { ראשון: 0, שני: 1, שלישי: 2, רביעי: 3, חמישי: 4, שישי: 5, שבת: 6 };
const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

const [folder, password] = process.argv.slice(2);
const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey } = process.env;
// The local database names the public key SUPABASE_PUBLIC_KEY (scripts/with-local-env.mjs).
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLIC_KEY;
if (!folder || !password) throw new Error("Usage: node --env-file=<file> scripts/import-demo-data.mjs <folder> <password>");
if (!url || !publicKey || !secretKey) throw new Error("SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY are needed");
if (password.length < 6) throw new Error("Supabase needs a password of at least 6 characters");

/** Reads a CSV file into objects keyed by the header row. Handles quotes and a byte-order mark. */
function readCsv(path) {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  const [header, ...body] = rows;
  return body.map((values, index) => ({ line: index + 2, ...Object.fromEntries(header.map((name, i) => [name.trim(), (values[i] ?? "").trim()])) }));
}

/** 2026-11-08, 8/11/2026 or 8.11.2026, as Excel may save it. */
function isoDate(value) {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const local = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(value);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : [];
  return y ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : null;
}

function time(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
}

const problems = [];
const people = readCsv(join(folder, "people.csv")).map((row) => {
  const person = { id: row["תעודת זהות"], name: row["שם"], role: ROLES[row["תפקיד"]] };
  if (!/^\d{5,9}$/.test(person.id ?? "")) problems.push(`people.csv line ${row.line}: the ID number must be 5 to 9 digits`);
  if (!person.name) problems.push(`people.csv line ${row.line}: the name is missing`);
  if (!person.role) problems.push(`people.csv line ${row.line}: the role must be סטודנט, מרצה, מתרגל or מנהל`);
  return person;
});
const personOf = new Map(people.map((person) => [person.id, person]));
if (personOf.size !== people.length) problems.push("people.csv: an ID number appears twice");
const students = people.filter((person) => person.role === "student");

const courses = new Map();
for (const row of readCsv(join(folder, "courses.csv"))) {
  const where = `courses.csv line ${row.line}`;
  const number = row["מספר"];
  const slot = { day: DAYS[row["יום"]], start: time(row["התחלה"]), end: time(row["סיום"]) };
  if (slot.day === undefined) problems.push(`${where}: the day must be a weekday name, such as ראשון`);
  if (!slot.start || !slot.end || slot.start >= slot.end) problems.push(`${where}: the hours must look like 09:00 and 11:00`);
  if (!courses.has(number)) {
    const teacher = personOf.get(row["ת.ז. מרצה"]);
    if (teacher?.role !== "teacher") problems.push(`${where}: the teacher must be a מרצה or מתרגל in people.csv`);
    const firstDate = isoDate(row["תאריך ראשון"]);
    const weeks = Number(row["שבועות"]);
    if (!firstDate) problems.push(`${where}: the first date must look like 2026-11-08`);
    if (!Number.isInteger(weeks) || weeks < 1) problems.push(`${where}: the number of weeks must be a whole number`);
    const listed = row["סטודנטים"] === "כולם" ? students : row["סטודנטים"].split(/\s+/).filter(Boolean).map((id) => personOf.get(id));
    if (listed.length === 0 || listed.some((person) => person?.role !== "student")) problems.push(`${where}: every student must be a סטודנט in people.csv`);
    if (!number || !row["שם"]) problems.push(`${where}: the number and the name are needed`);
    courses.set(number, { number, name: row["שם"], teacher, firstDate, weeks, students: listed, slots: [] });
  }
  courses.get(number).slots.push(slot);
}
if (!people.some((person) => person.role === "admin")) problems.push("people.csv: one מנהל is needed to create the courses");
if (problems.length > 0) {
  console.log(`Nothing was changed. Fix these first:\n${problems.join("\n")}`);
  process.exit(1);
}

const secret = createClient(url, secretKey, NO_SESSION);
const fail = (what, error) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

// 1. People: add who is missing and update names. A role is never changed here.
const { data: existing, error: readError } = await secret.from("people").select("id_number, name, role, user_id").in("id_number", [...personOf.keys()]);
fail("reading people", readError);
const known = new Map(existing.map((row) => [row.id_number, row]));
const added = people.filter((person) => !known.has(person.id));
if (added.length > 0) fail("adding people", (await secret.from("people").insert(added.map((p) => ({ id_number: p.id, name: p.name, role: p.role })))).error);
let renamed = 0;
for (const person of people.filter((p) => known.has(p.id) && known.get(p.id).name !== p.name)) {
  fail(`renaming ${person.id}`, (await secret.from("people").update({ name: person.name }).eq("id_number", person.id)).error);
  renamed++;
}
const roleChanges = people.filter((p) => known.has(p.id) && known.get(p.id).role !== p.role).map((p) => p.id);

// 2. Accounts for everyone who has none yet. The first-sign-in trigger links each one to its person.
let accounts = 0;
for (const person of people.filter((p) => !known.get(p.id)?.user_id)) {
  const { error } = await secret.auth.admin.createUser({
    email: `${person.id}@${EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { id_number: person.id },
  });
  fail(`creating the account of ${person.name}`, error);
  accounts++;
}

// 3. Courses, through the admin's own function.
const admin = people.find((person) => person.role === "admin");
const asAdmin = createClient(url, publicKey, NO_SESSION);
fail("signing in as the admin", (await asAdmin.auth.signInWithPassword({ email: `${admin.id}@${EMAIL_DOMAIN}`, password })).error);
const { data: existingCourses, error: coursesError } = await secret.from("courses").select("id, number").in("number", [...courses.keys()]);
fail("reading courses", coursesError);
const courseIdOf = new Map(existingCourses.map((row) => [row.number, row.id]));
let created = 0;
let enrolled = 0;
for (const course of courses.values()) {
  const studentRows = course.students.map((s) => ({ id_number: s.id, name: s.name }));
  if (!courseIdOf.has(course.number)) {
    const { error } = await asAdmin.rpc("create_course", {
      p_number: course.number,
      p_name: course.name,
      p_teacher: { id_number: course.teacher.id, name: course.teacher.name },
      p_weekly_hours: course.slots,
      p_first_date: course.firstDate,
      p_weeks: course.weeks,
      p_students: studentRows,
    });
    fail(`creating course ${course.number}`, error);
    created++;
    continue;
  }
  const courseId = courseIdOf.get(course.number);
  const { data: listed } = await secret.from("course_students").select("student_id_number").eq("course_id", courseId);
  const missing = course.students.filter((s) => !listed.some((row) => row.student_id_number === s.id));
  if (missing.length > 0) fail(`enrolling in ${course.number}`, (await secret.from("course_students").insert(missing.map((s) => ({ course_id: courseId, student_id_number: s.id })))).error);
  enrolled += missing.length;
}

console.log(`people added ${added.length}, renamed ${renamed}, accounts created ${accounts}`);
console.log(`courses created ${created}, already there ${courses.size - created}, students added to existing courses ${enrolled}`);
if (roleChanges.length > 0) console.log(`roles are not changed by this script: ${roleChanges.length} people have another role in the database`);
console.log("Hours, dates and teachers of existing courses are not changed: change them on the admin page.");
