/* ========================================================================
 * IA Sport Vision — Frontend de validation ballon
 * - charge la liste des frames depuis /api/frames
 * - affiche image raw + box overlay dessinée par le JS (éditable)
 * - POST /api/annotation pour sauvegarder
 * ====================================================================== */

const $ = (sel) => document.querySelector(sel);
const videoSelect = $("#videoSelect");
const statusSelect = $("#statusSelect");
const orderSelect = $("#orderSelect");
const reloadBtn = $("#reloadBtn");
const progress = $("#progress");
const canvas = $("#canvas");
const ctx = canvas.getContext("2d");
const metaEl = $("#meta");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const editBtn = $("#editBtn");
const resetBoxBtn = $("#resetBoxBtn");

let items = [];          // frames list
let cursor = 0;
let currentImage = null; // HTMLImageElement
let currentBox = null;   // {x,y,w,h} en coords vidéo
let originalBox = null;
let editMode = false;
let drag = null;         // {mode:'move'|'resize', startX, startY, boxStart}

// ------------------------------------------------------------------
// API
// ------------------------------------------------------------------
async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.json();
}

async function loadVideos() {
  try {
    const data = await fetchJSON("/api/videos");
    videoSelect.innerHTML = '<option value="">(toutes)</option>' +
      data.videos.map(v =>
        `<option value="${v.videoId}">${v.videoId} — ${v.pending}/${v.total} à faire</option>`
      ).join("");
  } catch (e) {
    console.error("loadVideos", e);
  }
}

async function loadFrames() {
  const videoId = videoSelect.value;
  const status = statusSelect.value;
  const orderBy = orderSelect.value;
  const params = new URLSearchParams({
    status, orderBy, limit: "100",
  });
  if (videoId) params.set("videoId", videoId);

  progress.textContent = "Chargement…";
  try {
    const data = await fetchJSON(`/api/frames?${params}`);
    items = data.items || [];
    cursor = 0;
    if (!items.length) {
      progress.textContent = "Aucune frame à afficher";
      clearCanvas();
      metaEl.textContent = "";
      return;
    }
    renderCurrent();
  } catch (e) {
    console.error(e);
    progress.textContent = "Erreur de chargement";
  }
}

async function saveAnnotation(label) {
  if (!items[cursor]) return;
  const payload = { docId: items[cursor].id, label };
  if (editMode && currentBox && boxChanged()) {
    payload.correctedBox = {
      x: Math.round(currentBox.x),
      y: Math.round(currentBox.y),
      w: Math.round(currentBox.w),
      h: Math.round(currentBox.h),
    };
  }
  try {
    await fetchJSON("/api/annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // retirer de la liste si on est en mode "pending"
    if (statusSelect.value === "pending") {
      items.splice(cursor, 1);
      if (cursor >= items.length) cursor = Math.max(0, items.length - 1);
      if (!items.length) {
        progress.textContent = "Tout annoté ✓";
        clearCanvas();
        metaEl.textContent = "";
        return;
      }
    } else {
      cursor = Math.min(cursor + 1, items.length - 1);
    }
    renderCurrent();
  } catch (e) {
    alert("Erreur de sauvegarde : " + e.message);
  }
}

// ------------------------------------------------------------------
// Rendering
// ------------------------------------------------------------------
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function renderCurrent() {
  const it = items[cursor];
  if (!it) return;
  progress.textContent = `${cursor + 1} / ${items.length}`;

  editMode = false;
  editBtn.classList.remove("active");

  const box = it.correctedBox || it.box || null;
  originalBox = box ? { ...box } : null;
  currentBox = box ? { ...box } : null;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    currentImage = img;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    drawScene();
    metaEl.textContent =
      `id: ${it.id}\n` +
      `videoId: ${it.videoId}\n` +
      `frame: ${it.frame}   time: ${it.time}s\n` +
      `source: ${it.source}   confidence: ${it.confidence}\n` +
      `status: ${it.status}   label: ${it.label || "-"}\n` +
      (currentBox ? `box: x=${currentBox.x} y=${currentBox.y} w=${currentBox.w} h=${currentBox.h}\n` : "");
  };
  img.onerror = () => {
    metaEl.textContent = "Erreur image";
  };
  img.src = it.imageRawUrl;
}

function drawScene() {
  if (!currentImage) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentImage, 0, 0);
  if (currentBox) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = editMode ? "#2196f3" : "#4caf50";
    ctx.strokeRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h);
    // poignée resize coin bas droit
    if (editMode) {
      ctx.fillStyle = "#2196f3";
      ctx.fillRect(currentBox.x + currentBox.w - 10, currentBox.y + currentBox.h - 10, 14, 14);
    }
  }
}

function boxChanged() {
  if (!currentBox || !originalBox) return !!currentBox;
  return currentBox.x !== originalBox.x
      || currentBox.y !== originalBox.y
      || currentBox.w !== originalBox.w
      || currentBox.h !== originalBox.h;
}

// ------------------------------------------------------------------
// Interactions souris pour éditer la box
// ------------------------------------------------------------------
function canvasCoords(ev) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return { x: (ev.clientX - rect.left) * sx, y: (ev.clientY - rect.top) * sy };
}

canvas.addEventListener("mousedown", (ev) => {
  if (!editMode || !currentBox) return;
  const p = canvasCoords(ev);
  const onResize =
    p.x >= currentBox.x + currentBox.w - 16 && p.x <= currentBox.x + currentBox.w + 6 &&
    p.y >= currentBox.y + currentBox.h - 16 && p.y <= currentBox.y + currentBox.h + 6;
  const inside =
    p.x >= currentBox.x && p.x <= currentBox.x + currentBox.w &&
    p.y >= currentBox.y && p.y <= currentBox.y + currentBox.h;
  if (onResize) {
    drag = { mode: "resize", start: p, boxStart: { ...currentBox } };
  } else if (inside) {
    drag = { mode: "move", start: p, boxStart: { ...currentBox } };
  } else {
    // créer une nouvelle box centrée sur le clic, 80x80
    currentBox = { x: p.x - 40, y: p.y - 40, w: 80, h: 80 };
    drag = { mode: "resize", start: p, boxStart: { ...currentBox } };
  }
});

canvas.addEventListener("mousemove", (ev) => {
  if (!drag) return;
  const p = canvasCoords(ev);
  const dx = p.x - drag.start.x;
  const dy = p.y - drag.start.y;
  if (drag.mode === "move") {
    currentBox.x = drag.boxStart.x + dx;
    currentBox.y = drag.boxStart.y + dy;
  } else {
    currentBox.w = Math.max(8, drag.boxStart.w + dx);
    currentBox.h = Math.max(8, drag.boxStart.h + dy);
  }
  drawScene();
});

window.addEventListener("mouseup", () => { drag = null; });

// ------------------------------------------------------------------
// UI events
// ------------------------------------------------------------------
reloadBtn.addEventListener("click", loadFrames);
videoSelect.addEventListener("change", loadFrames);
statusSelect.addEventListener("change", loadFrames);
orderSelect.addEventListener("change", loadFrames);

prevBtn.addEventListener("click", () => {
  if (!items.length) return;
  cursor = Math.max(0, cursor - 1);
  renderCurrent();
});
nextBtn.addEventListener("click", () => {
  if (!items.length) return;
  cursor = Math.min(items.length - 1, cursor + 1);
  renderCurrent();
});

document.querySelectorAll("[data-label]").forEach(btn => {
  btn.addEventListener("click", () => saveAnnotation(btn.dataset.label));
});

editBtn.addEventListener("click", () => {
  editMode = !editMode;
  editBtn.classList.toggle("active", editMode);
  if (editMode && !currentBox && currentImage) {
    currentBox = { x: canvas.width / 2 - 40, y: canvas.height / 2 - 40, w: 80, h: 80 };
  }
  drawScene();
});

resetBoxBtn.addEventListener("click", () => {
  currentBox = originalBox ? { ...originalBox } : null;
  drawScene();
});

document.addEventListener("keydown", (ev) => {
  if (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT") return;
  if (ev.key === "ArrowRight") nextBtn.click();
  else if (ev.key === "ArrowLeft") prevBtn.click();
  else if (ev.key === "1") saveAnnotation("true_ball");
  else if (ev.key === "2") saveAnnotation("false_positive");
  else if (ev.key === "3") saveAnnotation("no_ball");
  else if (ev.key.toLowerCase() === "e") editBtn.click();
});

// ------------------------------------------------------------------
// Init
// ------------------------------------------------------------------
(async function init() {
  await loadVideos();
  await loadFrames();
  await refreshTraining();
  setInterval(refreshTraining, 15000);
})();

// ==================================================================
// Training panel
// ==================================================================
const trainBtn = $("#trainBtn");
const readinessEl = $("#readiness");
const trainStatusEl = $("#trainStatus");
const modelRegistryEl = $("#modelRegistry");
let activeRunId = null;
let pollHandle = null;

async function refreshTraining() {
  try {
    const videoId = videoSelect.value;
    const params = new URLSearchParams();
    if (videoId) params.set("videoIds", videoId);
    const r = await fetchJSON(`/api/train/readiness?${params}`);
    if (r.ready) {
      readinessEl.className = "readiness ok";
      readinessEl.textContent =
        `✓ Prêt : ${r.trueBall} vrais ballons, ${r.falsePositive} faux positifs, ${r.noBall} vides`;
      trainBtn.disabled = false;
    } else {
      readinessEl.className = "readiness nok";
      readinessEl.textContent =
        `✗ Pas encore prêt : pending=${r.pending}, true_ball=${r.trueBall}/${r.minRequired}. ${r.reason || ""}`;
      trainBtn.disabled = activeRunId !== null;
    }
  } catch (e) {
    readinessEl.textContent = "Erreur de vérification : " + e.message;
  }
  await refreshModelRegistry();
}

async function refreshModelRegistry() {
  try {
    const r = await fetchJSON("/api/model/versions");
    const active = r.active;
    const lines = [];
    if (active) {
      lines.push(`<div class="active">● Actif : ${active.runId}</div>`);
      lines.push(`<div>uri : ${active.modelUri || "?"}</div>`);
      if (active.metrics) {
        lines.push(`<div>mAP50 : ${(active.metrics.mAP50 || 0).toFixed(3)}, recall : ${(active.metrics.recall || 0).toFixed(3)}</div>`);
      }
      lines.push("<br/>");
    }
    lines.push("<div><b>Historique :</b></div>");
    for (const run of r.runs) {
      const state = run.state || "?";
      const isActive = active && active.runId === run.runId;
      lines.push(
        `<div${isActive ? ' class="active"' : ""}>` +
        `${run.runId} — ${state}` +
        (run.metrics && run.metrics.mAP50 ? ` (mAP50=${run.metrics.mAP50.toFixed(3)})` : "") +
        (!isActive && run.modelUri ? ` <a href="#" onclick="activateRun('${run.runId}');return false;">activer</a>` : "") +
        `</div>`
      );
    }
    modelRegistryEl.innerHTML = lines.join("");
  } catch (e) {
    modelRegistryEl.textContent = "Erreur registry : " + e.message;
  }
}

async function startTraining() {
  const body = {
    baseModel: $("#optBase").value,
    epochs: parseInt($("#optEpochs").value, 10),
    imgsz: parseInt($("#optImgsz").value, 10),
    batch: parseInt($("#optBatch").value, 10),
    videoIds: videoSelect.value || "",
  };
  if (!confirm(`Lancer l'entraînement ?\n\nBase : ${body.baseModel}\nEpochs : ${body.epochs}\nimgsz : ${body.imgsz}`)) return;

  trainBtn.disabled = true;
  trainStatusEl.textContent = "Soumission du job Vertex AI…";
  try {
    const r = await fetchJSON("/api/train", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    activeRunId = r.runId;
    trainStatusEl.textContent = `runId=${r.runId}\nvertex=${r.vertexJobResource || "?"}\n…en cours…`;
    pollTraining();
  } catch (e) {
    trainStatusEl.textContent = "Échec : " + e.message;
    trainBtn.disabled = false;
  }
}

async function pollTraining() {
  if (!activeRunId) return;
  if (pollHandle) clearTimeout(pollHandle);
  try {
    const r = await fetchJSON(`/api/train/status?runId=${encodeURIComponent(activeRunId)}`);
    const run = r.run || {};
    const state = run.state;
    const extra = [];
    if (run.nTrain) extra.push(`train=${run.nTrain}/val=${run.nVal}`);
    if (run.metrics && run.metrics.mAP50) extra.push(`mAP50=${run.metrics.mAP50.toFixed(3)}`);
    if (run.modelUri) extra.push(run.modelUri);
    if (run.error) extra.push("ERROR: " + run.error);
    trainStatusEl.textContent =
      `runId=${activeRunId}\nstate=${state}\n${extra.join("\n")}`;

    if (state === "succeeded" || state === "failed") {
      await refreshModelRegistry();
      if (state === "succeeded") {
        alert("✓ Nouveau modèle publié et activé !");
      }
      activeRunId = null;
      trainBtn.disabled = false;
      return;
    }
  } catch (e) {
    console.error("poll", e);
  }
  pollHandle = setTimeout(pollTraining, 10000);
}

window.activateRun = async function (runId) {
  if (!confirm(`Activer le modèle ${runId} ?`)) return;
  try {
    await fetchJSON("/api/model/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    await refreshModelRegistry();
  } catch (e) {
    alert("Échec : " + e.message);
  }
};

trainBtn.addEventListener("click", startTraining);
