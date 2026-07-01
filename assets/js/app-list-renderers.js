function openClearConfirm() {
  document.getElementById("clearConfirm").hidden = false;
}

function closeClearConfirm() {
  document.getElementById("clearConfirm").hidden = true;
}

function recordMatchesSearch(record, query) {
  const text = String(query || "").trim();
  if (!text) return true;
  const values = [
    record.company,
    record.title,
    record.updatedAt,
    ...Object.values(record.data || {}),
  ].map((value) => String(value || ""));
  return values.some((value) => value.includes(text) || readingFor(value).includes(text));
}

function renderRecordList(kind) {
  const isTrash = kind === "trash";
  const isDraft = kind === "draft";
  const target = document.getElementById(isTrash ? "trashList" : isDraft ? "draftList" : "savedList");
  let list = readList(isTrash ? TRASH_KEY : isDraft ? DRAFT_KEY : STORAGE_KEY);
  if (!isTrash && !isDraft) {
    list = list.filter((record) =>
      recordMatchesSearch(record, document.getElementById("savedSearchInput").value)
    );
  }
  if (!list.length) {
    const searchText = document.getElementById("savedSearchInput")?.value.trim();
    target.innerHTML = isTrash
      ? renderCandidateTrashHtml(true)
      : `<div class="empty">${isDraft ? "未保存の見積もりはありません" : searchText ? "検索結果はありません" : "保存した見積もりはありません"}</div>`;
    return;
  }
  target.innerHTML = `
    <table class="record-table">
      <thead><tr><th>会社名</th><th>${isTrash ? "削除日時" : isDraft ? "退避日時" : "保存日時"}</th><th>操作</th></tr></thead>
      <tbody>
        ${list.map((record) => `
          <tr>
            <td>${escapeHtml(record.company || record.title)}</td>
            <td>${escapeHtml(isTrash ? record.deletedAt : record.updatedAt)}</td>
            <td>
              ${isTrash
                ? `<button type="button" data-action="restore" data-id="${record.id}">復元</button>
                   <button class="danger" type="button" data-action="delete" data-id="${record.id}">完全削除</button>`
                : isDraft
                ? `<button type="button" data-action="openDraft" data-id="${record.id}">開く</button>
                   <button class="danger" type="button" data-action="deleteDraft" data-id="${record.id}">削除</button>`
                : `<button type="button" data-action="open" data-id="${record.id}">開く</button>
                   <button class="danger" type="button" data-action="trash" data-id="${record.id}">ゴミ箱へ</button>`}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>${isTrash ? renderCandidateTrashHtml(false) : ""}`;
}

function renderCandidateTrashHtml(showEmptyWhenNoRecords) {
  const list = readList(CANDIDATE_TRASH_KEY);
  if (!list.length) {
    return showEmptyWhenNoRecords ? `<div class="empty">ゴミ箱は空です</div>` : "";
  }
  return `
    <h2 style="margin-top:18px;">削除した候補</h2>
    <table class="record-table">
      <thead><tr><th>項目</th><th>候補</th><th>削除日時</th><th>操作</th></tr></thead>
      <tbody>
        ${list.map((item, index) => `
          <tr>
            <td>${escapeHtml(item.label || candidateLabel(item.key))}</td>
            <td>${escapeHtml(item.value)}</td>
            <td>${escapeHtml(item.deletedAt)}</td>
            <td>
              <button type="button" data-action="restoreCandidate" data-index="${index}">復元</button>
              <button class="danger" type="button" data-action="deleteCandidateForever" data-index="${index}">完全削除</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function escapeHtml(text) {
  return String(text || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[ch]));
}

document.querySelectorAll("[data-view-button]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.viewButton));
});

document.getElementById("saveBtn").addEventListener("click", saveRecord);
document.getElementById("newBtn").addEventListener("click", newRecord);
document.getElementById("undoBtn").addEventListener("click", openUndoConfirm);
document.getElementById("undoNoBtn").addEventListener("click", closeUndoConfirm);
document.getElementById("undoYesBtn").addEventListener("click", confirmUndo);
document.getElementById("printBtn").addEventListener("click", () => window.print());
document.getElementById("savedSearchInput").addEventListener("input", () => renderRecordList("saved"));
document.getElementById("savedSearchClearBtn").addEventListener("click", () => {
  document.getElementById("savedSearchInput").value = "";
  renderRecordList("saved");
});
