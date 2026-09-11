const CANVAS_WIDTH = 2048;
const CANVAS_HEIGHT = 1155;

fitMenuToViewport();
window.addEventListener("resize", fitMenuToViewport);

(async function initMenu() {
  const canvas = document.getElementById("menu-canvas");

  try {
    const response = await fetch("data/menu.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load menu data: ${response.status}`);
    }

    const menu = await response.json();
    applyMenuMeta(canvas, menu.meta);
    canvas.textContent = "";
    renderMenu(canvas, menu);
  } catch (error) {
    canvas.innerHTML = `<div class="menu-loading">${error.message}</div>`;
  }
})();

function fitMenuToViewport() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scale = Math.min(viewportWidth / CANVAS_WIDTH, viewportHeight / CANVAS_HEIGHT);

  document.documentElement.style.setProperty("--menu-scale", scale);
  document.documentElement.style.setProperty("--scaled-canvas-w", `${CANVAS_WIDTH * scale}px`);
  document.documentElement.style.setProperty("--scaled-canvas-h", `${CANVAS_HEIGHT * scale}px`);
}

function applyMenuMeta(canvas, meta = {}) {
  if (meta.documentTitle) {
    document.title = meta.documentTitle;
  }

  if (meta.canvasLabel) {
    canvas.setAttribute("aria-label", meta.canvasLabel);
  }
}

function renderMenu(canvas, menu) {
  for (const column of menu.columns) {
    const columnEl = createElement("section", `menu-column menu-column-${column.id}`);

    for (const sectionId of column.sections) {
      const section = menu.sections[sectionId];
      const sectionEl = renderSection(sectionId, section, menu);
      columnEl.append(sectionEl);
    }

    canvas.append(columnEl);
  }
}

function renderSection(sectionId, section, menu) {
  const sectionEl = createElement("section", `menu-section section-${sectionId}`);
  sectionEl.dataset.layout = section.layout;
  const items = getSectionItems(sectionId, section);

  if (section.layout === "dessert-editorial") {
    sectionEl.append(renderDessert(section, items));
    return sectionEl;
  }

  sectionEl.append(renderHeader(section, menu));
  const body = createElement("div", "section-body");

  if (section.layout === "fruit-grid") {
    body.append(renderFruitGrid(items));
  } else if (section.layout === "signature-showcase") {
    body.append(renderSignatureShowcase(items));
  } else {
    items.forEach((item, index) => {
      body.append(renderStandardItem(item, index));
    });
  }

  sectionEl.append(body);
  return sectionEl;
}

function renderHeader(section, menu) {
  const header = createElement("header", "section-header");
  header.append(createElement("h2", "section-title", section.title));

  if (section.subtitle) {
    header.append(createElement("div", "section-subtitle", section.subtitle));
  }

  header.append(createElement("div", "section-rule"));

  if (section.showUtilityNote) {
    header.append(createElement("div", "section-utility", section.utilityNote ?? menu.utilityNote));
  }

  return header;
}

function renderSignatureShowcase(items) {
  const showcase = createElement("div", "signature-showcase");
  const drinkGroup = createElement("div", "signature-drink-group");
  const featuredItems = [];

  for (const item of items) {
    if (item.featured) {
      featuredItems.push(item);
      continue;
    }

    drinkGroup.append(renderSignatureDrinkItem(item));
  }

  showcase.append(drinkGroup);

  for (const item of featuredItems) {
    showcase.append(renderSignatureFeatureCard(item));
  }

  return showcase;
}

function renderSignatureDrinkItem(item) {
  const itemClasses = ["signature-item"];
  if (item.signaturePriceFirst) itemClasses.push("price-first");

  const itemEl = createElement("article", itemClasses.join(" "));

  if (item.image) {
    itemEl.append(renderImageSlot(item.image, "signature-image", item));
  }

  itemEl.append(renderItemHeading(item));

  if (item.signaturePriceFirst) {
    appendPrice(itemEl, item, "item-price");
  }

  if (item.description) {
    const description = createElement("p", "item-description", item.description);
    applyTextOverrides(description, item);
    itemEl.append(description);
  }

  if (!item.signaturePriceFirst) {
    appendPrice(itemEl, item, "item-price");
  }

  return itemEl;
}

function renderSignatureFeatureCard(item) {
  const isImageOnly = item.cardLayout === "image-only";
  const isPromo = item.cardLayout === "promo";
  const card = createElement(
    "article",
    `signature-feature-card${isImageOnly ? " image-only" : ""}${isPromo ? " promo" : ""}`
  );

  if (isImageOnly && item.image) {
    card.append(renderImageSlot(item.image, "signature-feature-design", item));
    return card;
  }

  if (isPromo) {
    const copy = createElement("div", "signature-promo-copy");

    if (item.recommendation) {
      copy.append(createElement("div", "signature-promo-recommendation", item.recommendation));
    }

    copy.append(createElement("h3", "signature-promo-title", item.name));

    if (item.subdescription) {
      copy.append(createElement("p", "signature-promo-base", item.subdescription));
    }

    if (item.description) {
      copy.append(createElement("p", "signature-promo-addons", item.description));
    }

    appendPrice(copy, item, "signature-promo-price");
    card.append(copy);

    if (item.image) {
      card.append(renderImageSlot(item.image, "signature-promo-image", item));
    }

    return card;
  }

  if (item.recommendation) {
    card.append(createElement("div", "signature-feature-ribbon", item.recommendation));
  }

  if (item.image) {
    card.append(renderImageSlot(item.image, "signature-feature-image", item));
  }

  const title = createElement("h3", "signature-feature-title");
  title.append(createElement("span", "signature-feature-name", item.name));

  if (item.detail) {
    title.append(document.createTextNode(" "));
    title.append(createElement("span", "signature-feature-detail", item.detail));
  }

  card.append(title);

  if (item.subdescription || item.price) {
    const priceRow = createElement("div", "signature-feature-price-row");

    if (item.subdescription) {
      priceRow.append(createElement("span", "signature-feature-base", item.subdescription));
    }

    appendPrice(priceRow, item, "signature-feature-price");
    card.append(priceRow);
  }

  if (item.description) {
    card.append(createElement("p", "signature-feature-addons", item.description));
  }

  return card;
}

function getSectionItems(sectionId, section) {
  return [...(section.items ?? [])]
    .filter((item) => item.section === sectionId)
    .filter((item) => item.active !== false && item.status !== "hidden")
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
}

function renderStandardItem(item, index) {
  const itemEl = createElement("article", `standard-item${item.featured ? " featured" : ""}`);
  itemEl.append(renderItemHeading(item));

  if (item.description) {
    const description = createElement("div", "item-description", item.description);
    applyTextOverrides(description, item);
    itemEl.append(description);
  }

  if (item.subdescription) {
    itemEl.append(createElement("div", "item-subdescription", item.subdescription));
  }

  appendPrice(itemEl, item, "item-price");

  if (item.image) {
    itemEl.append(renderImageSlot(item.image, `standard-image-${index + 1}`, item));
  }

  return itemEl;
}

function renderFruitGrid(items) {
  const grid = createElement("div", "fruit-grid");

  for (const item of items) {
    const itemEl = createElement("article", "fruit-item");
    itemEl.append(renderImageSlot(item.image, "fruit-image", item));
    itemEl.append(createElement("h3", "fruit-name", item.name));

    if (item.description) {
      const description = createElement("p", "fruit-description", item.description);
      applyTextOverrides(description, item);
      itemEl.append(description);
    }

    for (const badge of getItemBadges(item)) {
      itemEl.append(renderBadge(badge));
    }

    appendPrice(itemEl, item, "fruit-price");
    grid.append(itemEl);
  }

  return grid;
}

function renderDessert(section, items) {
  const stage = createElement("div", "dessert-stage");
  const titleWrap = createElement("div", "dessert-title-wrap");
  titleWrap.append(createElement("h2", "dessert-title", section.title));
  stage.append(titleWrap);

  const slots = new Map(items.map((item) => [item.slot ?? item.id, item]));
  const mangoBingsoo = slots.get("mango-bingsoo");
  const redBeanBingsoo = slots.get("redbean-bingsoo");
  const platter = slots.get("platter");
  const coupleSet = slots.get("couple-set");
  const classic = slots.get("classic");
  const lemon = slots.get("lemon");
  const matcha = slots.get("matcha");
  const butterbar = slots.get("butterbar");
  const cookie = slots.get("cookie");

  if (mangoBingsoo) stage.append(renderDessertCopy(mangoBingsoo, "dessert-copy-mango"));
  if (redBeanBingsoo) stage.append(renderDessertCopy(redBeanBingsoo, "dessert-copy-redbean"));
  if (mangoBingsoo?.image) stage.append(renderImageSlot(mangoBingsoo.image, "dessert-hero-ice", mangoBingsoo));
  if (platter?.image) stage.append(renderImageSlot(platter.image, "dessert-platter", platter));

  if (platter?.note) {
    stage.append(createElement("div", "dessert-platter-note", platter.note));
  }

  if (platter) stage.append(renderDessertCopy(platter, "dessert-copy-feature"));
  if (coupleSet) stage.append(renderDessertCopy(coupleSet, "dessert-copy-couple"));

  const row = createElement("div", "dessert-card-row");
  for (const item of [classic, lemon, matcha].filter(Boolean)) {
    row.append(renderDessertCard(item));
  }
  stage.append(row);

  if (butterbar?.image) stage.append(renderImageSlot(butterbar.image, "dessert-bar", butterbar));
  if (butterbar) stage.append(renderDessertCopy(butterbar, "dessert-copy-bottom"));
  if (cookie) stage.append(renderDessertCopy(cookie, "dessert-copy-cookie"));
  if (cookie?.image) stage.append(renderImageSlot(cookie.image, "dessert-ice-cream", cookie));

  return stage;
}

function renderDessertCopy(item, className) {
  const copy = createElement("article", `dessert-copy ${className}`);
  copy.append(renderItemHeading(item));
  applyTextOverrides(copy, item);

  if (item.description) {
    copy.append(createElement("div", "item-description", item.description));
  }

  appendPrice(copy, item, "item-price");

  return copy;
}

function renderDessertCard(item) {
  const card = createElement("article", "dessert-card");
  card.append(renderImageSlot(item.image, "", item));
  card.append(createElement("h3", "dessert-name", item.name));

  if (item.description) {
    const description = createElement("p", "dessert-description", item.description);
    applyTextOverrides(description, item);
    card.append(description);
  }

  appendPrice(card, item, "dessert-price");
  return card;
}

function renderItemHeading(item) {
  const heading = createElement("div", "item-heading");
  heading.append(createElement("span", "item-name", item.name));

  for (const label of [item.detail, item.statusLabel].filter(Boolean)) {
    heading.append(createElement("span", "item-detail", label));
  }

  for (const badge of getItemBadges(item)) {
    heading.append(renderBadge(badge));
  }

  return heading;
}

function getItemBadges(item) {
  const badges = [];
  const temperatureBadge = normalizeTemperatureBadge(item.temperature);

  if (temperatureBadge) {
    badges.push(temperatureBadge);
  }

  if (item.seasonalLabel) {
    badges.push({ label: item.seasonalLabel, tone: "season" });
  }

  if (item.recommendation) {
    badges.push({ label: item.recommendation, tone: "heart" });
  }

  badges.push(...(item.badges ?? []));
  return badges;
}

function normalizeTemperatureBadge(temperature) {
  if (!temperature) {
    return null;
  }

  if (typeof temperature === "object") {
    return temperature;
  }

  const tone = temperature.toLowerCase().includes("hot") ? "hot" : "ice";
  return { label: temperature, tone };
}

function appendPrice(parent, item, className) {
  if (item.price === null || item.price === undefined || item.price === "") {
    return;
  }

  parent.append(createElement("div", className, item.price));
}

function renderBadge(badge) {
  return createElement("span", `badge badge-${badge.tone}`, badge.label);
}

function renderImageSlot(src, className, item = {}) {
  const slot = createElement("div", `image-slot ${className}`.trim());
  applyImageOverrides(slot, item);

  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    slot.append(img);
  }

  return slot;
}

function applyImageOverrides(element, item) {
  if (item.offsetX !== undefined) element.style.left = toCssLength(item.offsetX);
  if (item.offsetY !== undefined) element.style.top = toCssLength(item.offsetY);
  if (item.imageWidth !== undefined) element.style.width = toCssLength(item.imageWidth);
  if (item.imageHeight !== undefined) element.style.height = toCssLength(item.imageHeight);
}

function applyTextOverrides(element, item) {
  if (item.textWidth !== undefined) {
    element.style.maxWidth = toCssLength(item.textWidth);
  }
}

function toCssLength(value) {
  return typeof value === "number" ? `${value}px` : value;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}
