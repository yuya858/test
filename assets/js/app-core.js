const STORAGE_KEY = "mitsumori_irai_records_v2";
const DRAFT_KEY = "mitsumori_irai_drafts_v2";
const TRASH_KEY = "mitsumori_irai_trash_v2";
const HISTORY_KEY = "mitsumori_irai_input_history_v1";
const PART_NUMBER_KEY = "mitsumori_irai_part_number_map_v1";
const MAKER_MODEL_KEY = "mitsumori_irai_maker_model_map_v1";
const MAKER_MODEL_PART_KEY = "mitsumori_irai_maker_model_part_map_v1";
const CANDIDATE_TRASH_KEY = "mitsumori_irai_candidate_trash_v1";
const CANDIDATE_PURGED_KEY = "mitsumori_irai_candidate_purged_v1";
const APP_VERSION = "2026-07-01-1";
const SUPABASE_URL = "https://tkhcbtcvtzkruporhnhw.supabase.co";
const SUPABASE_KEY = "sb_publishable_BjUiMlNsWkuEFSlhLNf-Yg_QBhEe87N";
const CLOUD_TABLE = "mitsumori_app_state";
const CLOUD_ROW_ID = "shared";
const CLOUD_KEYS = [
  STORAGE_KEY,
  DRAFT_KEY,
  TRASH_KEY,
  HISTORY_KEY,
  PART_NUMBER_KEY,
  MAKER_MODEL_KEY,
  MAKER_MODEL_PART_KEY,
  CANDIDATE_TRASH_KEY,
  CANDIDATE_PURGED_KEY,
];
const itemRows = document.getElementById("itemRows");
const columns = ["place", "maker", "model", "serial", "part", "part_no", "qty", "cost", "price"];
let activeId = null;
let activeDraftId = null;
let lastSavedJson = "";
let activeInput = null;
let pendingCandidateDelete = null;
let pendingPermanentDelete = null;
let activeCandidateKey = "user_name";
let activeCandidateMaker = "";
let activeCandidateModel = "";
let selectedCandidateParts = new Set();
let selectedCandidateItem = null;
let candidateAddMode = "";
let candidateBulkAddConfirm = false;
let candidateBackStack = [];
let undoStack = [];
let lastUndoSnapshot = "";
let cloudSyncPaused = false;
let cloudSaveTimer = null;

function makeRow(index) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td class="row-number">${index + 1}</td>` + columns.map((name) => {
    const noAutocomplete = name === "serial"
      ? ' autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"'
      : "";
    return `<td><input class="entry" data-key="items.${index}.${name}" aria-label="${name}"${noAutocomplete}></td>`;
  }).join("");
  return tr;
}

function renderRows(count) {
  itemRows.innerHTML = "";
  for (let i = 0; i < count; i += 1) itemRows.appendChild(makeRow(i));
}

function valuesToRows(data) {
  const count = Math.max(1, Number(data.rowCount || 14));
  return Array.from({ length: count }, (_, index) => {
    const row = {};
    columns.forEach((name) => { row[name] = data[`items.${index}.${name}`] || ""; });
    return row;
  });
}

function writeRows(rows) {
  renderRows(rows.length);
  rows.forEach((row, index) => {
    columns.forEach((name) => {
      const input = document.querySelector(`[data-key="items.${index}.${name}"]`);
      if (input) input.value = row[name] || "";
    });
  });
}

function rowHasContent(row) {
  return columns.some((name) => String(row[name] || "").trim());
}

function rowsWithEffectiveContext(rows) {
  let currentPlace = "";
  let currentMaker = "";
  let currentModel = "";
  return rows.map((row) => {
    const place = String(row.place || "").trim();
    const maker = String(row.maker || "").trim();
    const model = String(row.model || "").trim();
    if (place && place !== currentPlace) {
      currentPlace = place;
      currentMaker = "";
      currentModel = "";
    }
    if (maker && maker !== currentMaker) {
      currentMaker = maker;
      currentModel = "";
    }
    if (model) currentModel = model;
    return {
      ...row,
      effectivePlace: place || currentPlace,
      effectiveMaker: maker || currentMaker,
      effectiveModel: model || currentModel,
    };
  });
}

function formatRowsForDisplay(rows) {
  const formatted = [];
  const formatSegment = (segment) => {
    const contextRows = rowsWithEffectiveContext(segment);
    const filled = contextRows.filter(rowHasContent);
    const emptyCount = segment.length - filled.length;
    const makerOrder = [];
    filled.forEach((row) => {
      const maker = String(row.effectiveMaker || row.maker || "").trim();
      if (maker && !makerOrder.includes(maker)) makerOrder.push(maker);
    });
    const makerRows = makerOrder.flatMap((maker) =>
      filled.filter((row) => String(row.effectiveMaker || row.maker || "").trim() === maker)
    );
    const noMakerRows = filled.filter((row) => !String(row.effectiveMaker || row.maker || "").trim());
    let previousMaker = "";
    let previousModel = "";
    return [...makerRows, ...noMakerRows].map((row) => {
      const maker = String(row.effectiveMaker || row.maker || "").trim();
      const model = String(row.effectiveModel || row.model || "").trim();
      const displayMaker = maker && maker === previousMaker ? "" : maker;
      const displayModel = maker && maker === previousMaker && model === previousModel ? "" : model;
      if (maker) {
        previousMaker = maker;
        previousModel = model;
      }
      const { effectivePlace, effectiveMaker, effectiveModel, ...cleanRow } = row;
      return { ...cleanRow, maker: displayMaker, model: displayModel };
    }).concat(Array.from({ length: emptyCount }, () => ({})));
  };

  let start = 0;
  for (let i = 1; i < rows.length; i += 1) {
    if (String(rows[i].place || "").trim()) {
      formatted.push(...formatSegment(rows.slice(start, i)));
      start = i;
    }
  }
  formatted.push(...formatSegment(rows.slice(start)));
  return formatted;
}

function sortRowsByMaker() {
  writeRows(formatRowsForDisplay(valuesToRows(collect())));
}

function insertBlankRowAt(index) {
  const rows = valuesToRows(collect());
  const lastContentIndex = rows.reduce((last, row, rowIndex) => rowHasContent(row) ? rowIndex : last, -1);
  if (lastContentIndex >= rows.length - 1) rows.push({});
  rows.splice(index, 0, {});
  writeRows(rows.slice(0, Math.max(14, rows.length - 1)));
}

function activeRowIndex() {
  if (activeInput?.dataset?.key) {
    const index = rowIndexFromKey(activeInput.dataset.key);
    if (index !== null) return index;
  }
  return 0;
}

function firstMissingMakerPlace() {
  const rows = valuesToRows(collect());
  const row = rowsWithEffectiveContext(rows).find((item) =>
    String(item.place || "").trim() &&
    rowHasContent(item) &&
    !String(item.effectiveMaker || item.maker || "").trim()
  );
  return row ? String(row.place || "").trim() : "";
}

function showMakerMissing(place) {
  document.getElementById("makerMissingTitle").textContent =
    `設置場所「${place}」にメーカーが書かれていません`;
  document.getElementById("makerMissingConfirm").hidden = false;
}

function closeMakerMissing() {
  document.getElementById("makerMissingConfirm").hidden = true;
}

function fields() {
  return Array.from(document.querySelectorAll("#estimateView [data-key]"));
}

function readList(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
}

function writeList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
  scheduleCloudSave();
}

function readHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}"); }
  catch { return {}; }
}

function writeHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  scheduleCloudSave();
}

function readPartNumberMap() {
  try { return JSON.parse(localStorage.getItem(PART_NUMBER_KEY) || "{}"); }
  catch { return {}; }
}

function writePartNumberMap(map) {
  localStorage.setItem(PART_NUMBER_KEY, JSON.stringify(map));
  scheduleCloudSave();
}

function readMakerModelMap() {
  try { return JSON.parse(localStorage.getItem(MAKER_MODEL_KEY) || "{}"); }
  catch { return {}; }
}

function writeMakerModelMap(map) {
  localStorage.setItem(MAKER_MODEL_KEY, JSON.stringify(map));
  scheduleCloudSave();
}

function readMakerModelPartMap() {
  try { return JSON.parse(localStorage.getItem(MAKER_MODEL_PART_KEY) || "{}"); }
  catch { return {}; }
}

function writeMakerModelPartMap(map) {
  localStorage.setItem(MAKER_MODEL_PART_KEY, JSON.stringify(map));
  scheduleCloudSave();
}

function cloudHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function cloudStateFromLocal() {
  const data = {};
  CLOUD_KEYS.forEach((key) => {
    try { data[key] = JSON.parse(localStorage.getItem(key) || "null"); }
    catch { data[key] = null; }
  });
  return data;
}

function mergeUniqueById(localList = [], cloudList = []) {
  const map = new Map();
  [...cloudList, ...localList].forEach((item) => {
    if (!item?.id) return;
    map.set(item.id, { ...(map.get(item.id) || {}), ...item });
  });
  return Array.from(map.values()).sort((a, b) =>
    String(b.updatedAt || b.deletedAt || "").localeCompare(String(a.updatedAt || a.deletedAt || ""))
  );
}

function mergeUniqueText(localList = [], cloudList = []) {
  return Array.from(new Set([...cloudList, ...localList].filter(Boolean))).slice(0, 80);
}

function mergeHistory(localHistory = {}, cloudHistory = {}) {
  const merged = { ...cloudHistory };
  Object.keys(localHistory).forEach((key) => {
    merged[key] = mergeUniqueText(localHistory[key] || [], cloudHistory[key] || []);
  });
  return merged;
}

function mergeObjectLists(localMap = {}, cloudMap = {}) {
  const merged = { ...cloudMap };
  Object.keys(localMap).forEach((key) => {
    if (Array.isArray(localMap[key]) || Array.isArray(cloudMap[key])) {
      merged[key] = mergeUniqueText(localMap[key] || [], cloudMap[key] || []);
    } else {
      merged[key] = localMap[key] ?? cloudMap[key];
    }
  });
  return merged;
}

function candidateTrashIdentity(item) {
  if (!item) return "";
  return [
    item.type || "",
    item.key || "",
    item.maker || "",
    item.model || "",
    item.value || "",
    item.partNo || "",
    item.label || "",
  ].map((value) => String(value || "").trim()).join("|||");
}

function mergeCandidateTrash(localTrash = [], cloudTrash = [], purged = []) {
  const purgedSet = new Set(purged);
  const seen = new Set();
  return [...cloudTrash, ...localTrash].filter((item) => {
    const identity = candidateTrashIdentity(item);
    if (!identity || purgedSet.has(identity) || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).slice(0, 200);
}

function mergeCloudState(localData, cloudData) {
  const purgedCandidates = mergeUniqueText(localData[CANDIDATE_PURGED_KEY] || [], cloudData[CANDIDATE_PURGED_KEY] || []);
  return {
    [STORAGE_KEY]: mergeUniqueById(localData[STORAGE_KEY] || [], cloudData[STORAGE_KEY] || []),
    [DRAFT_KEY]: mergeUniqueById(localData[DRAFT_KEY] || [], cloudData[DRAFT_KEY] || []),
    [TRASH_KEY]: mergeUniqueById(localData[TRASH_KEY] || [], cloudData[TRASH_KEY] || []),
    [CANDIDATE_TRASH_KEY]: mergeCandidateTrash(localData[CANDIDATE_TRASH_KEY] || [], cloudData[CANDIDATE_TRASH_KEY] || [], purgedCandidates),
    [CANDIDATE_PURGED_KEY]: purgedCandidates,
    [HISTORY_KEY]: mergeHistory(localData[HISTORY_KEY] || {}, cloudData[HISTORY_KEY] || {}),
    [PART_NUMBER_KEY]: { ...(cloudData[PART_NUMBER_KEY] || {}), ...(localData[PART_NUMBER_KEY] || {}) },
    [MAKER_MODEL_KEY]: mergeObjectLists(localData[MAKER_MODEL_KEY] || {}, cloudData[MAKER_MODEL_KEY] || {}),
    [MAKER_MODEL_PART_KEY]: mergeObjectLists(localData[MAKER_MODEL_PART_KEY] || {}, cloudData[MAKER_MODEL_PART_KEY] || {}),
  };
}

function applyCloudState(data) {
  cloudSyncPaused = true;
  CLOUD_KEYS.forEach((key) => {
    localStorage.setItem(key, JSON.stringify(data[key] ?? (key === HISTORY_KEY || key === PART_NUMBER_KEY || key === MAKER_MODEL_KEY || key === MAKER_MODEL_PART_KEY ? {} : [])));
  });
  cloudSyncPaused = false;
  sanitizeDeletedCandidatesFromLocal();
}

async function loadCloudState() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${CLOUD_TABLE}?id=eq.${CLOUD_ROW_ID}&select=data&limit=1`, {
      headers: cloudHeaders(),
    });
    if (!res.ok) throw new Error(`cloud load ${res.status}`);
    const rows = await res.json();
    const localData = cloudStateFromLocal();
    const cloudData = rows[0]?.data || {};
    const merged = rows.length ? mergeCloudState(localData, cloudData) : localData;
    applyCloudState(merged);
    await saveCloudStateNow();
  } catch (error) {
    console.warn("Supabase sync disabled:", error);
  }
}

async function saveCloudStateNow() {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${CLOUD_TABLE}`, {
      method: "POST",
      headers: cloudHeaders({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        id: CLOUD_ROW_ID,
        data: cloudStateFromLocal(),
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn("Supabase save failed:", error);
  }
}

function scheduleCloudSave() {
  if (cloudSyncPaused) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(saveCloudStateNow, 700);
}

function partMapKey(model, part) {
  return `${String(model || "").trim()}|||${String(part || "").trim()}`;
}

function partNumberKey(maker, model, part) {
  return `${String(maker || "").trim()}|||${String(model || "").trim()}|||${String(part || "").trim()}`;
}

function makerModelKey(maker, model) {
  return `${String(maker || "").trim()}|||${String(model || "").trim()}`;
}

function addUnique(list, value) {
  const text = String(value || "").trim();
  if (!text) return list || [];
  return [text, ...(list || []).filter((item) => item !== text)].slice(0, 80);
}

function deletedCandidateMatches(item, key, value, maker = "", model = "") {
  const text = String(value || "").trim();
  if (!item || !text) return false;
  const itemValue = String(item.value || "").trim();
  const itemMaker = String(item.maker || "").trim();
  const itemModel = String(item.model || "").trim();
  const targetMaker = String(maker || "").trim();
  const targetModel = String(model || "").trim();
  if (key === "items.part_no" && String(item.partNo || "").trim() === text) return true;
  if (item.key === key && itemValue === text) return true;
  if (item.type === "makerModel") {
    return key === "items.model" && itemValue === text && (!targetMaker || itemMaker === targetMaker);
  }
  if (item.type === "makerModelPart") {
    return key === "items.part" && itemValue === text &&
      (!targetMaker || itemMaker === targetMaker) &&
      (!targetModel || itemModel === targetModel);
  }
  if (item.type === "makerModelParts") {
    return key === "items.part" && (item.values || []).includes(text) &&
      (!targetMaker || itemMaker === targetMaker) &&
      (!targetModel || itemModel === targetModel);
  }
  return false;
}

function candidateFromIdentity(identity) {
  const parts = String(identity || "").split("|||");
  return {
      type: parts[0],
      key: parts[1],
      maker: parts[2],
      model: parts[3],
      value: parts[4],
      partNo: parts[5],
      label: parts[6],
  };
}

function candidateBlockItems() {
  return [
    ...readList(CANDIDATE_TRASH_KEY),
    ...readList(CANDIDATE_PURGED_KEY).map(candidateFromIdentity),
  ];
}

function isDeletedCandidate(key, value, maker = "", model = "") {
  return candidateBlockItems().some((item) =>
    deletedCandidateMatches(item, key, value, maker, model)
  );
}

function visibleCandidateValues(key, values, maker = "", model = "") {
  return (values || []).filter((value) => !isDeletedCandidate(key, value, maker, model));
}

function isDeletedMaker(maker) {
  return isDeletedCandidate("items.maker", maker);
}

function sanitizeDeletedCandidatesFromLocal() {
  const blocked = candidateBlockItems();
  if (!blocked.length) return;

  const history = readHistory();
  Object.keys(history).forEach((key) => {
    history[key] = (history[key] || []).filter((value) =>
      !blocked.some((item) => deletedCandidateMatches(item, key, value))
    );
  });
  writeHistory(history);

  const modelMap = readMakerModelMap();
  Object.keys(modelMap).forEach((maker) => {
    if (isDeletedMaker(maker)) {
      delete modelMap[maker];
      return;
    }
    modelMap[maker] = (modelMap[maker] || []).filter((model) =>
      !blocked.some((item) => deletedCandidateMatches(item, "items.model", model, maker))
    );
  });
  writeMakerModelMap(modelMap);

  const partMap = readMakerModelPartMap();
  Object.keys(partMap).forEach((key) => {
    const [maker, model] = key.split("|||");
    if (isDeletedMaker(maker) || isDeletedCandidate("items.model", model, maker)) {
      delete partMap[key];
      return;
    }
    partMap[key] = (partMap[key] || []).filter((part) =>
      !blocked.some((item) => deletedCandidateMatches(item, "items.part", part, maker, model))
    );
  });
  writeMakerModelPartMap(partMap);

  const numberMap = readPartNumberMap();
  Object.keys(numberMap).forEach((key) => {
    const parts = key.split("|||");
    const partNo = String(numberMap[key] || "").trim();
    if (parts.length === 3) {
      const [maker, model, part] = parts;
      if (
        isDeletedMaker(maker) ||
        isDeletedCandidate("items.model", model, maker) ||
        isDeletedCandidate("items.part", part, maker, model) ||
        isDeletedCandidate("items.part_no", partNo, maker, model)
      ) {
        delete numberMap[key];
      }
    }
    if (parts.length === 2) {
      const [model, part] = parts;
      if (
        blocked.some((item) => deletedCandidateMatches(item, "items.model", model)) ||
        blocked.some((item) => deletedCandidateMatches(item, "items.part", part)) ||
        blocked.some((item) => deletedCandidateMatches(item, "items.part_no", partNo))
      ) {
        delete numberMap[key];
      }
    }
  });
  writePartNumberMap(numberMap);
}
