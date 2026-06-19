import assert from "node:assert/strict";
import { calculateAvailability } from "./calculate";

const date = "2026-06-15";
const now = new Date(2026, 5, 14, 8, 0);
const settings = {
  buffer_minutes: 0,
  minimum_notice_minutes: 0,
  booking_window_days: 30,
  slot_step_minutes: 30,
};
const workingHours = [{ weekday: 1, start_time: "09:00", end_time: "12:00", is_active: true }];

function slotLabels(input: Partial<Parameters<typeof calculateAvailability>[0]> = {}) {
  return calculateAvailability({
    date,
    durationMinutes: 60,
    settings,
    workingHours,
    breaks: [],
    blocks: [],
    appointments: [],
    now,
    ...input,
  }).map((slot) => `${slot.start_time}-${slot.end_time}`);
}

assert.deepEqual(
  slotLabels({
    appointments: [{ appointment_date: date, start_time: "10:00", end_time: "11:00", status: "confirmed" }],
  }),
  ["09:00-10:00", "11:00-12:00"],
  "confirmed appointments must remove overlapping slots",
);

assert.deepEqual(
  slotLabels({
    breaks: [{ weekday: 1, start_time: "10:00", end_time: "11:00", is_active: true }],
  }),
  ["09:00-10:00", "11:00-12:00"],
  "professional breaks must remove overlapping slots",
);

assert.deepEqual(
  slotLabels({
    blocks: [{ block_date: date, is_full_day: false, start_time: "09:30", end_time: "10:30", is_active: true }],
  }),
  ["10:30-11:30", "11:00-12:00"],
  "partial schedule blocks must remove overlapping slots",
);

assert.deepEqual(
  slotLabels({
    blocks: [{ block_date: date, is_full_day: true, start_time: null, end_time: null, is_active: true }],
  }),
  [],
  "full-day blocks must remove every slot",
);

assert.deepEqual(
  slotLabels({ durationMinutes: 240 }),
  [],
  "services longer than the working window must not fit",
);

assert.deepEqual(
  slotLabels({
    settings: { ...settings, buffer_minutes: 15 },
    appointments: [{ appointment_date: date, start_time: "10:00", end_time: "11:00", status: "confirmed" }],
  }),
  ["11:00-12:00"],
  "buffer time must protect the end of each candidate slot",
);

assert.deepEqual(
  slotLabels({
    now: new Date(2026, 5, 15, 9, 40),
    settings: { ...settings, minimum_notice_minutes: 60 },
  }),
  ["11:00-12:00"],
  "minimum notice must remove slots that start too soon",
);

console.log("availability checks passed");
