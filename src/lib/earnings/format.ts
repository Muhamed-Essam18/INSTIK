import { CURRENCY } from "./rules";

// Display helpers for money, shares and days (spec 11). Pure: integer arithmetic only, no floats on an amount.

const withCommas = (whole: number) => String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Euros with a euro sign, thousands separators and two decimals; a negative amount has a minus before the sign. Other currencies show their code first. */
export function formatMoney(cents: number, currency: string = CURRENCY): string {
  const abs = Math.abs(cents);
  const text = `${withCommas(Math.trunc(abs / 100))}.${String(abs % 100).padStart(2, "0")}`;
  const sign = cents < 0 ? "−" : "";
  return currency === "EUR" ? `${sign}€${text}` : `${sign}${currency} ${text}`;
}

export const formatEuros = (cents: number): string => formatMoney(cents, "EUR");

/** A share to one decimal place ("40.0%"), for display only; money is never computed from it. */
export function formatPercent(views: number, total: number): string {
  if (total <= 0 || views <= 0) return "0.0%";
  const tenths = Math.round((views * 1000) / total);
  return `${Math.trunc(tenths / 10)}.${tenths % 10}%`;
}

/** A share given in basis points (1/100 of a percent) to one decimal place: 4000 is "40.0%". Display only. */
export function formatBasisPoints(basisPoints: number): string {
  const tenths = Math.round(basisPoints / 10);
  return `${Math.trunc(tenths / 10)}.${tenths % 10}%`;
}

/** Plain digits for an input field: "3000.00" (no sign, no separators). */
export const formatPlainEuros = (cents: number): string => `${Math.trunc(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;

const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const dayLabelYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const monthOnly = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

const dayToDate = (day: string) => new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)));

/** "5 December", or "5 December 2026" when `withYear` is true, from a "YYYY-MM-DD" day. */
export const formatDay = (day: string, withYear = false): string => (withYear ? dayLabelYear : dayLabel).format(dayToDate(day));

const dayShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "5 Nov" from a "YYYY-MM-DD" day. */
export const formatDayShort = (day: string): string => dayShort.format(dayToDate(day));

/** Watch time as hours: "186h", "61h", "2.5h" or "0.5h" (one decimal below 10 hours). */
export function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  const value = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
  return `${value}h`;
}

/** An average share (0 to 1) as a whole percent: "74%". */
export const formatShare = (share: number): string => `${Math.round(share * 100)}%`;

/** "November 2026" from a "YYYY-MM" month key. */
export const formatMonth = (key: string): string => monthLabel.format(dayToDate(`${key}-01`));

/** "November" from a "YYYY-MM" month key. */
export const formatMonthName = (key: string): string => monthOnly.format(dayToDate(`${key}-01`));
