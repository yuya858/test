function candidateSearchText() {
  return document.getElementById("candidateSearchInput")?.value.trim() || "";
}

function matchesCandidateSearch(values) {
  const query = candidateSearchText();
  if (!query) return true;
  return values.some((value) => String(value || "").includes(query));
}

function refreshCandidateView() {
  if (activeCandidateMaker && activeCandidateModel) {
    showPartsForMakerModel(activeCandidateMaker, activeCandidateModel, false);
  } else if (activeCandidateMaker) {
    showModelsForMaker(activeCandidateMaker, false);
  } else {
    renderCandidateList();
  }
}

function updateCandidateContext() {
  const target = document.getElementById("candidateContext");
  if (!target) return;
  if (activeCandidateMaker && activeCandidateModel) {
    target.textContent = `メーカー：${activeCandidateMaker}　型式：${activeCandidateModel}`;
  } else if (activeCandidateMaker) {
    target.textContent = `メーカー：${activeCandidateMaker}`;
  } else {
    target.textContent = "";
  }
}

function updateCandidateActionButtons() {
  const candidateText = document.getElementById("candidateText");
  const candidatePartNoText = document.getElementById("candidatePartNoText");
  const searchInput = document.getElementById("candidateSearchInput");
  const addBtn = document.getElementById("candidateAddBtn");
  const clearBtn = document.getElementById("candidateSearchClearBtn");
  const bulkAddBtn = document.getElementById("candidateBulkAddBtn");
  const editBtn = document.getElementById("candidateEditSelectedBtn");
  const deleteBtn = document.getElementById("candidateDeleteSelectedBtn");
  const selectedCount = selectedCandidateParts.size;
  const candidateValue = String(candidateText?.value || "").trim();
  const partMaker = candidateAddMakerValue();
  const partModel = candidateAddModelValue();
  const candidateIsBlocked = candidateAddMode === "maker"
    ? isDeletedCandidate("items.maker", candidateValue)
    : candidateAddMode === "part" && (
      isDeletedCandidate("items.maker", partMaker) ||
      isDeletedCandidate("items.model", partModel, partMaker) ||
      isDeletedCandidate("items.part", candidateValue, partMaker, partModel) ||
      isDeletedCandidate("items.part_no", String(candidatePartNoText?.value || "").trim(), partMaker, partModel)
    );
  if (addBtn) addBtn.disabled = candidateAddMode === "part"
    ? !(candidateValue && partMaker && partModel) || candidateIsBlocked
    : !(candidateAddMode === "maker" && candidateValue) || candidateIsBlocked;
  if (clearBtn) clearBtn.disabled = !String(searchInput?.value || "").trim();
  const canBulkAdd = Boolean(activeCandidateMaker && activeCandidateModel && selectedCount > 0);
  if (!canBulkAdd) candidateBulkAddConfirm = false;
  if (bulkAddBtn) {
    bulkAddBtn.disabled = !canBulkAdd;
    bulkAddBtn.textContent = candidateBulkAddConfirm ? "✓" : "見積追加";
  }
  if (editBtn) editBtn.disabled = !(selectedCandidateItem || (activeCandidateMaker && activeCandidateModel && selectedCount === 1));
  if (deleteBtn) deleteBtn.disabled = !(selectedCandidateItem || (activeCandidateMaker && activeCandidateModel && selectedCount > 0));
}

function renderCandidateList() {
  const target = document.getElementById("candidateList");
  const history = readHistory();
  const values = history[activeCandidateKey] || [];
  const rows = visibleCandidateValues(activeCandidateKey, values)
    .map((value) => ({ key: activeCandidateKey, value }))
    .filter((row) => matchesCandidateSearch([candidateLabel(row.key), row.value]));
  document.querySelectorAll("[data-candidate-key]").forEach((button) => {
    button.classList.toggle("active", button.dataset.candidateKey === activeCandidateKey);
  });
  document.getElementById("makerCandidateTabs").style.display = "none";
  activeCandidateMaker = "";
  activeCandidateModel = "";
  selectedCandidateParts.clear();
  selectedCandidateItem = null;
  candidateBulkAddConfirm = false;
  resetCandidateAddPanel();
  updateCandidateContext();
  updateCandidateActionButtons();
  updateCandidateBackButton();
  if (!rows.length) {
    target.innerHTML = `<div class="empty">${candidateLabel(activeCandidateKey)}の候補はまだありません</div>`;
    return;
  }
  target.innerHTML = `
    <table class="record-table candidate-value-table">
      <thead><tr><th>項目</th><th>候補</th></tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr class="candidate-row" data-action="selectCandidateItem" data-type="history" data-key="${escapeHtml(row.key)}" data-value="${escapeHtml(row.value)}">
            <td data-label="項目">${escapeHtml(candidateLabel(row.key))}</td>
            <td data-label="候補">${row.key === "items.maker"
              ? `<button type="button" data-action="showMakerModels" data-maker="${escapeHtml(row.value)}">${escapeHtml(row.value)}</button>`
              : escapeHtml(row.value)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function updateCandidateBackButton() {
  document.getElementById("candidateBackBtn").hidden = candidateBackStack.length === 0;
}

function showModelsForMaker(maker, rememberBack = true) {
  if (rememberBack) candidateBackStack.push({ type: "list", key: activeCandidateKey });
  activeCandidateMaker = maker;
  activeCandidateModel = "";
  selectedCandidateParts.clear();
  selectedCandidateItem = null;
  candidateBulkAddConfirm = false;
  resetCandidateAddPanel();
  const models = isDeletedCandidate("items.maker", maker)
    ? []
    : visibleCandidateValues("items.model", readMakerModelMap()[maker] || [], maker)
      .filter((model) => matchesCandidateSearch([maker, model]));
  activeCandidateKey = "items.model";
  document.querySelectorAll("[data-candidate-key]").forEach((button) => {
    button.classList.toggle("active", button.dataset.candidateKey === activeCandidateKey);
  });
  document.getElementById("makerCandidateTabs").style.display = "none";
  updateCandidateContext();
  updateCandidateActionButtons();
  updateCandidateBackButton();
  const target = document.getElementById("candidateList");
  if (!models.length) {
    target.innerHTML = `<div class="empty">${escapeHtml(maker)}の型式候補はまだありません</div>`;
    return;
  }
  target.innerHTML = `
    <table class="record-table candidate-value-table">
      <thead><tr><th>メーカー</th><th>型式</th></tr></thead>
      <tbody>
        ${models.map((model) => `
          <tr class="candidate-row" data-action="selectCandidateItem" data-type="makerModel" data-maker="${escapeHtml(maker)}" data-value="${escapeHtml(model)}">
            <td data-label="メーカー">${escapeHtml(maker)}</td>
            <td data-label="型式"><button type="button" data-action="showPartsForMakerModel" data-maker="${escapeHtml(maker)}" data-model="${escapeHtml(model)}">${escapeHtml(model)}</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function showPartsForMakerModel(maker, model, rememberBack = true) {
  if (rememberBack) candidateBackStack.push({ type: "models", maker });
  activeCandidateMaker = maker;
  activeCandidateModel = model;
  selectedCandidateParts.clear();
  selectedCandidateItem = null;
  candidateBulkAddConfirm = false;
  resetCandidateAddPanel();
  const parts = isDeletedCandidate("items.maker", maker) || isDeletedCandidate("items.model", model, maker)
    ? []
    : visibleCandidateValues("items.part", readMakerModelPartMap()[makerModelKey(maker, model)] || [], maker, model)
      .filter((part) => matchesCandidateSearch([maker, model, part, partNumberForRow(maker, model, part)]));
  activeCandidateKey = "items.part";
  document.querySelectorAll("[data-candidate-key]").forEach((button) => {
    button.classList.toggle("active", button.dataset.candidateKey === activeCandidateKey);
  });
  document.getElementById("makerCandidateTabs").style.display = "none";
  updateCandidateContext();
  updateCandidateActionButtons();
  updateCandidateBackButton();
  const target = document.getElementById("candidateList");
  if (!parts.length) {
    target.innerHTML = `<div class="empty">${escapeHtml(maker)} / ${escapeHtml(model)} の部品名・部品番号はまだありません</div>`;
    return;
  }
  target.innerHTML = `
    <table class="record-table part-choice-table">
      <thead><tr><th><div class="part-choice part-choice-heading"><span>部品名</span><span class="part-number">部品番号</span></div></th></tr></thead>
      <tbody>
        ${parts.map((part) => `
          <tr class="part-choice-row${selectedCandidateParts.has(part) ? " selected" : ""}">
            <td data-label="部品名・部品番号">
              <button class="part-choice" type="button" data-action="toggleCandidatePart" data-value="${escapeHtml(part)}" data-part-no="${escapeHtml(partNumberForRow(maker, model, part))}">
                <span>${escapeHtml(part)}</span>
                <span class="part-number">${escapeHtml(partNumberForRow(maker, model, part))}</span>
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
  updateCandidateActionButtons();
}

function goCandidateBack() {
  const previous = candidateBackStack.pop();
  if (!previous) return;
  if (previous.type === "models") {
    showModelsForMaker(previous.maker, false);
  } else {
    activeCandidateKey = previous.key;
    renderCandidateList();
  }
  updateCandidateBackButton();
}

function addCandidateToEstimate(maker, model, part, partNo) {
  addCandidatePartsToEstimate(maker, model, [{ part, partNo }]);
}

function addCandidatePartsToEstimate(maker, model, parts) {
  if (isDeletedCandidate("items.maker", maker) || isDeletedCandidate("items.model", model, maker)) return;
  const selectedParts = parts
    .map((item) => ({
      part: String(item.part || "").trim(),
      partNo: String(item.partNo || "").trim(),
    }))
    .filter((item) =>
      item.part &&
      !isDeletedCandidate("items.part", item.part, maker, model) &&
      !isDeletedCandidate("items.part_no", item.partNo, maker, model)
    );
  if (!selectedParts.length) return;
  rememberUndoState();
  const rows = valuesToRows(collect());
  const lastContentIndex = rows.reduce((last, row, rowIndex) => rowHasContent(row) ? rowIndex : last, -1);
  let index = lastContentIndex + 1;
  selectedParts.forEach((item) => {
    if (index >= rows.length) rows.push({});
    rows[index] = {
      ...rows[index],
      maker,
      model,
      part: item.part,
      part_no: item.partNo || partNumberForRow(maker, model, item.part),
    };
    index += 1;
  });
  writeRows(rows);
  fitMobileSheet();
  fitPrintRows();
  updatePrimaryButtons();
  showView("estimate");
}

function selectedPartItems() {
  if (!activeCandidateMaker || !activeCandidateModel) return [];
  return Array.from(selectedCandidateParts).map((part) => ({
    part,
    partNo: partNumberForRow(activeCandidateMaker, activeCandidateModel, part),
  }));
}
