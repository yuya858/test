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
