import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const menuPath = resolve(root, "data/menu.json");
const validStatuses = new Set(["active", "paused", "hidden", "seasonal"]);
const requiredDessertSlots = new Set([
  "mango-bingsoo",
  "redbean-bingsoo",
  "platter",
  "couple-set",
  "classic",
  "lemon",
  "matcha",
  "butterbar",
  "cookie"
]);

const warnings = [];
const errors = [];

let menu;

try {
  menu = JSON.parse(readFileSync(menuPath, "utf8"));
} catch (error) {
  console.error(`Unable to read ${menuPath}: ${error.message}`);
  process.exit(1);
}

if (menu.canvas?.width !== 2048 || menu.canvas?.height !== 1155) {
  warn("canvas", "canvas should remain exactly 2048 x 1155");
}

if (!Array.isArray(menu.columns)) {
  error("columns", "missing columns array");
}

if (!menu.sections || typeof menu.sections !== "object") {
  error("sections", "missing sections object");
}

const ids = new Map();

for (const column of menu.columns ?? []) {
  if (!column.id) {
    error("columns", "column is missing id");
  }

  if (!Array.isArray(column.sections)) {
    error(`column ${column.id ?? "unknown"}`, "column is missing sections array");
    continue;
  }

  for (const sectionId of column.sections) {
    if (!menu.sections?.[sectionId]) {
      error(`column ${column.id}`, `unknown section "${sectionId}"`);
    }
  }
}

for (const [sectionId, section] of Object.entries(menu.sections ?? {})) {
  if (!section.title) {
    error(`section ${sectionId}`, "missing title");
  }

  if (!section.layout) {
    error(`section ${sectionId}`, "missing layout");
  }

  if (!Array.isArray(section.items)) {
    error(`section ${sectionId}`, "missing items array");
    continue;
  }

  const orders = new Set();
  const slots = new Set();

  for (const item of section.items) {
    validateItem(sectionId, section.layout, item, ids, orders, slots);
  }

  if (section.layout === "dessert-editorial") {
    for (const slot of requiredDessertSlots) {
      if (!slots.has(slot)) {
        warn(`section ${sectionId}`, `dessert layout is missing slot "${slot}"`);
      }
    }
  }
}

for (const message of warnings) {
  console.warn(`WARNING ${message}`);
}

for (const message of errors) {
  console.error(`ERROR ${message}`);
}

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log(`Validation passed with ${warnings.length} warning(s).`);

function validateItem(sectionId, layout, item, ids, orders, slots) {
  const context = item?.id ? `item ${item.id}` : `section ${sectionId}`;

  for (const field of ["id", "section", "order", "active", "status", "name"]) {
    if (!hasOwn(item, field)) {
      error(context, `missing required field "${field}"`);
    }
  }

  if (!hasOwn(item, "price")) {
    warn(context, "missing price field; use null for intentionally hidden prices");
  }

  if (!hasOwn(item, "image")) {
    warn(context, "missing image field; use null when no product image should render");
  }

  if (item.id) {
    if (ids.has(item.id)) {
      error(context, `duplicate id also used by ${ids.get(item.id)}`);
    } else {
      ids.set(item.id, sectionId);
    }
  }

  if (item.section !== sectionId) {
    error(context, `section field should be "${sectionId}"`);
  }

  if (typeof item.order !== "number") {
    error(context, "order must be a number");
  } else if (orders.has(item.order)) {
    warn(`section ${sectionId}`, `duplicate display order ${item.order}`);
  } else {
    orders.add(item.order);
  }

  if (typeof item.active !== "boolean") {
    error(context, "active must be true or false");
  }

  if (!validStatuses.has(item.status)) {
    error(context, `invalid status "${item.status}"`);
  }

  if (item.status === "paused" && !item.statusLabel) {
    warn(context, "paused item should include statusLabel");
  }

  if (item.status === "seasonal" && !item.seasonalLabel) {
    warn(context, "seasonal item should include seasonalLabel");
  }

  if (item.price === "") {
    warn(context, "price is an empty string; use a price value or null");
  }

  if (item.image === "") {
    warn(context, "image is an empty string; use a path or null");
  }

  if (typeof item.image === "string" && item.image && !existsSync(resolve(root, item.image))) {
    warn(context, `image file does not exist: ${item.image}`);
  }

  if (layout === "fruit-grid" && item.active !== false && item.status !== "hidden" && !item.image) {
    warn(context, "fruit card is missing a product image");
  }

  if (layout === "dessert-editorial" && item.slot) {
    slots.add(item.slot);
  }

  if (item.temperature && !isTemperatureValid(item.temperature)) {
    warn(context, "temperature should be \"ice only\", \"hot only\", or a badge object");
  }

  checkOverflow(context, layout, item.description);
  checkOverflow(context, layout, item.subdescription);
}

function checkOverflow(context, layout, text) {
  if (!text) {
    return;
  }

  const lines = String(text).split("\n");
  const longestLine = Math.max(...lines.map((line) => [...line].length));
  const totalLength = [...String(text).replace(/\s+/g, "")].length;
  const threshold = layout === "fruit-grid"
    ? { line: 34, total: 90 }
    : layout === "dessert-editorial"
      ? { line: 74, total: 150 }
      : { line: 84, total: 170 };

  if (longestLine > threshold.line || totalLength > threshold.total) {
    warn(
      context,
      `description may overflow: longest line ${longestLine}, compact length ${totalLength}`
    );
  }
}

function isTemperatureValid(temperature) {
  if (typeof temperature === "object") {
    return Boolean(temperature.label && temperature.tone);
  }

  return temperature === "ice only" || temperature === "hot only";
}

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value ?? {}, field);
}

function warn(context, message) {
  warnings.push(`[${context}] ${message}`);
}

function error(context, message) {
  errors.push(`[${context}] ${message}`);
}
