function moveCaretToEnd(input) {
  if (!input || typeof input.setSelectionRange !== "function") return;
  const length = input.value.length;
  requestAnimationFrame(() => {
    try { input.setSelectionRange(length, length); } catch {}
  });
}

function collect() {
  const data = {};
  fields().forEach((el) => { data[el.dataset.key] = el.value; });
  data.rowCount = itemRows.children.length;
  return data;
}

function apply(data) {
  renderRows(Math.max(1, Number(data.rowCount || 14)));
  fields().forEach((el) => { el.value = data[el.dataset.key] || ""; });
}

function dataJson(data) {
  return JSON.stringify(data || collect());
}

function updateUndoButton() {
  document.getElementById("undoBtn").disabled = undoStack.length === 0;
}

function rememberUndoState() {
  const snapshot = dataJson(collect());
  if (snapshot === lastUndoSnapshot) return;
  undoStack.push(snapshot);
  if (undoStack.length > 40) undoStack.shift();
  lastUndoSnapshot = snapshot;
  updateUndoButton();
}

function openUndoConfirm() {
  if (!undoStack.length) return;
  document.getElementById("undoConfirm").hidden = false;
}

function closeUndoConfirm() {
  document.getElementById("undoConfirm").hidden = true;
}

function confirmUndo() {
  const snapshot = undoStack.pop();
  if (!snapshot) return closeUndoConfirm();
  const data = JSON.parse(snapshot);
  apply(data);
  lastUndoSnapshot = dataJson(data);
  fitMobileSheet();
  fitPrintRows();
  updatePrimaryButtons();
  updateUndoButton();
  closeUndoConfirm();
}

function hasContent(data) {
  return Object.entries(data).some(([key, value]) => key !== "rowCount" && String(value || "").trim() !== "");
}

function updatePrimaryButtons() {
  const data = collect();
  const rows = valuesToRows(data);
  const hasAnyContent = hasContent(data);
  const isFullDefaultRows = itemRows.children.length >= 14 && rows.slice(0, 14).every(rowHasContent);
  document.getElementById("saveBtn").disabled = !hasAnyContent;
  document.getElementById("newBtn").disabled = !hasAnyContent;
  document.getElementById("addRowBtn").disabled = !isFullDefaultRows;
  document.getElementById("removeRowBtn").disabled = itemRows.children.length <= 14;
}

function markClean(data = collect()) {
  lastSavedJson = dataJson(data);
}

function saveCurrentDraft() {
  const data = collect();
  if (!hasContent(data) || dataJson(data) === lastSavedJson) return null;
  const drafts = readList(DRAFT_KEY);
  const id = activeDraftId || `d_${Date.now()}`;
  const record = { id, title: titleFor(data), company: companyFor(data), updatedAt: nowText(), data };
  const index = drafts.findIndex((item) => item.id === id);
  if (index >= 0) drafts[index] = record;
  else drafts.unshift(record);
  activeDraftId = id;
  writeList(DRAFT_KEY, drafts);
  renderRecordList("draft");
  return id;
}

function removeDraft(id) {
  if (!id) return;
  writeList(DRAFT_KEY, readList(DRAFT_KEY).filter((item) => item.id !== id));
  if (activeDraftId === id) activeDraftId = null;
  renderRecordList("draft");
}

function deleteRow(index = itemRows.children.length - 1) {
  const current = collect();
  const rows = valuesToRows(current);
  if (rows.length <= 1 || index < 0) return;
  rows.splice(index, 1);
  Object.keys(current).forEach((key) => {
    if (key.startsWith("items.")) delete current[key];
  });
  current.rowCount = rows.length;
  apply(current);
  writeRows(rows);
  fitMobileSheet();
  fitPrintRows();
  updatePrimaryButtons();
}

function fitPrintRows() {
  const rowCount = itemRows.children.length;
  const compact = rowCount > 14;
  const dense = rowCount > 18;
  document.documentElement.style.setProperty("--print-item-row-height", `${dense ? 19 : compact ? 22 : 27}px`);
  document.documentElement.style.setProperty("--print-item-header-height", `${dense ? 20 : compact ? 22 : 24}px`);
  document.documentElement.style.setProperty("--print-notes-height", `${dense ? 56 : compact ? 68 : 85}px`);
  document.documentElement.style.setProperty("--print-font-size", `${dense ? 9 : compact ? 10 : 11}px`);
}

function titleFor(data) {
  return data.user_name || data.recipient || data["items.0.part"] || "無題の見積もり";
}

function companyFor(data) {
  return data.user_name || data.recipient || "会社名未入力";
}

function nowText() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showView(name) {
  if (name !== "estimate") saveCurrentDraft();
  if (name !== "estimate") hideSuggestions();
  document.querySelectorAll(".view").forEach((view) => { view.hidden = true; });
  document.getElementById(`${name}View`).hidden = false;
  document.querySelectorAll("[data-view-button]").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewButton === name);
  });
  if (name === "draft") renderRecordList("draft");
  if (name === "saved") renderRecordList("saved");
  if (name === "candidate") renderCandidateList();
  if (name === "trash") renderRecordList("trash");
}

function saveRecord() {
  if (!hasContent(collect())) return;
  const missingPlace = firstMissingMakerPlace();
  if (missingPlace) {
    showMakerMissing(missingPlace);
    return;
  }
  rememberUndoState();
  sortRowsByMaker();
  const records = readList(STORAGE_KEY);
  const data = collect();
  rememberData(data);
  const id = activeId || `q_${Date.now()}`;
  const record = { id, title: titleFor(data), company: companyFor(data), updatedAt: nowText(), data };
  const index = records.findIndex((item) => item.id === id);
  if (index >= 0) records[index] = record;
  else records.unshift(record);
  activeId = id;
  removeDraft(activeDraftId);
  activeDraftId = null;
  markClean(data);
  writeList(STORAGE_KEY, records);
  renderRecordList("saved");
}

function newRecord() {
  if (!hasContent(collect())) return;
  saveCurrentDraft();
  activeId = null;
  activeDraftId = null;
  apply({ rowCount: 14 });
  markClean({ rowCount: 14 });
  updatePrimaryButtons();
  showView("estimate");
}

function loadRecord(id) {
  const record = readList(STORAGE_KEY).find((item) => item.id === id);
  if (!record) return;
  activeId = record.id;
  activeDraftId = null;
  apply(record.data);
  markClean(record.data);
  updatePrimaryButtons();
  showView("estimate");
}

function loadDraft(id) {
  const record = readList(DRAFT_KEY).find((item) => item.id === id);
  if (!record) return;
  activeId = null;
  activeDraftId = record.id;
  apply(record.data);
  markClean(record.data);
  updatePrimaryButtons();
  showView("estimate");
}

function moveToTrash(id) {
  const records = readList(STORAGE_KEY);
  const index = records.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [record] = records.splice(index, 1);
  const trash = readList(TRASH_KEY);
  trash.unshift({ ...record, deletedAt: nowText() });
  writeList(STORAGE_KEY, records);
  writeList(TRASH_KEY, trash);
  if (activeId === id) activeId = null;
  renderRecordList("saved");
}

function restoreRecord(id) {
  const trash = readList(TRASH_KEY);
  const index = trash.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [record] = trash.splice(index, 1);
  const records = readList(STORAGE_KEY);
  records.unshift(record);
  writeList(TRASH_KEY, trash);
  writeList(STORAGE_KEY, records);
  renderRecordList("trash");
}

function deleteForever(id) {
  writeList(TRASH_KEY, readList(TRASH_KEY).filter((item) => item.id !== id));
  renderRecordList("trash");
}

function deleteCandidateForever(index) {
  const list = readList(CANDIDATE_TRASH_KEY);
  const item = list[Number(index)];
  if (!item) return;
  const identity = candidateTrashIdentity(item);
  const purged = addUnique(readList(CANDIDATE_PURGED_KEY), identity);
  writeList(CANDIDATE_PURGED_KEY, purged);
  writeList(CANDIDATE_TRASH_KEY, list.filter((candidate) => candidateTrashIdentity(candidate) !== identity));
  sanitizeDeletedCandidatesFromLocal();
  renderRecordList("trash");
  saveCloudStateNow();
}

function candidateTrashContext(item) {
  let maker = item.maker || "";
  let model = item.model || "";
  const label = String(item.label || "");
  if (!maker && item.key === "items.model") {
    const match = label.match(/型式（(.+)）/);
    if (match) maker = match[1];
  }
  if ((!maker || !model) && item.key === "items.part") {
    const match = label.match(/部品名（(.+) \/ (.+)）/);
    if (match) {
      maker = maker || match[1];
      model = model || match[2];
    }
  }
  return { maker, model };
}

function restoreCandidate(index) {
  const list = readList(CANDIDATE_TRASH_KEY);
  const itemIndex = Number(index);
  const item = list[itemIndex];
  if (!item) return;
  const { maker, model } = candidateTrashContext(item);
  if (item.type === "makerModel" || (item.key === "items.model" && maker)) {
    const map = readMakerModelMap();
    map[maker] = mergeUniqueText(map[maker] || [], [item.value]);
    writeMakerModelMap(map);
  } else if (item.type === "makerModelPart" || (item.key === "items.part" && maker && model)) {
    const partMap = readMakerModelPartMap();
    const key = makerModelKey(maker, model);
    partMap[key] = mergeUniqueText(partMap[key] || [], [item.value]);
    writeMakerModelPartMap(partMap);
  } else {
    rememberValue(item.key, item.value);
  }
  list.splice(itemIndex, 1);
  writeList(CANDIDATE_TRASH_KEY, list);
  renderRecordList("trash");
}

function askPermanentDelete(type, value, label) {
  pendingPermanentDelete = { type, value };
  document.getElementById("permanentDeleteTitle").textContent = `${label}を完全削除しますか？`;
  document.getElementById("permanentDeleteConfirm").hidden = false;
}

function closePermanentDeleteConfirm() {
  document.getElementById("permanentDeleteConfirm").hidden = true;
  pendingPermanentDelete = null;
}

function confirmPermanentDelete() {
  if (pendingPermanentDelete?.type === "estimate") {
    deleteForever(pendingPermanentDelete.value);
  }
  if (pendingPermanentDelete?.type === "candidate") {
    deleteCandidateForever(pendingPermanentDelete.value);
  }
  closePermanentDeleteConfirm();
}

function fitMobileSheet() {
  const viewportScale = window.visualViewport?.scale || 1;
  const activeElement = document.activeElement;
  if (Math.abs(viewportScale - 1) > 0.02 || activeElement?.matches?.("#estimateView [data-key]")) return;
  const estimateView = document.getElementById("estimateView");
  const sheet = document.getElementById("sheet");
  const wrap = document.querySelector(".wrap");
  const shouldFit = window.matchMedia("(max-width: 1180px), (pointer: coarse)").matches;
  if (!shouldFit) {
    document.documentElement.style.setProperty("--sheet-scale", "1");
    estimateView.style.minHeight = "";
    wrap.style.overflowX = "";
    wrap.style.overflowY = "";
    return;
  }
  const toolbar = document.querySelector(".toolbar");
  const availableWidth = Math.max(320, window.innerWidth - 20);
  const availableHeight = Math.max(260, window.innerHeight - toolbar.getBoundingClientRect().height - 20);
  const baseWidth = 1120;
  const baseHeight = sheet.scrollHeight;
  const fitWidth = availableWidth / baseWidth;
  const fitHeight = availableHeight / baseHeight;
  const isLandscape = window.innerWidth > window.innerHeight;
  const readableFloor = window.innerWidth >= 700 ? 0.68 : isLandscape ? 0.56 : 0.46;
  const scale = Math.min(1, Math.max(fitWidth, readableFloor));
  document.documentElement.style.setProperty("--sheet-scale", String(scale));
  estimateView.style.minHeight = `${Math.ceil(sheet.scrollHeight * scale)}px`;
  wrap.style.overflowX = scale > fitWidth ? "auto" : isLandscape ? "hidden" : "auto";
  wrap.style.overflowY = "auto";
}

async function checkForAppUpdate() {
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const url = `${location.origin}${location.pathname}?_update=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const html = await res.text();
    const match = html.match(/<meta name="mitsumori-app-version" content="([^"]+)"/);
    if (!match || match[1] === APP_VERSION) return;
    sessionStorage.setItem(UPDATE_RESTORE_KEY, `${location.pathname}${location.hash || ""}`);
    location.replace(url);
  } catch (error) {
    console.warn("App update check failed:", error);
  }
}

function restoreCleanUrlAfterUpdate() {
  const restoreUrl = sessionStorage.getItem(UPDATE_RESTORE_KEY);
  if (!restoreUrl) return;
  sessionStorage.removeItem(UPDATE_RESTORE_KEY);
  history.replaceState(null, "", restoreUrl);
}

function installAutoUpdateCheck() {
  if (!/^https?:$/.test(location.protocol)) return;
  setTimeout(checkForAppUpdate, 1500);
  window.addEventListener("focus", checkForAppUpdate);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkForAppUpdate();
  });
  setInterval(checkForAppUpdate, 5 * 60 * 1000);
}
