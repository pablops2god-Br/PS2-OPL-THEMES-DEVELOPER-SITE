const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;

const state = {
  files: {},
  sections: {},
  order: [],
  selectedId: null,
  assetUrls: new Map(),
  assetDimensions: new Map(),
  currentDevice: "USB",
  screenWidth: DEFAULT_WIDTH,
  screenHeight: DEFAULT_HEIGHT,
  layoutWidth: DEFAULT_WIDTH,
  layoutHeight: DEFAULT_HEIGHT,
  autoConvertResolution: false,
  zoom: 100,
  showGrid: true,
  gridSize: 16,
  snapGrid: true,
  snapObjects: true,
  history: [],
  future: [],
  panX: 0,
  panY: 0,
  isSpaceDown: false,
  lockRatio: false,
  activeRatio: null
};

const els = {
  folderTree: document.getElementById("folderTree"),
  assetGrid: document.getElementById("assetGrid"),
  canvas: document.getElementById("canvasContent"),
  screen: document.getElementById("oplScreen"),
  layerList: document.getElementById("layerList"),
  status: document.getElementById("statusMsg"),
  validation: document.getElementById("validationList"),
  propsPanel: document.getElementById("propsPanel"),
  emptyProps: document.getElementById("emptyProps"),
  stage: document.getElementById("oplStage"),
  stageWrap: document.querySelector(".stage-wrap")
};

const propIds = [
  "propId",
  "propType",
  "propX",
  "propY",
  "propW",
  "propH",
  "propColor",
  "propDefault",
  "propPattern",
  "propAlign",
  "propScaled"
];

function updateStatus(message) {
  els.status.textContent = message;
}

function cloneThemeState() {
  return {
    sections: JSON.parse(JSON.stringify(state.sections)),
    order: [...state.order],
    selectedId: state.selectedId,
    screenWidth: state.screenWidth,
    screenHeight: state.screenHeight,
    layoutWidth: state.layoutWidth,
    layoutHeight: state.layoutHeight,
    autoConvertResolution: state.autoConvertResolution,
    showGrid: state.showGrid,
    gridSize: state.gridSize,
    snapGrid: state.snapGrid,
    snapObjects: state.snapObjects
  };
}

function restoreThemeState(snapshot) {
  state.sections = JSON.parse(JSON.stringify(snapshot.sections));
  state.order = [...snapshot.order];
  state.selectedId = snapshot.selectedId;
  state.screenWidth = snapshot.screenWidth || DEFAULT_WIDTH;
  state.screenHeight = snapshot.screenHeight;
  state.layoutWidth = snapshot.layoutWidth || state.screenWidth;
  state.layoutHeight = snapshot.layoutHeight || state.screenHeight;
  state.autoConvertResolution = Boolean(snapshot.autoConvertResolution);
  state.showGrid = snapshot.showGrid;
  state.gridSize = snapshot.gridSize;
  state.snapGrid = snapshot.snapGrid;
  state.snapObjects = snapshot.snapObjects;
  syncEditorControls();
  renderAll();
}

function pushHistory() {
  state.history.push(cloneThemeState());
  if (state.history.length > 80) state.history.shift();
  state.future = [];
}

function undo() {
  if (!state.history.length) {
    updateStatus("Nada para desfazer.");
    return;
  }
  state.future.push(cloneThemeState());
  restoreThemeState(state.history.pop());
  updateStatus("Acao desfeita.");
}

function redo() {
  if (!state.future.length) {
    updateStatus("Nada para refazer.");
    return;
  }
  state.history.push(cloneThemeState());
  restoreThemeState(state.future.pop());
  updateStatus("Acao refeita.");
}

function syncEditorControls() {
  document.getElementById("resolutionSelect").value = `${state.screenWidth}x${state.screenHeight}`;
  document.getElementById("autoConvertToggle").checked = state.autoConvertResolution;
  document.getElementById("showGridToggle").checked = state.showGrid;
  document.getElementById("gridSizeInput").value = state.gridSize;
  document.getElementById("snapGridToggle").checked = state.snapGrid;
  document.getElementById("snapObjectsToggle").checked = state.snapObjects;
}

function normalizeAssetName(path) {
  return stripExtension(path.split("/").pop()).toLowerCase();
}

function stripExtension(value) {
  return String(value || "").replace(/\.(png|jpg|jpeg|webp)$/i, "");
}

function normalizeLookupKey(value) {
  return stripExtension(String(value || "").replace(/\\/g, "/").trim()).toLowerCase();
}

function parseCfg(text) {
  const sections = {};
  const order = [];
  let current = "__global";
  let props = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const sectionMatch = line.match(/^([A-Za-z0-9_]+):$/);
    if (sectionMatch) {
      if (Object.keys(props).length) {
        sections[current] = props;
        order.push(current);
      }
      current = sectionMatch[1];
      props = {};
      continue;
    }

    const equalIndex = line.indexOf("=");
    if (equalIndex === -1) continue;
    const key = line.slice(0, equalIndex).trim();
    const value = line.slice(equalIndex + 1).trim();
    if (key) props[key] = value;
  }

  if (Object.keys(props).length) {
    sections[current] = props;
    order.push(current);
  }

  return { sections, order };
}

function generateCfg() {
  const lines = [];

  for (const id of state.order) {
    const props = state.sections[id];
    if (!props) continue;

    if (id === "__global") {
      for (const [key, value] of Object.entries(props)) {
        if (value !== "") lines.push(`${key}=${value}`);
      }
      lines.push("");
      continue;
    }

    lines.push(`${id}:`);
    for (const [key, value] of Object.entries(props)) {
      if (value !== undefined && value !== null && String(value) !== "") {
        lines.push(`\t${key}=${value}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

function createStarterTheme() {
  if (state.order.length) pushHistory();
  state.files = {};
  state.assetUrls.clear();
  state.sections = {
    "__global": {
      bg_color: "#080A10",
      text_color: "#E9EEF2",
      sel_text_color: "#30C7D9",
      ui_text_color: "#FFFFFF"
    },
    main0: { type: "Background", color: "#080A10" },
    main1: { type: "ItemsList", x: "52", y: "98", width: "310", height: "272", color: "#E9EEF2" },
    main2: { type: "ItemCover", x: "430", y: "86", width: "148", height: "214", default: "cover_default" },
    main3: { type: "MenuText", x: "250", y: "28", width: "140", height: "28", color: "#FFFFFF", aligned: "1" },
    main4: { type: "HintText", x: "80", y: "410", width: "480", height: "24", color: "#9AA3AD", aligned: "1" }
  };
  state.order = Object.keys(state.sections);
  state.selectedId = "main1";
  state.screenWidth = DEFAULT_WIDTH;
  state.screenHeight = DEFAULT_HEIGHT;
  state.layoutWidth = DEFAULT_WIDTH;
  state.layoutHeight = DEFAULT_HEIGHT;
  syncEditorControls();
  renderAll();
  updateStatus("Novo tema base criado.");
}

async function prepareImages(files) {
  for (const url of state.assetUrls.values()) URL.revokeObjectURL(url);
  state.assetUrls.clear();
  state.assetDimensions.clear();

  for (const [path, file] of Object.entries(files)) {
    if (!/\.(png|jpg|jpeg|webp)$/i.test(path)) continue;
    const url = URL.createObjectURL(file);
    const fullKey = normalizeLookupKey(path);
    const baseKey = normalizeAssetName(path);
    state.assetUrls.set(fullKey, url);
    state.assetUrls.set(baseKey, url);
    const dimensions = await readImageDimensions(url);
    state.assetDimensions.set(fullKey, dimensions);
    state.assetDimensions.set(baseKey, dimensions);
  }
}

function readImageDimensions(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function loadThemeFromFiles(fileList) {
  const files = {};
  let cfgFile = null;

  for (const file of fileList) {
    const path = (file.webkitRelativePath || file.name).replace(/\\/g, "/");
    files[path] = file;
    if (/\/?(conf_theme|theme)\.cfg$/i.test(path)) cfgFile = file;
  }

  if (!cfgFile) {
    updateStatus("Nenhum conf_theme.cfg ou theme.cfg encontrado.");
    return;
  }

  if (state.order.length) pushHistory();
  const parsed = parseCfg(await cfgFile.text());
  state.files = files;
  state.sections = parsed.sections;
  state.order = parsed.order;
  state.selectedId = state.order.find((id) => id !== "__global") || null;

  await prepareImages(files);
  autoDetectScreenHeight();
  renderAll();
  updateStatus(`Tema carregado com ${Object.keys(files).length} arquivos.`);
}

function autoDetectScreenHeight() {
  const frame = Object.values(state.sections).find((section) => section.default && section.type === "StaticImage");
  const background = Object.values(state.sections).find((section) => section.type === "Background");
  const dimensions = findAssetDimensions(...imageCandidates("frame", frame || {}))
    || findAssetDimensions(...imageCandidates("background", background || {}));
  if (dimensions && [448, 480, 512, 720, 1080].includes(dimensions.height)) {
    state.screenWidth = dimensions.width || DEFAULT_WIDTH;
    state.screenHeight = dimensions.height;
    state.layoutWidth = state.screenWidth;
    state.layoutHeight = state.screenHeight;
  }
  syncEditorControls();
}

function buildFolderTree() {
  const root = {};

  for (const path of Object.keys(state.files)) {
    const parts = path.split("/");
    let node = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        node[part] = { file: true };
      } else {
        node[part] ||= { file: false, children: {} };
        node = node[part].children;
      }
    });
  }

  function renderNode(node) {
    return Object.entries(node).map(([name, info]) => {
      if (info.file) return `<div class="tree-file">${name}</div>`;
      return `<div class="tree-folder">${name}<div class="tree-children">${renderNode(info.children)}</div></div>`;
    }).join("");
  }

  els.folderTree.innerHTML = Object.keys(root).length ? renderNode(root) : "Nenhum arquivo no projeto.";
}

function renderAssetGrid() {
  els.assetGrid.innerHTML = "";
  const renderedUrls = new Set();
  for (const [name, url] of state.assetUrls.entries()) {
    if (renderedUrls.has(url)) continue;
    renderedUrls.add(url);
    const tile = document.createElement("button");
    tile.className = "asset-tile";
    tile.type = "button";
    tile.innerHTML = `<img src="${url}" alt=""><span>${name}</span>`;
    tile.addEventListener("click", () => {
      if (!state.selectedId) return;
      state.sections[state.selectedId].default = name;
      fillProps();
      renderCanvas();
      updateStatus(`Asset aplicado: ${name}`);
    });
    els.assetGrid.appendChild(tile);
  }
}

function parseDimension(value, fallback, axis) {
  if (value === "DIM_INF" || value === "-1") return axis === "x" ? state.screenWidth : state.screenHeight;
  if (value === "POS_MID") return axis === "x" ? state.screenWidth / 2 : state.screenHeight / 2;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function resolveElementBox(props) {
  const dimensions = findAssetDimensions(...imageCandidates("element", props));
  const width = parseDimension(props.width || props.w, dimensions?.width || defaultElementWidth(props), "x");
  const height = parseDimension(props.height || props.h, dimensions?.height || defaultElementHeight(props), "y");
  const rawX = resolvePosition(props.x, width, state.screenWidth, "x");
  const rawY = resolvePosition(props.y, height, state.screenHeight, "y");
  return {
    left: Math.round(rawX),
    top: Math.round(rawY),
    width: Math.round(width),
    height: Math.round(height)
  };
}

function resolvePosition(value, size, limit, axis) {
  if (value === "POS_MID") return (limit - size) / 2;
  const parsed = parseDimension(value, 0, axis);
  if (Number.isFinite(parsed) && parsed < 0) return limit + parsed - size;
  return parsed;
}

function serializePosition(pixel, size, limit, originalValue) {
  const original = Number.parseFloat(originalValue);
  if (Number.isFinite(original) && original < 0) {
    return String(Math.round(pixel + size - limit));
  }
  return String(Math.round(pixel));
}

function defaultElementWidth(props) {
  if (props.type === "ItemCover") return 140;
  if (props.type === "ItemIcon" || props.type === "MenuIcon" || props.type === "LoadingIcon") return 42;
  if (props.type === "MenuText" || props.type === "HintText" || props.type === "ItemText") return 220;
  if (props.type === "ItemsList") return 320;
  return 120;
}

function defaultElementHeight(props) {
  if (props.type === "ItemCover") return 200;
  if (props.type === "ItemIcon" || props.type === "MenuIcon" || props.type === "LoadingIcon") return 42;
  if (props.type === "ItemsList") return 260;
  return 36;
}

function getRenderableSections() {
  if (state.currentDevice === "INFO") {
    return state.order.filter((id) => /^info\d+$/i.test(id));
  }
  if (["APPS", "PS1"].includes(state.currentDevice)) {
    const elmSections = state.order.filter((id) => /^mainELM\d+$/i.test(id));
    if (elmSections.length) return elmSections;
  }
  return state.order.filter((id) => /^main\d+$/i.test(id));
}

function currentSectionPrefix() {
  if (state.currentDevice === "INFO") return "info";
  if (["APPS", "PS1"].includes(state.currentDevice)) {
    return state.order.some((id) => /^mainELM\d+$/i.test(id)) ? "mainELM" : "main";
  }
  return "main";
}

function updateTabModeLabel() {
  const label = document.getElementById("tabModeLabel");
  if (!label) return;
  if (state.currentDevice === "INFO") {
    label.textContent = "INFO usa grupo info";
  } else if (["APPS", "PS1"].includes(state.currentDevice) && currentSectionPrefix() === "mainELM") {
    label.textContent = "APPS/PS1 usam grupo mainELM";
  } else {
    label.textContent = "USB/HDD/ETH compartilham main";
  }
}

function findAssetUrl(...names) {
  for (const name of names) {
    if (!name) continue;
    const key = normalizeLookupKey(name);
    if (state.assetUrls.has(key)) return state.assetUrls.get(key);
    const base = key.split("/").pop();
    if (state.assetUrls.has(base)) return state.assetUrls.get(base);
  }
  return null;
}

function findAssetDimensions(...names) {
  for (const name of names) {
    if (!name) continue;
    const key = normalizeLookupKey(name);
    if (state.assetDimensions.has(key)) return state.assetDimensions.get(key);
    const base = key.split("/").pop();
    if (state.assetDimensions.has(base)) return state.assetDimensions.get(base);
  }
  return null;
}

function imageCandidates(id, props) {
  const candidates = [];
  const type = props.type || "";

  if (props.default) candidates.push(props.default);
  if (props.image) candidates.push(props.image);
  if (props.texture) candidates.push(props.texture);

  if (type === "ItemIcon") candidates.push("disc", "ico", "default_ico", "item_icon");
  if (type === "ItemCover") candidates.push("cover", "cover_default", "default_cov", "cov");
  if (type === "LoadingIcon") candidates.push("loading", "load", "busy");

  if (type === "MenuIcon") {
    const device = state.currentDevice.toLowerCase();
    candidates.push(device, `menu_${device}`, `${device}_icon`, `icon_${device}`);
    candidates.push("usb", "menu_icon", "icon");
  }

  if (type === "Background") candidates.push("background", "bg");
  if (props.pattern) candidates.push(props.pattern);
  candidates.push(id);

  return candidates;
}

function renderCanvas() {
  updateTabModeLabel();
  els.canvas.innerHTML = "";
  els.canvas.classList.toggle("show-grid", state.showGrid);
  els.canvas.style.setProperty("--grid-size", `${state.gridSize}px`);
  els.screen.style.width = `${state.screenWidth}px`;
  els.screen.style.height = `${state.screenHeight}px`;
  els.screen.style.setProperty("--zoom", String(state.zoom / 100));
  els.screen.style.setProperty("--pan-x", `${state.panX}px`);
  els.screen.style.setProperty("--pan-y", `${state.panY}px`);
  els.screen.style.margin = `${Math.max(0, (state.zoom - 100) * 2)}px`;
  els.canvas.style.background = state.sections.__global?.bg_color || "#080A10";

  const background = Object.values(state.sections).find((section) => section.type === "Background");
  if (background) {
    const bgUrl = findAssetUrl(...imageCandidates("background", background));
    if (bgUrl) els.canvas.style.background = `url("${bgUrl}") center / cover no-repeat`;
  }

  for (const id of getRenderableSections()) {
    const props = state.sections[id];
    if (!props || props.type === "Background") continue;

    const box = resolveElementBox(props);
    const node = document.createElement("div");

    node.className = "opl-element";
    if (state.selectedId === id) node.classList.add("is-selected");
    node.dataset.id = id;
    node.style.left = `${box.left}px`;
    node.style.top = `${box.top}px`;
    node.style.width = `${box.width}px`;
    node.style.height = `${box.height}px`;
    node.style.color = props.color || state.sections.__global?.text_color || "#E9EEF2";
    node.style.zIndex = String(20 + state.order.indexOf(id));

    const imageUrl = findAssetUrl(...imageCandidates(id, props));

    if (imageUrl) {
      node.style.backgroundImage = `url("${imageUrl}")`;
      node.style.backgroundSize = props.scaled === "1" ? "cover" : "contain";
    } else {
      node.classList.add("is-placeholder");
      node.textContent = placeholderText(id, props);
    }

    node.addEventListener("pointerdown", (event) => startDrag(event, node, id));
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      selectElement(id);
    });

    for (const handleType of ["n", "e", "s", "w", "ne", "se", "sw", "nw"]) {
      const resize = document.createElement("span");
      resize.className = `resize-handle resize-handle--${handleType}`;
      resize.dataset.resize = handleType;
      resize.addEventListener("pointerdown", (event) => startResize(event, node, id, handleType));
      node.appendChild(resize);
    }
    els.canvas.appendChild(node);
  }
}

function applyViewportTransform() {
  els.screen.style.setProperty("--zoom", String(state.zoom / 100));
  els.screen.style.setProperty("--pan-x", `${state.panX}px`);
  els.screen.style.setProperty("--pan-y", `${state.panY}px`);
  document.getElementById("zoomRange").value = state.zoom;
}

function zoomAtPoint(delta, clientX, clientY) {
  const oldZoom = state.zoom / 100;
  const nextZoom = Math.max(40, Math.min(220, state.zoom + delta));
  if (nextZoom === state.zoom) return;

  const rect = els.screen.getBoundingClientRect();
  const screenCenterX = rect.left + rect.width / 2;
  const screenCenterY = rect.top + rect.height / 2;
  const pointX = clientX - screenCenterX;
  const pointY = clientY - screenCenterY;
  const newZoom = nextZoom / 100;

  state.panX = Math.round(state.panX - pointX * (newZoom / oldZoom - 1));
  state.panY = Math.round(state.panY - pointY * (newZoom / oldZoom - 1));
  state.zoom = nextZoom;
  applyViewportTransform();
}

function placeholderText(id, props) {
  if (props.type === "ItemsList") return "JOGO 1\nJOGO 2\nJOGO 3\nJOGO 4";
  if (props.type === "MenuText") return state.currentDevice;
  if (props.type === "HintText") return "X Selecionar   O Voltar";
  return `${id}\n${props.type || "Elemento"}`;
}

function selectElement(id) {
  state.selectedId = id;
  renderLayers();
  fillProps();
  renderCanvas();
}

function selectElementForInteraction(id, node) {
  state.selectedId = id;
  renderLayers();
  fillProps();
  document.querySelectorAll(".opl-element").forEach((element) => {
    element.classList.toggle("is-selected", element === node);
  });
}

function renderLayers() {
  els.layerList.innerHTML = "";
  const visible = new Set(getRenderableSections());
  for (const id of state.order.filter((item) => visible.has(item))) {
    const props = state.sections[id];
    if (!props) continue;
    const item = document.createElement("button");
    item.className = "layer-item";
    if (id === state.selectedId) item.classList.add("is-selected");
    item.type = "button";
    item.innerHTML = `<span><strong>${id}</strong><br><small>${props.type || "Sem tipo"}</small></span><small>${state.order.indexOf(id)}</small>`;
    item.addEventListener("click", () => selectElement(id));
    els.layerList.appendChild(item);
  }
}

function fillProps() {
  const props = state.sections[state.selectedId];
  els.propsPanel.hidden = !props;
  els.emptyProps.hidden = Boolean(props);
  updateSafeSizeHint();
  if (!props) return;

  document.getElementById("propId").value = state.selectedId;
  document.getElementById("propType").value = props.type || "StaticImage";
  document.getElementById("propX").value = props.x || "";
  document.getElementById("propY").value = props.y || "";
  document.getElementById("propW").value = props.width || props.w || "";
  document.getElementById("propH").value = props.height || props.h || "";
  document.getElementById("propColor").value = props.color || "";
  document.getElementById("propDefault").value = props.default || "";
  document.getElementById("propPattern").value = props.pattern || "";
  document.getElementById("propAlign").value = props.aligned || "";
  document.getElementById("propScaled").value = props.scaled || "";
  updateSafeSizeHint();
}

function updateSelectedProps() {
  const props = state.sections[state.selectedId];
  if (!props) return;

  props.type = document.getElementById("propType").value;
  props.x = document.getElementById("propX").value;
  props.y = document.getElementById("propY").value;
  props.width = document.getElementById("propW").value;
  props.height = document.getElementById("propH").value;
  props.color = document.getElementById("propColor").value;
  props.default = document.getElementById("propDefault").value;
  props.pattern = document.getElementById("propPattern").value;
  props.aligned = document.getElementById("propAlign").value;
  props.scaled = document.getElementById("propScaled").value;

  renderCanvas();
  renderLayers();
  renderValidation();
}

function getSelectedBox() {
  const props = state.sections[state.selectedId];
  return props ? resolveElementBox(props) : null;
}

function applySelectedSize(width, height) {
  const props = state.sections[state.selectedId];
  if (!props) return;
  const box = resolveElementBox(props);
  const nextWidth = Math.max(1, Math.round(width));
  const nextHeight = Math.max(1, Math.round(height));
  props.width = String(nextWidth);
  props.height = String(nextHeight);
  props.x = serializePosition(box.left, nextWidth, state.screenWidth, props.x);
  props.y = serializePosition(box.top, nextHeight, state.screenHeight, props.y);
  fillProps();
  renderCanvas();
  renderValidation();
}

function fitSelectedToScreen() {
  if (!state.selectedId) return;
  pushHistory();
  const props = state.sections[state.selectedId];
  props.x = "0";
  props.y = "0";
  props.width = String(state.screenWidth);
  props.height = String(state.screenHeight);
  fillProps();
  renderCanvas();
  renderValidation();
}

function getSafeSizeForElement(props) {
  if (!props) return null;
  const type = props.type || "";
  const pattern = String(props.pattern || "").toUpperCase();
  const dimensions = findAssetDimensions(...imageCandidates(state.selectedId || "element", props));

  if (type === "ItemCover") return { width: 140, height: currentSectionPrefix() === "mainELM" ? 160 : 200, label: "Capa OPL comum" };
  if (type === "GameImage" && pattern === "LAB") {
    const cover = getRenderableSections().map((id) => state.sections[id]).find((item) => item?.type === "ItemCover");
    const coverBox = cover ? resolveElementBox(cover) : null;
    return { width: 12, height: coverBox?.height || 200, label: "Lateral LAB" };
  }
  if (type === "GameImage" && (pattern === "SCR" || pattern === "SCR2")) return { width: 150, height: 113, label: "Screenshot info" };
  if (type === "MenuIcon") return { width: 238, height: 51, label: "Icone de aba" };
  if (type === "LoadingIcon") return { width: 32, height: 32, label: "Loading icon" };
  if (dimensions) return { width: dimensions.width, height: dimensions.height, label: "Tamanho original do asset" };
  return null;
}

function updateSafeSizeHint() {
  const hint = document.getElementById("safeSizeHint");
  if (!hint) return;
  const props = state.sections[state.selectedId];
  const safe = getSafeSizeForElement(props);
  hint.textContent = safe ? `${safe.label}: ${safe.width}x${safe.height}` : "Sem preset seguro.";
}

function applySafeSize() {
  const props = state.sections[state.selectedId];
  const safe = getSafeSizeForElement(props);
  if (!props || !safe) {
    updateStatus("Este elemento nao tem preset seguro.");
    return;
  }
  pushHistory();
  applySelectedSize(safe.width, safe.height);
  updateStatus(`Tamanho seguro aplicado: ${safe.width}x${safe.height}.`);
}

function scaleLayoutToResolution(oldWidth, oldHeight, newWidth, newHeight) {
  if (!oldWidth || !oldHeight || oldWidth === newWidth && oldHeight === newHeight) return;
  const scaleX = newWidth / oldWidth;
  const scaleY = newHeight / oldHeight;

  for (const id of state.order) {
    const props = state.sections[id];
    if (!props || id === "__global") continue;
    if (props.type === "Background") continue;

    const box = resolveElementBoxForSize(props, oldWidth, oldHeight);
    const nextLeft = Math.round(box.left * scaleX);
    const nextTop = Math.round(box.top * scaleY);
    const nextWidth = Math.max(1, Math.round(box.width * scaleX));
    const nextHeight = Math.max(1, Math.round(box.height * scaleY));

    if (props.width !== "DIM_INF" && props.width !== "-1" && props.w !== "DIM_INF" && props.w !== "-1") {
      props.width = String(nextWidth);
    }
    if (props.height !== "DIM_INF" && props.height !== "-1" && props.h !== "DIM_INF" && props.h !== "-1") {
      props.height = String(nextHeight);
    }

    props.x = preserveScaledPosition(props.x, nextLeft, nextWidth, newWidth);
    props.y = preserveScaledPosition(props.y, nextTop, nextHeight, newHeight);
  }

  fillProps();
  state.layoutWidth = newWidth;
  state.layoutHeight = newHeight;
}

function convertLayoutToPreviewResolution() {
  if (state.layoutWidth === state.screenWidth && state.layoutHeight === state.screenHeight) {
    updateStatus("Layout ja esta nesta resolucao.");
    return;
  }
  pushHistory();
  scaleLayoutToResolution(state.layoutWidth, state.layoutHeight, state.screenWidth, state.screenHeight);
  renderCanvas();
  renderValidation();
  updateStatus(`Layout convertido para ${state.screenWidth}x${state.screenHeight}.`);
}

function resolveElementBoxForSize(props, screenWidth, screenHeight) {
  const currentWidth = state.screenWidth;
  const currentHeight = state.screenHeight;
  state.screenWidth = screenWidth;
  state.screenHeight = screenHeight;
  const box = resolveElementBox(props);
  state.screenWidth = currentWidth;
  state.screenHeight = currentHeight;
  return box;
}

function preserveScaledPosition(originalValue, pixel, size, limit) {
  if (originalValue === "POS_MID") return "POS_MID";
  const original = Number.parseFloat(originalValue);
  if (Number.isFinite(original) && original < 0) return String(Math.round(pixel + size - limit));
  return String(Math.round(pixel));
}

function startDrag(event, node, id) {
  if (event.button === 1 || state.isSpaceDown) return;
  if (event.target.classList.contains("resize-handle")) return;
  event.preventDefault();
  pushHistory();
  selectElementForInteraction(id, node);
  node.setPointerCapture(event.pointerId);

  const startX = event.clientX;
  const startY = event.clientY;
  const startLeft = Number.parseFloat(node.style.left);
  const startTop = Number.parseFloat(node.style.top);
  const width = Number.parseFloat(node.style.width);
  const height = Number.parseFloat(node.style.height);
  const props = state.sections[id];

  function move(moveEvent) {
    const scale = state.zoom / 100;
    const rawLeft = Math.round(startLeft + (moveEvent.clientX - startX) / scale);
    const rawTop = Math.round(startTop + (moveEvent.clientY - startY) / scale);
    const snapped = snapMove(id, rawLeft, rawTop, width, height);
    const left = snapped.left;
    const top = snapped.top;
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    props.x = serializePosition(left, width, state.screenWidth, props.x);
    props.y = serializePosition(top, height, state.screenHeight, props.y);
    fillProps();
  }

  function stop() {
    node.removeEventListener("pointermove", move);
    node.removeEventListener("pointerup", stop);
    clearGuides();
    renderValidation();
  }

  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", stop);
}

function startPan(event) {
  const wantsPan = event.button === 1 || (state.isSpaceDown && event.button === 0);
  if (!wantsPan) return;
  event.preventDefault();

  const startX = event.clientX;
  const startY = event.clientY;
  const startPanX = state.panX;
  const startPanY = state.panY;

  els.stageWrap.classList.add("is-panning");
  els.stage.setPointerCapture(event.pointerId);

  function move(moveEvent) {
    state.panX = Math.round(startPanX + moveEvent.clientX - startX);
    state.panY = Math.round(startPanY + moveEvent.clientY - startY);
    applyViewportTransform();
  }

  function stop() {
    els.stageWrap.classList.remove("is-panning");
    els.stage.removeEventListener("pointermove", move);
    els.stage.removeEventListener("pointerup", stop);
    els.stage.removeEventListener("pointercancel", stop);
  }

  els.stage.addEventListener("pointermove", move);
  els.stage.addEventListener("pointerup", stop);
  els.stage.addEventListener("pointercancel", stop);
}

function startResize(event, node, id, handleType = "se") {
  if (event.button === 1 || state.isSpaceDown) return;
  event.stopPropagation();
  event.preventDefault();
  pushHistory();
  selectElementForInteraction(id, node);
  node.setPointerCapture(event.pointerId);

  const startX = event.clientX;
  const startY = event.clientY;
  const startW = Number.parseFloat(node.style.width);
  const startH = Number.parseFloat(node.style.height);
  const startLeft = Number.parseFloat(node.style.left);
  const startTop = Number.parseFloat(node.style.top);
  const props = state.sections[id];

  function move(moveEvent) {
    const scale = state.zoom / 100;
    const dx = (moveEvent.clientX - startX) / scale;
    const dy = (moveEvent.clientY - startY) / scale;
    let left = startLeft;
    let top = startTop;
    let width = startW;
    let height = startH;

    if (handleType.includes("e")) {
      width = Math.round(Math.max(16, startW + dx));
    }
    if (handleType.includes("w")) {
      width = Math.round(Math.max(16, startW - dx));
      left = Math.round(startLeft + startW - width);
    }
    if (handleType.includes("s")) {
      height = Math.round(Math.max(16, startH + dy));
    }
    if (handleType.includes("n")) {
      height = Math.round(Math.max(16, startH - dy));
      top = Math.round(startTop + startH - height);
    }

    if (state.lockRatio) {
      const ratio = state.activeRatio || (startW / Math.max(1, startH));
      const horizontal = handleType.includes("e") || handleType.includes("w");
      const vertical = handleType.includes("n") || handleType.includes("s");
      const horizontalDelta = Math.abs(dx);
      const verticalDelta = Math.abs(dy);

      if (horizontal && (!vertical || horizontalDelta >= verticalDelta)) {
        height = Math.round(width / ratio);
        if (handleType.includes("n")) top = Math.round(startTop + startH - height);
      } else if (vertical) {
        width = Math.round(height * ratio);
        if (handleType.includes("w")) left = Math.round(startLeft + startW - width);
      }
    }

    if (state.snapGrid) {
      width = snapToGrid(width);
      height = snapToGrid(height);
      if (handleType.includes("w")) left = Math.round(startLeft + startW - width);
      if (handleType.includes("n")) top = Math.round(startTop + startH - height);
    }

    const smart = snapResize(id, { left, top, width, height }, handleType, {
      left: startLeft,
      top: startTop,
      width: startW,
      height: startH
    });
    left = smart.left;
    top = smart.top;
    width = smart.width;
    height = smart.height;

    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    props.width = String(width);
    props.height = String(height);
    props.x = serializePosition(left, width, state.screenWidth, props.x);
    props.y = serializePosition(top, height, state.screenHeight, props.y);
    fillProps();
  }

  function stop() {
    node.removeEventListener("pointermove", move);
    node.removeEventListener("pointerup", stop);
    clearGuides();
    renderValidation();
  }

  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", stop);
}

function addElement() {
  pushHistory();
  const prefix = currentSectionPrefix();
  const groupPattern = new RegExp(`^${prefix}\\d+$`, "i");
  const existing = state.order
    .filter((id) => groupPattern.test(id))
    .map((id) => Number(id.replace(prefix, "")));
  const next = existing.length ? Math.max(...existing) + 1 : 0;
  const id = `${prefix}${next}`;
  state.sections[id] = { type: "StaticImage", x: "96", y: "96", width: "128", height: "80" };
  state.order.push(id);
  selectElement(id);
  renderValidation();
  updateStatus(`Camada ${id} adicionada.`);
}

function copyMainLayoutToElm() {
  const mainIds = state.order.filter((id) => /^main\d+$/i.test(id));
  if (!mainIds.length) {
    updateStatus("Nao existe grupo main para copiar.");
    return;
  }

  pushHistory();

  for (const id of state.order.filter((item) => /^mainELM\d+$/i.test(item))) {
    delete state.sections[id];
  }
  state.order = state.order.filter((id) => !/^mainELM\d+$/i.test(id));

  const insertAfterIndex = Math.max(
    ...state.order.map((id, index) => (/^info\d+$/i.test(id) ? index : -1)),
    ...state.order.map((id, index) => (/^main\d+$/i.test(id) ? index : -1))
  );
  const elmIds = [];

  mainIds.forEach((mainId, index) => {
    const elmId = `mainELM${index}`;
    state.sections[elmId] = JSON.parse(JSON.stringify(state.sections[mainId]));
    elmIds.push(elmId);
  });

  state.order.splice(insertAfterIndex + 1, 0, ...elmIds);
  state.selectedId = state.currentDevice === "APPS" || state.currentDevice === "PS1" ? "mainELM0" : state.selectedId;
  renderAll();
  updateStatus("Layout main copiado para APPS/PS1 como mainELM.");
}

function deleteElement() {
  if (!state.selectedId || state.selectedId === "__global") return;
  pushHistory();
  delete state.sections[state.selectedId];
  state.order = state.order.filter((id) => id !== state.selectedId);
  state.selectedId = state.order.find((id) => id !== "__global") || null;
  renderAll();
  updateStatus("Camada removida.");
}

function activeRenderableOrder() {
  const visible = new Set(getRenderableSections());
  return state.order.filter((id) => visible.has(id));
}

function moveSelectedLayer(mode) {
  if (!state.selectedId || state.selectedId === "__global") return;
  const visibleOrder = activeRenderableOrder();
  const visibleIndex = visibleOrder.indexOf(state.selectedId);
  if (visibleIndex === -1) return;

  let targetVisibleIndex = visibleIndex;
  if (mode === "forward") targetVisibleIndex = Math.min(visibleOrder.length - 1, visibleIndex + 1);
  if (mode === "backward") targetVisibleIndex = Math.max(0, visibleIndex - 1);
  if (mode === "front") targetVisibleIndex = visibleOrder.length - 1;
  if (mode === "back") targetVisibleIndex = 0;
  if (targetVisibleIndex === visibleIndex) return;

  pushHistory();
  const targetId = visibleOrder[targetVisibleIndex];
  const from = state.order.indexOf(state.selectedId);
  const target = state.order.indexOf(targetId);
  const [item] = state.order.splice(from, 1);
  state.order.splice(target, 0, item);
  renumberRenderableGroup(item);
  renderAll();
  updateStatus("Ordem da camada alterada.");
}

function renumberRenderableGroup(changedId) {
  const match = changedId.match(/^(mainELM|main|info)(\d+)$/i);
  if (!match) return;
  const prefix = match[1];
  const groupPattern = new RegExp(`^${prefix}\\d+$`, "i");
  const group = state.order.filter((id) => groupPattern.test(id));
  const renameMap = new Map();

  group.forEach((oldId, index) => {
    const nextId = `${prefix}${index}`;
    if (oldId !== nextId) renameMap.set(oldId, nextId);
  });

  if (!renameMap.size) return;

  const nextSections = {};
  for (const id of state.order) {
    nextSections[renameMap.get(id) || id] = state.sections[id];
  }
  state.sections = nextSections;
  state.order = state.order.map((id) => renameMap.get(id) || id);
  state.selectedId = renameMap.get(state.selectedId) || state.selectedId;
}

function snapToGrid(value) {
  return Math.round(value / state.gridSize) * state.gridSize;
}

function getElementRect(id) {
  const props = state.sections[id];
  if (!props) return null;
  const box = resolveElementBox(props);
  const left = box.left;
  const top = box.top;
  const width = box.width;
  const height = box.height;
  return {
    id,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2
  };
}

function getSnapTargets(activeId) {
  return getRenderableSections()
    .filter((id) => id !== activeId)
    .map(getElementRect)
    .filter(Boolean);
}

function snapMove(id, left, top, width, height) {
  let result = { left, top };
  const guides = [];

  if (state.snapGrid) {
    result.left = snapToGrid(result.left);
    result.top = snapToGrid(result.top);
  }

  if (!state.snapObjects) {
    clearGuides();
    return result;
  }

  const threshold = 6;
  const moving = {
    left: result.left,
    right: result.left + width,
    centerX: result.left + width / 2,
    top: result.top,
    bottom: result.top + height,
    centerY: result.top + height / 2
  };

  let bestX = { distance: Infinity, delta: 0, guide: null };
  let bestY = { distance: Infinity, delta: 0, guide: null };

  for (const target of getSnapTargets(id)) {
    const xPairs = [
      [moving.left, target.left],
      [moving.left, target.right],
      [moving.centerX, target.centerX],
      [moving.right, target.left],
      [moving.right, target.right]
    ];
    const yPairs = [
      [moving.top, target.top],
      [moving.top, target.bottom],
      [moving.centerY, target.centerY],
      [moving.bottom, target.top],
      [moving.bottom, target.bottom]
    ];

    for (const [source, targetValue] of xPairs) {
      const distance = Math.abs(source - targetValue);
      if (distance <= threshold && distance < bestX.distance) {
        bestX = { distance, delta: targetValue - source, guide: targetValue };
      }
    }

    for (const [source, targetValue] of yPairs) {
      const distance = Math.abs(source - targetValue);
      if (distance <= threshold && distance < bestY.distance) {
        bestY = { distance, delta: targetValue - source, guide: targetValue };
      }
    }
  }

  if (bestX.guide !== null) {
    result.left = Math.round(result.left + bestX.delta);
    guides.push({ axis: "x", value: bestX.guide });
  }
  if (bestY.guide !== null) {
    result.top = Math.round(result.top + bestY.delta);
    guides.push({ axis: "y", value: bestY.guide });
  }

  renderGuides(guides);
  return result;
}

function snapResize(id, box, handleType, startBox) {
  if (!state.snapObjects) {
    clearGuides();
    return box;
  }

  const threshold = 6;
  let result = { ...box };
  const guides = [];
  const activeLeft = handleType.includes("w");
  const activeRight = handleType.includes("e");
  const activeTop = handleType.includes("n");
  const activeBottom = handleType.includes("s");

  function current() {
    return {
      ...result,
      right: result.left + result.width,
      bottom: result.top + result.height,
      centerX: result.left + result.width / 2,
      centerY: result.top + result.height / 2
    };
  }

  let bestX = { distance: Infinity, value: null, edge: null };
  let bestY = { distance: Infinity, value: null, edge: null };
  let bestWidth = { distance: Infinity, value: null };
  let bestHeight = { distance: Infinity, value: null };

  for (const target of getSnapTargets(id)) {
    const targetXValues = [target.left, target.centerX, target.right];
    const targetYValues = [target.top, target.centerY, target.bottom];
    const moving = current();

    if (activeLeft) {
      for (const value of targetXValues) {
        const distance = Math.abs(moving.left - value);
        if (distance <= threshold && distance < bestX.distance) bestX = { distance, value, edge: "left" };
      }
    }
    if (activeRight) {
      for (const value of targetXValues) {
        const distance = Math.abs(moving.right - value);
        if (distance <= threshold && distance < bestX.distance) bestX = { distance, value, edge: "right" };
      }
    }
    if (activeTop) {
      for (const value of targetYValues) {
        const distance = Math.abs(moving.top - value);
        if (distance <= threshold && distance < bestY.distance) bestY = { distance, value, edge: "top" };
      }
    }
    if (activeBottom) {
      for (const value of targetYValues) {
        const distance = Math.abs(moving.bottom - value);
        if (distance <= threshold && distance < bestY.distance) bestY = { distance, value, edge: "bottom" };
      }
    }

    if (!state.lockRatio && (activeLeft || activeRight)) {
      const distance = Math.abs(result.width - target.width);
      if (distance <= threshold && distance < bestWidth.distance) bestWidth = { distance, value: target.width };
    }
    if (!state.lockRatio && (activeTop || activeBottom)) {
      const distance = Math.abs(result.height - target.height);
      if (distance <= threshold && distance < bestHeight.distance) bestHeight = { distance, value: target.height };
    }
  }

  if (bestWidth.value !== null) {
    result.width = Math.max(16, Math.round(bestWidth.value));
    if (activeLeft && !activeRight) result.left = Math.round(startBox.left + startBox.width - result.width);
    guides.push({ axis: "x", value: result.left }, { axis: "x", value: result.left + result.width, label: `W ${result.width}` });
  }

  if (bestHeight.value !== null) {
    result.height = Math.max(16, Math.round(bestHeight.value));
    if (activeTop && !activeBottom) result.top = Math.round(startBox.top + startBox.height - result.height);
    guides.push({ axis: "y", value: result.top }, { axis: "y", value: result.top + result.height, label: `H ${result.height}` });
  }

  if (bestX.value !== null) {
    if (bestX.edge === "left") {
      const right = result.left + result.width;
      result.left = Math.round(bestX.value);
      result.width = Math.max(16, Math.round(right - result.left));
    }
    if (bestX.edge === "right") {
      result.width = Math.max(16, Math.round(bestX.value - result.left));
    }
    guides.push({ axis: "x", value: bestX.value });
  }

  if (bestY.value !== null) {
    if (bestY.edge === "top") {
      const bottom = result.top + result.height;
      result.top = Math.round(bestY.value);
      result.height = Math.max(16, Math.round(bottom - result.top));
    }
    if (bestY.edge === "bottom") {
      result.height = Math.max(16, Math.round(bestY.value - result.top));
    }
    guides.push({ axis: "y", value: bestY.value });
  }

  if (guides.length) renderGuides(guides);
  else clearGuides();

  return result;
}

function clearGuides() {
  els.canvas.querySelectorAll(".snap-guide").forEach((guide) => guide.remove());
}

function renderGuides(guides) {
  clearGuides();
  for (const guide of guides) {
    const node = document.createElement("div");
    node.className = guide.axis === "x" ? "snap-guide snap-guide--v" : "snap-guide snap-guide--h";
    if (guide.axis === "x") node.style.left = `${guide.value}px`;
    if (guide.axis === "y") node.style.top = `${guide.value}px`;
    if (guide.label) {
      const label = document.createElement("span");
      label.className = "snap-guide__label";
      label.textContent = guide.label;
      node.appendChild(label);
    }
    els.canvas.appendChild(node);
  }
}

function renderValidation() {
  const messages = [];
  const mainIds = state.order.filter((id) => /^main\d+$/.test(id));
  const mainNumbers = mainIds.map((id) => Number(id.replace("main", ""))).sort((a, b) => a - b);

  if (state.layoutWidth !== state.screenWidth || state.layoutHeight !== state.screenHeight) {
    messages.push(`Preview em ${state.screenWidth}x${state.screenHeight}; layout ainda em ${state.layoutWidth}x${state.layoutHeight}. Use Converter layout para aplicar.`);
  }

  if (!Object.values(state.sections).some((props) => props.type === "Background")) {
    messages.push("Adicione um Background para compatibilidade com OPL.");
  }

  if (!Object.values(state.sections).some((props) => props.type === "ItemsList")) {
    messages.push("Adicione um ItemsList; ele e obrigatorio em temas praticos.");
  }

  for (let index = 0; index < mainNumbers.length; index++) {
    if (mainNumbers[index] !== index) {
      messages.push(`A sequencia main deve ser continua. Verifique main${index}.`);
      break;
    }
  }

  for (const id of state.order) {
    const props = state.sections[id];
    if (!props || id === "__global") continue;
    const x = Number.parseFloat(props.x || 0);
    const y = Number.parseFloat(props.y || 0);
    const width = Number.parseFloat(props.width || props.w || 0);
    const height = Number.parseFloat(props.height || props.h || 0);
    const box = resolveElementBox(props);
    if (box.left < 0 || box.top < 0 || box.left + box.width > state.screenWidth || box.top + box.height > state.screenHeight) {
      messages.push(`${id} passa da area ${state.screenWidth}x${state.screenHeight}.`);
    }
    if (id === state.selectedId && props.type === "ItemCover") {
      const ratio = box.width / Math.max(1, box.height);
      if (ratio < 0.58 || ratio > 0.78) {
        messages.push(`${id} e uma capa. Esse tamanho pode distorcer arte COV no OPL.`);
      }
    }
    if (id === state.selectedId && props.type === "GameImage" && String(props.pattern || "").toUpperCase() === "LAB" && box.width > 40) {
      messages.push(`${id} usa pattern LAB. Geralmente a lateral de capa e estreita; confirme antes de exportar.`);
    }
  }

  if (!messages.length) {
    els.validation.innerHTML = '<div class="validation-item is-ok">Estrutura basica valida.</div>';
    return;
  }

  els.validation.innerHTML = messages.map((message) => `<div class="validation-item">${message}</div>`).join("");
}

function exportCfg() {
  const blob = new Blob([generateCfg()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "conf_theme.cfg";
  link.click();
  URL.revokeObjectURL(url);
  updateStatus("conf_theme.cfg exportado.");
}

function makeCrcTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = Math.max(1980, date.getFullYear()) - 1980;
  return {
    time,
    date: (year << 9) | (month << 5) | day
  };
}

function push16(target, value) {
  target.push(value & 255, (value >>> 8) & 255);
}

function push32(target, value) {
  target.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

async function createStoredZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime();

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name.replace(/\\/g, "/"));
    const data = entry.bytes;
    const crc = crc32(data);
    const localHeader = [];

    push32(localHeader, 0x04034b50);
    push16(localHeader, 20);
    push16(localHeader, 0);
    push16(localHeader, 0);
    push16(localHeader, stamp.time);
    push16(localHeader, stamp.date);
    push32(localHeader, crc);
    push32(localHeader, data.length);
    push32(localHeader, data.length);
    push16(localHeader, nameBytes.length);
    push16(localHeader, 0);

    localParts.push(new Uint8Array(localHeader), nameBytes, data);

    const centralHeader = [];
    push32(centralHeader, 0x02014b50);
    push16(centralHeader, 20);
    push16(centralHeader, 20);
    push16(centralHeader, 0);
    push16(centralHeader, 0);
    push16(centralHeader, stamp.time);
    push16(centralHeader, stamp.date);
    push32(centralHeader, crc);
    push32(centralHeader, data.length);
    push32(centralHeader, data.length);
    push16(centralHeader, nameBytes.length);
    push16(centralHeader, 0);
    push16(centralHeader, 0);
    push16(centralHeader, 0);
    push16(centralHeader, 0);
    push32(centralHeader, 0);
    push32(centralHeader, offset);

    centralParts.push(new Uint8Array(centralHeader), nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = [];
  push32(end, 0x06054b50);
  push16(end, 0);
  push16(end, 0);
  push16(end, entries.length);
  push16(end, entries.length);
  push32(end, centralSize);
  push32(end, offset);
  push16(end, 0);

  return new Blob([...localParts, ...centralParts, new Uint8Array(end)], { type: "application/zip" });
}

async function exportZip() {
  const encoder = new TextEncoder();
  const entries = [];
  const usedPaths = new Set();

  for (const [path, file] of Object.entries(state.files)) {
    if (/\/?(conf_theme|theme)\.cfg$/i.test(path)) continue;
    const bytes = new Uint8Array(await file.arrayBuffer());
    entries.push({ name: path, bytes });
    usedPaths.add(path.toLowerCase());
  }

  const cfgPath = usedPaths.size
    ? Object.keys(state.files).find((path) => /\/?(conf_theme|theme)\.cfg$/i.test(path)) || "conf_theme.cfg"
    : "thm_custom/conf_theme.cfg";

  entries.push({ name: cfgPath.replace(/theme\.cfg$/i, "conf_theme.cfg"), bytes: encoder.encode(generateCfg()) });

  const blob = await createStoredZip(entries);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "opl_theme_export.zip";
  link.click();
  URL.revokeObjectURL(url);
  updateStatus("Tema exportado em ZIP.");
}

function renderAll() {
  buildFolderTree();
  renderAssetGrid();
  renderLayers();
  fillProps();
  renderCanvas();
  renderValidation();
}

document.getElementById("newThemeBtn").addEventListener("click", createStarterTheme);
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", redo);

document.getElementById("loadThemeBtn").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.webkitdirectory = true;
  input.multiple = true;
  input.addEventListener("change", () => loadThemeFromFiles(Array.from(input.files || [])));
  input.click();
});

document.getElementById("exportCfgBtn").addEventListener("click", exportCfg);
document.getElementById("exportZipBtn").addEventListener("click", exportZip);
document.getElementById("addElementBtn").addEventListener("click", addElement);
document.getElementById("deleteElementBtn").addEventListener("click", deleteElement);
document.getElementById("bringForwardBtn").addEventListener("click", () => moveSelectedLayer("forward"));
document.getElementById("sendBackwardBtn").addEventListener("click", () => moveSelectedLayer("backward"));
document.getElementById("bringToFrontBtn").addEventListener("click", () => moveSelectedLayer("front"));
document.getElementById("sendToBackBtn").addEventListener("click", () => moveSelectedLayer("back"));
document.getElementById("copyUsbLayoutBtn").addEventListener("click", copyMainLayoutToElm);

document.getElementById("lockRatioToggle").addEventListener("change", (event) => {
  state.lockRatio = event.target.checked;
  const box = getSelectedBox();
  state.activeRatio = box ? box.width / Math.max(1, box.height) : null;
});

document.getElementById("fitScreenBtn").addEventListener("click", fitSelectedToScreen);
document.getElementById("safeSizeBtn").addEventListener("click", applySafeSize);

document.getElementById("toggleLeftBtn").addEventListener("click", () => {
  document.getElementById("leftPanel").classList.toggle("is-collapsed");
  document.querySelector(".studio-shell").classList.toggle("left-collapsed");
});

document.querySelectorAll(".device-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".device-tab").forEach((item) => item.classList.remove("is-active"));
    tab.classList.add("is-active");
    state.currentDevice = tab.dataset.device;
    const visible = getRenderableSections();
    if (!visible.includes(state.selectedId)) state.selectedId = visible[0] || null;
    renderLayers();
    fillProps();
    renderCanvas();
    updateStatus(`Visualizando ${state.currentDevice}.`);
  });
});

document.getElementById("resolutionSelect").addEventListener("change", (event) => {
  pushHistory();
  const [width, height] = event.target.value.split("x").map((value) => Number(value));
  state.screenWidth = width || DEFAULT_WIDTH;
  state.screenHeight = height || DEFAULT_HEIGHT;
  if (state.autoConvertResolution) {
    scaleLayoutToResolution(state.layoutWidth, state.layoutHeight, state.screenWidth, state.screenHeight);
  }
  renderCanvas();
  renderValidation();
});

document.getElementById("autoConvertToggle").addEventListener("change", (event) => {
  state.autoConvertResolution = event.target.checked;
});

document.getElementById("convertLayoutBtn").addEventListener("click", convertLayoutToPreviewResolution);

document.getElementById("showGridToggle").addEventListener("change", (event) => {
  pushHistory();
  state.showGrid = event.target.checked;
  renderCanvas();
});

document.getElementById("gridSizeInput").addEventListener("change", (event) => {
  pushHistory();
  state.gridSize = Math.max(2, Math.min(64, Number(event.target.value) || 16));
  syncEditorControls();
  renderCanvas();
});

document.getElementById("snapGridToggle").addEventListener("change", (event) => {
  pushHistory();
  state.snapGrid = event.target.checked;
});

document.getElementById("snapObjectsToggle").addEventListener("change", (event) => {
  pushHistory();
  state.snapObjects = event.target.checked;
});

document.getElementById("zoomRange").addEventListener("input", (event) => {
  state.zoom = Number(event.target.value);
  applyViewportTransform();
});

els.stage.addEventListener("wheel", (event) => {
  event.preventDefault();
  const direction = event.deltaY > 0 ? -10 : 10;
  zoomAtPoint(direction, event.clientX, event.clientY);
}, { passive: false });

propIds.slice(1).forEach((id) => {
  const input = document.getElementById(id);
  input.addEventListener("focus", () => {
    input.dataset.beforeEdit = JSON.stringify(cloneThemeState());
  });
  input.addEventListener("input", updateSelectedProps);
  input.addEventListener("change", () => {
    if (!input.dataset.beforeEdit) return;
    state.history.push(JSON.parse(input.dataset.beforeEdit));
    if (state.history.length > 80) state.history.shift();
    state.future = [];
    delete input.dataset.beforeEdit;
  });
});

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName || "")) {
    state.isSpaceDown = true;
    els.stageWrap.classList.add("is-panning");
    event.preventDefault();
  }

  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey) {
    event.preventDefault();
    undo();
  }
  if ((event.ctrlKey || event.metaKey) && (key === "y" || (key === "z" && event.shiftKey))) {
    event.preventDefault();
    redo();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    state.isSpaceDown = false;
    els.stageWrap.classList.remove("is-panning");
  }
});

els.stage.addEventListener("pointerdown", startPan);
els.stage.addEventListener("auxclick", (event) => {
  if (event.button === 1) event.preventDefault();
});

createStarterTheme();
