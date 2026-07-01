document.getElementById("addRowBtn").addEventListener("click", () => {
  if (document.getElementById("addRowBtn").disabled) return;
  rememberUndoState();
  const data = collect();
  renderRows(itemRows.children.length + 1);
  apply({ ...data, rowCount: itemRows.children.length });
  fitMobileSheet();
  fitPrintRows();
  updatePrimaryButtons();
});
document.getElementById("insertRowBtn").addEventListener("click", () => {
  rememberUndoState();
  insertBlankRowAt(activeRowIndex());
  fitMobileSheet();
  fitPrintRows();
  updatePrimaryButtons();
});
document.getElementById("removeRowBtn").addEventListener("click", () => {
  if (document.getElementById("removeRowBtn").disabled) return;
  rememberUndoState();
  deleteRow();
});
document.getElementById("clearBtn").addEventListener("click", () => {
  openClearConfirm();
});
document.getElementById("clearNoBtn").addEventListener("click", closeClearConfirm);
document.getElementById("makerMissingOkBtn").addEventListener("click", closeMakerMissing);
document.getElementById("clearYesBtn").addEventListener("click", () => {
  rememberUndoState();
  fields().forEach((el) => { el.value = ""; });
  closeClearConfirm();
  updatePrimaryButtons();
});

document.getElementById("estimateView").addEventListener("input", (event) => {
  updatePrimaryButtons();
  if (event.target.matches("[data-key]")) {
    activeInput = event.target;
    showSuggestions(event.target);
    fillPartNumberForPartInput(event.target);
  }
});

document.getElementById("estimateView").addEventListener("focusin", (event) => {
  if (event.target.matches("[data-key]")) {
    rememberUndoState();
    activeInput = event.target;
    showSuggestions(event.target);
  }
});

document.getElementById("estimateView").addEventListener("focusout", (event) => {
  setTimeout(() => {
    const box = document.getElementById("suggestBox");
    if (box.matches(":hover") || box.contains(document.activeElement)) return;
    if (document.activeElement?.matches?.("#estimateView [data-key]")) return;
  }, 800);
});

document.getElementById("suggestBox").addEventListener("pointerdown", (event) => {
  const button = event.target.closest("[data-suggest]");
  if (!button) return;
  event.preventDefault();
  chooseSuggestion(button);
});

document.getElementById("suggestBox").addEventListener("touchstart", (event) => {
  const button = event.target.closest("[data-suggest]");
  if (!button) return;
  event.preventDefault();
  chooseSuggestion(button);
}, { passive: false });

document.getElementById("suggestBox").addEventListener("click", (event) => {
  const button = event.target.closest("[data-suggest]");
  if (!button) return;
  chooseSuggestion(button);
});

document.getElementById("candidateAddStartBtn").addEventListener("click", openCandidateAddPanel);
document.getElementById("candidateAddCancelBtn").addEventListener("click", resetCandidateAddPanel);
document.getElementById("candidateAddBtn").addEventListener("click", addCandidateFromList);
document.getElementById("candidateText").addEventListener("input", updateCandidateActionButtons);
document.getElementById("candidatePartNoText").addEventListener("input", updateCandidateActionButtons);
document.getElementById("candidateNewMakerText").addEventListener("input", updateCandidateActionButtons);
document.getElementById("candidateNewModelText").addEventListener("input", updateCandidateActionButtons);
document.getElementById("candidateMakerSelect").addEventListener("change", refreshCandidateAddModelOptions);
document.getElementById("candidateModelSelect").addEventListener("change", () => {
  document.getElementById("candidateNewModelText").hidden = document.getElementById("candidateModelSelect").value !== "__new__";
  updateCandidateActionButtons();
});
document.getElementById("candidateBulkAddBtn").addEventListener("click", addSelectedCandidateParts);
document.getElementById("candidateEditSelectedBtn").addEventListener("click", editSelectedCandidatePart);
document.getElementById("candidateDeleteSelectedBtn").addEventListener("click", askSelectedCandidatePartsDelete);
document.getElementById("candidateBackBtn").addEventListener("click", goCandidateBack);
document.getElementById("candidateSearchInput").addEventListener("input", () => {
  updateCandidateActionButtons();
  refreshCandidateView();
});
document.getElementById("candidateSearchClearBtn").addEventListener("click", () => {
  document.getElementById("candidateSearchInput").value = "";
  updateCandidateActionButtons();
  refreshCandidateView();
});
document.getElementById("candidateView").addEventListener("click", (event) => {
  const button = event.target.closest("[data-candidate-key]");
  if (!button) return;
  selectCandidateKey(button.dataset.candidateKey);
});
document.getElementById("candidateDeleteNoBtn").addEventListener("click", closeCandidateDeleteConfirm);
document.getElementById("candidateDeleteYesBtn").addEventListener("click", confirmCandidateDelete);
document.getElementById("candidateList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const row = event.target.closest("tr[data-action='selectCandidateItem']");
  if (row && !button) {
    selectCandidateItem(row);
    return;
  }
  if (!button) return;
  if (button.dataset.action === "showMakerModels") {
    showModelsForMaker(button.dataset.maker);
  }
  if (button.dataset.action === "showPartsForMakerModel") {
    showPartsForMakerModel(button.dataset.maker, button.dataset.model);
  }
  if (button.dataset.action === "toggleCandidatePart") {
    toggleCandidatePart(button);
  }
  if (button.dataset.action === "addCandidateToEstimate") {
    addCandidateToEstimate(button.dataset.maker, button.dataset.model, button.dataset.value, button.dataset.partNo);
  }
  if (button.dataset.action === "editCandidate") {
    editCandidateValue(button.dataset.key, button.dataset.value);
  }
  if (button.dataset.action === "editMakerModel") {
    editMakerModel(button.dataset.maker, button.dataset.value);
  }
  if (button.dataset.action === "editMakerModelPart") {
    editMakerModelPart(button.dataset.maker, button.dataset.model, button.dataset.value);
  }
  if (button.dataset.action === "askCandidateDelete") {
    askCandidateDelete(button.dataset.key, button.dataset.value);
  }
  if (button.dataset.action === "askMakerModelDelete") {
    askMakerModelDelete(button.dataset.maker, button.dataset.value);
  }
  if (button.dataset.action === "askMakerModelPartDelete") {
    askMakerModelPartDelete(button.dataset.maker, button.dataset.model, button.dataset.value);
  }
});

document.getElementById("savedList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "open") loadRecord(button.dataset.id);
  if (button.dataset.action === "trash") moveToTrash(button.dataset.id);
});

document.getElementById("draftList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "openDraft") loadDraft(button.dataset.id);
  if (button.dataset.action === "deleteDraft") removeDraft(button.dataset.id);
});

document.getElementById("trashList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "restore") restoreRecord(button.dataset.id);
  if (button.dataset.action === "delete") askPermanentDelete("estimate", button.dataset.id, "この見積もり");
  if (button.dataset.action === "restoreCandidate") restoreCandidate(button.dataset.index);
  if (button.dataset.action === "deleteCandidateForever") askPermanentDelete("candidate", button.dataset.index, "この候補");
});

document.getElementById("permanentDeleteNoBtn").addEventListener("click", closePermanentDeleteConfirm);
document.getElementById("permanentDeleteYesBtn").addEventListener("click", confirmPermanentDelete);

window.addEventListener("beforeprint", fitPrintRows);

async function initApp() {
  await loadCloudState();
  renderRows(14);
  renderRecordList("saved");
  renderRecordList("draft");
  renderCandidateList();
  renderRecordList("trash");
  markClean({ rowCount: 14 });
  showView("estimate");
  fitMobileSheet();
  fitPrintRows();
  updatePrimaryButtons();
  updateUndoButton();
  installAutoUpdateCheck();
  window.addEventListener("resize", fitMobileSheet);
  window.addEventListener("orientationchange", fitMobileSheet);
}

initApp();
