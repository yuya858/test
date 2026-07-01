function candidateMakerOptions() {
  const history = readHistory();
  const map = readMakerModelMap();
  return mergeUniqueText(history["items.maker"] || [], Object.keys(map))
    .filter((maker) => !isDeletedCandidate("items.maker", maker));
}

function fillSelect(select, values, selectedValue, newLabel) {
  const options = values.map((value) =>
    `<option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(value)}</option>`
  );
  options.push(`<option value="__new__"${selectedValue === "__new__" ? " selected" : ""}>＋ ${newLabel}</option>`);
  select.innerHTML = options.join("");
  if (!select.value && values.length) select.value = values[0];
}

function candidateAddMakerValue() {
  const select = document.getElementById("candidateMakerSelect");
  if (select?.value === "__new__") {
    return document.getElementById("candidateNewMakerText").value.trim();
  }
  return String(select?.value || "").trim();
}

function candidateAddModelValue() {
  const select = document.getElementById("candidateModelSelect");
  if (select?.value === "__new__") {
    return document.getElementById("candidateNewModelText").value.trim();
  }
  return String(select?.value || "").trim();
}

function refreshCandidateAddModelOptions() {
  const makerSelect = document.getElementById("candidateMakerSelect");
  const modelSelect = document.getElementById("candidateModelSelect");
  const newMaker = document.getElementById("candidateNewMakerText");
  const newModel = document.getElementById("candidateNewModelText");
  const maker = makerSelect.value === "__new__" ? "" : makerSelect.value;
  newMaker.hidden = makerSelect.value !== "__new__";
  if (makerSelect.value === "__new__") {
    fillSelect(modelSelect, [], "__new__", "新規型式");
    modelSelect.value = "__new__";
  } else {
    const models = visibleCandidateValues("items.model", readMakerModelMap()[maker] || [], maker);
    fillSelect(modelSelect, models, activeCandidateMaker === maker ? activeCandidateModel : models[0], "新規型式");
  }
  newModel.hidden = modelSelect.value !== "__new__";
  updateCandidateActionButtons();
}

function refreshCandidateAddMakerOptions() {
  const makerSelect = document.getElementById("candidateMakerSelect");
  const makers = candidateMakerOptions();
  const selected = activeCandidateMaker || makers[0] || "__new__";
  fillSelect(makerSelect, makers, selected, "新規メーカー");
  refreshCandidateAddModelOptions();
}

function resetCandidateAddPanel() {
  candidateAddMode = "";
  document.getElementById("candidateText").value = "";
  document.getElementById("candidatePartNoText").value = "";
  document.getElementById("candidateNewMakerText").value = "";
  document.getElementById("candidateNewModelText").value = "";
  document.getElementById("candidateText").placeholder = "追加する文字";
  document.getElementById("candidateMakerSelect").hidden = true;
  document.getElementById("candidateNewMakerText").hidden = true;
  document.getElementById("candidateModelSelect").hidden = true;
  document.getElementById("candidateNewModelText").hidden = true;
  document.getElementById("candidatePartNoText").hidden = true;
  document.getElementById("candidateAddPanel").hidden = true;
  updateCandidateActionButtons();
}

function openCandidateAddPanel() {
  const panel = document.getElementById("candidateAddPanel");
  panel.hidden = false;
  document.getElementById("candidateText").value = "";
  document.getElementById("candidatePartNoText").value = "";
  document.getElementById("candidateNewMakerText").value = "";
  document.getElementById("candidateNewModelText").value = "";
  selectCandidateAddMode("part");
  updateCandidateActionButtons();
}

function selectCandidateAddMode(mode) {
  candidateAddMode = mode;
  const text = document.getElementById("candidateText");
  const partNo = document.getElementById("candidatePartNoText");
  const makerSelect = document.getElementById("candidateMakerSelect");
  const modelSelect = document.getElementById("candidateModelSelect");
  const newMaker = document.getElementById("candidateNewMakerText");
  const newModel = document.getElementById("candidateNewModelText");
  text.value = "";
  partNo.value = "";
  text.placeholder = mode === "part" ? "部品名" : "メーカー名";
  makerSelect.hidden = mode !== "part";
  modelSelect.hidden = mode !== "part";
  newMaker.hidden = true;
  newModel.hidden = true;
  partNo.hidden = mode !== "part";
  if (mode === "part") refreshCandidateAddMakerOptions();
  text.focus();
  updateCandidateActionButtons();
}

function selectCandidateItem(row) {
  selectedCandidateParts.clear();
  candidateBulkAddConfirm = false;
  document.querySelectorAll("#candidateList .candidate-row.selected").forEach((item) => {
    item.classList.remove("selected");
  });
  row.classList.add("selected");
  selectedCandidateItem = {
    type: row.dataset.type,
    key: row.dataset.key,
    maker: row.dataset.maker,
    value: row.dataset.value,
  };
  updateCandidateActionButtons();
}

function toggleCandidatePart(button) {
  const part = String(button?.dataset.value || "").trim();
  if (!part) return;
  const row = button.closest("tr");
  selectedCandidateItem = null;
  document.querySelectorAll("#candidateList .candidate-row.selected").forEach((item) => {
    item.classList.remove("selected");
  });
  if (selectedCandidateParts.has(part)) {
    selectedCandidateParts.delete(part);
    row?.classList.remove("selected");
  } else {
    selectedCandidateParts.add(part);
    row?.classList.add("selected");
  }
  candidateBulkAddConfirm = false;
  updateCandidateActionButtons();
}

function addSelectedCandidateParts() {
  if (!candidateBulkAddConfirm) {
    candidateBulkAddConfirm = true;
    updateCandidateActionButtons();
    return;
  }
  addCandidatePartsToEstimate(activeCandidateMaker, activeCandidateModel, selectedPartItems());
}

function editSelectedCandidatePart() {
  if (selectedCandidateItem?.type === "history") {
    editCandidateValue(selectedCandidateItem.key, selectedCandidateItem.value);
    selectedCandidateItem = null;
    updateCandidateActionButtons();
    return;
  }
  if (selectedCandidateItem?.type === "makerModel") {
    editMakerModel(selectedCandidateItem.maker, selectedCandidateItem.value);
    selectedCandidateItem = null;
    updateCandidateActionButtons();
    return;
  }
  const [part] = Array.from(selectedCandidateParts);
  if (!part) return;
  editMakerModelPart(activeCandidateMaker, activeCandidateModel, part);
}

function askSelectedCandidatePartsDelete() {
  if (selectedCandidateItem?.type === "history") {
    askCandidateDelete(selectedCandidateItem.key, selectedCandidateItem.value);
    return;
  }
  if (selectedCandidateItem?.type === "makerModel") {
    askMakerModelDelete(selectedCandidateItem.maker, selectedCandidateItem.value);
    return;
  }
  const values = Array.from(selectedCandidateParts);
  if (!values.length) return;
  candidateBulkAddConfirm = false;
  updateCandidateActionButtons();
  if (values.length === 1) {
    askMakerModelPartDelete(activeCandidateMaker, activeCandidateModel, values[0]);
    return;
  }
  pendingCandidateDelete = {
    type: "makerModelParts",
    key: "items.part",
    maker: activeCandidateMaker,
    model: activeCandidateModel,
    values,
  };
  document.getElementById("candidateDeleteTitle").textContent = `選択した${values.length}件の候補を削除しますか？`;
  document.getElementById("candidateDeleteConfirm").hidden = false;
}

function addCandidateFromList() {
  const value = document.getElementById("candidateText").value.trim();
  const partNo = document.getElementById("candidatePartNoText").value.trim();
  const wasPartMode = candidateAddMode === "part";
  if (candidateAddMode === "maker") {
    if (isDeletedCandidate("items.maker", value)) return;
    rememberValue("items.maker", value);
    activeCandidateKey = "items.maker";
  }
  if (candidateAddMode === "part") {
    const maker = candidateAddMakerValue();
    const model = candidateAddModelValue();
    if (!maker || !model) return;
    if (isDeletedCandidate("items.maker", maker)) return;
    if (isDeletedCandidate("items.model", model, maker)) return;
    if (isDeletedCandidate("items.part", value, maker, model)) return;
    if (isDeletedCandidate("items.part_no", partNo, maker, model)) return;
    rememberValue("items.maker", maker);
    const modelMap = readMakerModelMap();
    modelMap[maker] = addUnique(modelMap[maker], model);
    writeMakerModelMap(modelMap);
    const partMap = readMakerModelPartMap();
    const key = makerModelKey(maker, model);
    partMap[key] = addUnique(partMap[key], value);
    writeMakerModelPartMap(partMap);
    const numberMap = readPartNumberMap();
    if (partNo) {
      numberMap[partNumberKey(maker, model, value)] = partNo;
    } else {
      delete numberMap[partNumberKey(maker, model, value)];
    }
    writePartNumberMap(numberMap);
    activeCandidateMaker = maker;
    activeCandidateModel = model;
  }
  resetCandidateAddPanel();
  if (wasPartMode && activeCandidateMaker && activeCandidateModel) {
    showPartsForMakerModel(activeCandidateMaker, activeCandidateModel, false);
  } else {
    refreshCandidateView();
  }
}

function editCandidateValue(key, oldValue) {
  const nextValue = prompt("候補を編集", oldValue);
  const text = String(nextValue || "").trim();
  if (!text || text === oldValue) return;
  const history = readHistory();
  const normalizedKey = historyKey(key);
  history[normalizedKey] = (history[normalizedKey] || []).map((item) => item === oldValue ? text : item);
  writeHistory(history);
  renderCandidateList();
}

function editMakerModel(maker, oldModel) {
  const nextModel = prompt("型式を編集", oldModel);
  const text = String(nextModel || "").trim();
  if (!text || text === oldModel) return;
  const map = readMakerModelMap();
  map[maker] = (map[maker] || []).map((item) => item === oldModel ? text : item);
  writeMakerModelMap(map);
  const partMap = readMakerModelPartMap();
  const oldKey = makerModelKey(maker, oldModel);
  const newKey = makerModelKey(maker, text);
  if (partMap[oldKey]) {
    partMap[newKey] = mergeUniqueText(partMap[newKey] || [], partMap[oldKey] || []);
    delete partMap[oldKey];
    writeMakerModelPartMap(partMap);
  }
  const numberMap = readPartNumberMap();
  Object.keys(numberMap).forEach((key) => {
    const parts = key.split("|||");
    if (parts.length === 3 && parts[0] === maker && parts[1] === oldModel) {
      numberMap[partNumberKey(maker, text, parts[2])] = numberMap[key];
      delete numberMap[key];
    }
    if (parts.length === 2 && parts[0] === oldModel) {
      delete numberMap[key];
    }
  });
  writePartNumberMap(numberMap);
  showModelsForMaker(maker, false);
}

function editMakerModelPart(maker, model, oldPart) {
  const nextPart = prompt("部品名を編集", oldPart);
  const text = String(nextPart || "").trim();
  if (!text) return;
  const oldPartNo = partNumberForRow(maker, model, oldPart);
  const nextPartNo = prompt("部品番号を編集（空白でもOK）", oldPartNo);
  if (nextPartNo === null) return;
  const partNoText = String(nextPartNo || "").trim();
  if (text === oldPart && partNoText === oldPartNo) return;
  const partMap = readMakerModelPartMap();
  const key = makerModelKey(maker, model);
  partMap[key] = addUnique((partMap[key] || []).filter((item) => item !== oldPart), text);
  writeMakerModelPartMap(partMap);
  const numberMap = readPartNumberMap();
  const makerNumberKey = partNumberKey(maker, model, oldPart);
  const oldNumberKey = partMapKey(model, oldPart);
  delete numberMap[makerNumberKey];
  delete numberMap[oldNumberKey];
  if (partNoText) {
    numberMap[partNumberKey(maker, model, text)] = partNoText;
  }
  writePartNumberMap(numberMap);
  showPartsForMakerModel(maker, model, false);
}

function selectCandidateKey(key) {
  candidateBackStack = [];
  activeCandidateMaker = "";
  activeCandidateModel = "";
  selectedCandidateParts.clear();
  candidateBulkAddConfirm = false;
  activeCandidateKey = key;
  renderCandidateList();
}

function askCandidateDelete(key, value) {
  pendingCandidateDelete = { type: "history", key, value };
  document.getElementById("candidateDeleteTitle").textContent = `「${value}」を削除しますか？`;
  document.getElementById("candidateDeleteConfirm").hidden = false;
}

function askMakerModelDelete(maker, model) {
  pendingCandidateDelete = { type: "makerModel", key: "items.model", maker, value: model };
  document.getElementById("candidateDeleteTitle").textContent = `「${maker}」の型式「${model}」を削除しますか？`;
  document.getElementById("candidateDeleteConfirm").hidden = false;
}

function askMakerModelPartDelete(maker, model, part) {
  pendingCandidateDelete = { type: "makerModelPart", key: "items.part", maker, model, value: part };
  document.getElementById("candidateDeleteTitle").textContent = `「${maker}」の型式「${model}」の部品「${part}」を削除しますか？`;
  document.getElementById("candidateDeleteConfirm").hidden = false;
}

function closeCandidateDeleteConfirm() {
  document.getElementById("candidateDeleteConfirm").hidden = true;
  pendingCandidateDelete = null;
}

function confirmCandidateDelete() {
  if (pendingCandidateDelete?.type === "makerModel") {
    deleteMakerModel(pendingCandidateDelete.maker, pendingCandidateDelete.value);
  } else if (pendingCandidateDelete?.type === "makerModelPart") {
    deleteMakerModelPart(pendingCandidateDelete.maker, pendingCandidateDelete.model, pendingCandidateDelete.value);
  } else if (pendingCandidateDelete?.type === "makerModelParts") {
    deleteMakerModelParts(pendingCandidateDelete.maker, pendingCandidateDelete.model, pendingCandidateDelete.values);
  } else if (pendingCandidateDelete) {
    const trash = readList(CANDIDATE_TRASH_KEY);
    trash.unshift({
      ...pendingCandidateDelete,
      label: candidateLabel(pendingCandidateDelete.key),
      deletedAt: nowText(),
    });
    writeList(CANDIDATE_TRASH_KEY, trash);
    forgetValue(pendingCandidateDelete.key, pendingCandidateDelete.value);
    sanitizeDeletedCandidatesFromLocal();
    renderCandidateList();
  }
  closeCandidateDeleteConfirm();
}

function deleteMakerModel(maker, model) {
  const map = readMakerModelMap();
  map[maker] = (map[maker] || []).filter((item) => item !== model);
  writeMakerModelMap(map);
  const deletedParts = readMakerModelPartMap()[makerModelKey(maker, model)] || [];
  deletedParts.forEach((part) => {
    const partNo = partNumberForRow(maker, model, part);
    if (partNo) forgetValue("items.part_no", partNo);
  });
  const trash = readList(CANDIDATE_TRASH_KEY);
  trash.unshift({
    type: "makerModel",
    maker,
    key: "items.model",
    value: model,
    label: `型式（${maker}）`,
    deletedAt: nowText(),
  });
  writeList(CANDIDATE_TRASH_KEY, trash);
  sanitizeDeletedCandidatesFromLocal();
  showModelsForMaker(maker);
}

function deleteMakerModelPart(maker, model, part) {
  const map = readMakerModelPartMap();
  const key = makerModelKey(maker, model);
  map[key] = (map[key] || []).filter((item) => item !== part);
  writeMakerModelPartMap(map);
  const numberMap = readPartNumberMap();
  const partNo = partNumberForRow(maker, model, part);
  delete numberMap[partNumberKey(maker, model, part)];
  delete numberMap[partMapKey(model, part)];
  writePartNumberMap(numberMap);
  if (partNo) forgetValue("items.part_no", partNo);
  const trash = readList(CANDIDATE_TRASH_KEY);
  trash.unshift({
    type: "makerModelPart",
    maker,
    model,
    partNo,
    key: "items.part",
    value: part,
    label: `部品名（${maker} / ${model}）`,
    deletedAt: nowText(),
  });
  writeList(CANDIDATE_TRASH_KEY, trash);
  sanitizeDeletedCandidatesFromLocal();
  showPartsForMakerModel(maker, model);
}

function deleteMakerModelParts(maker, model, parts) {
  const values = (parts || []).map((part) => String(part || "").trim()).filter(Boolean);
  if (!values.length) return;
  const deletedItems = values.map((part) => ({
    part,
    partNo: partNumberForRow(maker, model, part),
  }));
  const map = readMakerModelPartMap();
  const key = makerModelKey(maker, model);
  const valueSet = new Set(values);
  map[key] = (map[key] || []).filter((item) => !valueSet.has(item));
  writeMakerModelPartMap(map);
  const numberMap = readPartNumberMap();
  deletedItems.forEach(({ part, partNo }) => {
    delete numberMap[partNumberKey(maker, model, part)];
    delete numberMap[partMapKey(model, part)];
    if (partNo) forgetValue("items.part_no", partNo);
  });
  writePartNumberMap(numberMap);
  const trash = readList(CANDIDATE_TRASH_KEY);
  deletedItems.forEach(({ part, partNo }) => {
    trash.unshift({
      type: "makerModelPart",
      maker,
      model,
      partNo,
      key: "items.part",
      value: part,
      label: `部品名（${maker} / ${model}）`,
      deletedAt: nowText(),
    });
  });
  writeList(CANDIDATE_TRASH_KEY, trash);
  sanitizeDeletedCandidatesFromLocal();
  selectedCandidateParts.clear();
  showPartsForMakerModel(maker, model);
}
