const STORAGE_KEY = "mitsumori_irai_records_v2";
const DRAFT_KEY = "mitsumori_irai_drafts_v2";
const TRASH_KEY = "mitsumori_irai_trash_v2";
const HISTORY_KEY = "mitsumori_irai_input_history_v1";
const PART_NUMBER_KEY = "mitsumori_irai_part_number_map_v1";
const MAKER_MODEL_KEY = "mitsumori_irai_maker_model_map_v1";
const MAKER_MODEL_PART_KEY = "mitsumori_irai_maker_model_part_map_v1";
const CANDIDATE_TRASH_KEY = "mitsumori_irai_candidate_trash_v1";
const CANDIDATE_PURGED_KEY = "mitsumori_irai_candidate_purged_v1";
const APP_VERSION = "2026-07-02-2";
const UPDATE_RESTORE_KEY = "mitsumori_app_update_restore_url";
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
