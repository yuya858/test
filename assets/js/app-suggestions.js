function historyKey(rawKey) {
  return rawKey.replace(/^items\.\d+\./, "items.");
}

function shouldUseHistory(rawKey) {
  const key = historyKey(rawKey);
  return [
    "user_name",
    "property_name",
    "items.maker",
    "items.model",
    "items.part",
    "items.part_no",
  ].includes(key);
}

function candidateLabel(key) {
  const labels = {
    user_name: "ユーザー名",
    property_name: "物件名",
    "items.maker": "メーカー",
    "items.model": "型式",
    "items.part": "部品名",
    "items.part_no": "部品番号",
  };
  return labels[key] || key;
}

function readingFor(value) {
  const dictionary = {
    "三菱": "みつびし",
    "三菱電機": "みつびしでんき",
    "ダイキン": "だいきん",
    "日立": "ひたち",
    "東芝": "とうしば",
    "パナソニック": "ぱなそにっく",
    "パナ": "ぱな",
    "シャープ": "しゃーぷ",
    "富士通": "ふじつう",
    "三洋": "さんよう",
    "川本": "かわもと",
    "荏原": "えばら",
    "テラル": "てらる",
  };
  return dictionary[value] || "";
}

function rememberValue(key, value) {
  const text = String(value || "").trim();
  if (!text) return;
  if (!shouldUseHistory(key)) return;
  const normalizedKey = historyKey(key);
  if (isDeletedCandidate(normalizedKey, text)) return;
  const history = readHistory();
  const list = history[normalizedKey] || [];
  history[normalizedKey] = [text, ...list.filter((item) => item !== text)].slice(0, 40);
  writeHistory(history);
}

function forgetValue(key, value) {
  const text = String(value || "").trim();
  if (!text || !shouldUseHistory(key)) return;
  const normalizedKey = historyKey(key);
  const history = readHistory();
  history[normalizedKey] = (history[normalizedKey] || []).filter((item) => item !== text);
  writeHistory(history);
}

function addCurrentCandidate() {
  if (!activeInput || !activeInput.dataset.key) return;
  rememberValue(activeInput.dataset.key, activeInput.value);
  showSuggestions(activeInput);
}

function deleteCurrentCandidate() {
  if (!activeInput || !activeInput.dataset.key) return;
  const visibleSuggestion = document.querySelector("#suggestBox:not([hidden]) [data-suggest]");
  const currentValue = String(activeInput.value || "").trim();
  const history = readHistory()[historyKey(activeInput.dataset.key)] || [];
  const target = history.includes(currentValue)
    ? currentValue
    : visibleSuggestion?.dataset.suggest;
  forgetValue(activeInput.dataset.key, target);
  showSuggestions(activeInput);
}

function rememberData(data) {
  Object.entries(data).forEach(([key, value]) => {
    if (key !== "rowCount") rememberValue(key, value);
  });
  rememberPartNumbers(data);
  rememberMakerModels(data);
  renderCandidateList();
}

function rememberMakerModels(data) {
  const map = readMakerModelMap();
  const partMap = readMakerModelPartMap();
  rowsWithEffectiveContext(valuesToRows(data)).forEach((row) => {
    const maker = String(row.effectiveMaker || row.maker || "").trim();
    const model = String(row.effectiveModel || row.model || "").trim();
    const part = String(row.part || "").trim();
    if (!maker || !model) return;
    if (isDeletedCandidate("items.maker", maker)) return;
    if (isDeletedCandidate("items.model", model, maker)) return;
    map[maker] = addUnique(map[maker], model);
    if (part && !isDeletedCandidate("items.part", part, maker, model)) {
      const key = makerModelKey(maker, model);
      partMap[key] = addUnique(partMap[key], part);
    }
  });
  writeMakerModelMap(map);
  writeMakerModelPartMap(partMap);
}

function rememberPartNumbers(data) {
  const map = readPartNumberMap();
  rowsWithEffectiveContext(valuesToRows(data)).forEach((row) => {
    const maker = String(row.effectiveMaker || row.maker || "").trim();
    const model = String(row.effectiveModel || row.model || "").trim();
    const part = String(row.part || "").trim();
    const partNo = String(row.part_no || "").trim();
    if (!maker || !model || !part || !partNo) return;
    if (isDeletedCandidate("items.maker", maker)) return;
    if (isDeletedCandidate("items.model", model, maker)) return;
    if (isDeletedCandidate("items.part", part, maker, model)) return;
    if (isDeletedCandidate("items.part_no", partNo, maker, model)) return;
    map[partNumberKey(maker, model, part)] = partNo;
  });
  writePartNumberMap(map);
}

function rowIndexFromKey(key) {
  const match = /^items\.(\d+)\./.exec(key || "");
  return match ? Number(match[1]) : null;
}

function rowContextFromKey(key) {
  const index = rowIndexFromKey(key);
  if (index === null) return { index: null, maker: "", model: "", part: "" };
  const row = rowsWithEffectiveContext(valuesToRows(collect()))[index] || {};
  return {
    index,
    place: String(row.effectivePlace || row.place || "").trim(),
    maker: String(row.effectiveMaker || row.maker || "").trim(),
    model: String(row.effectiveModel || row.model || "").trim(),
    part: String(row.part || "").trim(),
  };
}

function filterSuggestions(list, typed) {
  const query = String(typed || "").trim();
  const unique = Array.from(new Set((list || []).filter(Boolean)));
  if (!query) return unique.slice(0, 8);
  return unique.filter((item) =>
    item !== query && (item.includes(query) || readingFor(item).startsWith(query))
  ).slice(0, 8);
}

function partNumberForRow(maker, model, part) {
  const makerText = String(maker || "").trim();
  const modelText = String(model || "").trim();
  const partText = String(part || "").trim();
  if (!makerText || !modelText || !partText) return "";
  if (isDeletedCandidate("items.maker", makerText)) return "";
  if (isDeletedCandidate("items.model", modelText, makerText)) return "";
  if (isDeletedCandidate("items.part", partText, makerText, modelText)) return "";
  const map = readPartNumberMap();
  const partNo = map[partNumberKey(makerText, modelText, partText)] || "";
  return isDeletedCandidate("items.part_no", partNo, makerText, modelText) ? "" : partNo;
}

function fillPartNumberForPartInput(input, force = false) {
  if (!input || !/^items\.\d+\.part$/.test(input.dataset.key || "")) return;
  const { index, maker, model } = rowContextFromKey(input.dataset.key);
  if (index === null) return;
  const part = input.value;
  const partNo = partNumberForRow(maker, model, part);
  if (!partNo) return;
  const partNoInput = document.querySelector(`[data-key="items.${index}.part_no"]`);
  if (partNoInput && (force || !partNoInput.value.trim())) {
    partNoInput.value = partNo;
    partNoInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function suggestionsFor(key, typed) {
  if (!shouldUseHistory(key)) return [];
  const normalizedKey = historyKey(key);
  const history = readHistory()[normalizedKey] || [];
  const { maker, model, part } = rowContextFromKey(key);
  let scoped = [];
  if (normalizedKey === "items.model") {
    if (!maker) return [];
    scoped = readMakerModelMap()[maker] || [];
  }
  if (normalizedKey === "items.part") {
    if (!maker || !model) return [];
    scoped = readMakerModelPartMap()[makerModelKey(maker, model)] || [];
  }
  if (normalizedKey === "items.part_no") {
    if (!maker || !model || !part) return [];
    const partNo = partNumberForRow(maker, model, part);
    scoped = partNo ? [partNo] : [];
  }
  const contextScoped =
    normalizedKey === "items.model" ||
    normalizedKey === "items.part" ||
    normalizedKey === "items.part_no";
  const visibleScoped = visibleCandidateValues(normalizedKey, scoped, maker, model);
  const visibleHistory = contextScoped ? [] : visibleCandidateValues(normalizedKey, history, maker, model);
  return filterSuggestions([...visibleScoped, ...visibleHistory], typed);
}

function showSuggestions(input) {
  const box = document.getElementById("suggestBox");
  const options = suggestionsFor(input.dataset.key, input.value);
  if (!options.length) {
    box.hidden = true;
    return;
  }
  box.innerHTML = options.map((option) =>
    `<button class="suggest-option" type="button" data-suggest="${escapeHtml(option)}">${escapeHtml(option)}</button>`
  ).join("");
  box.hidden = false;
  box.dataset.targetKey = input.dataset.key;
}

function hideSuggestions() {
  const box = document.getElementById("suggestBox");
  box.hidden = true;
}

function chooseSuggestion(button) {
  if (!button) return;
  const box = document.getElementById("suggestBox");
  const key = box.dataset.targetKey;
  const input = document.querySelector(`[data-key="${key}"]`);
  if (!input) return;
  rememberUndoState();
  input.value = button.dataset.suggest;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  fillPartNumberForPartInput(input, true);
  hideSuggestions();
  input.focus();
}
