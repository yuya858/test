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
