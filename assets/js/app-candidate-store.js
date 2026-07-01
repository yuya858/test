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
