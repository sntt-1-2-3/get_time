const DB_NAME = "shiguang-complete";
const DB_STORE = "memory";
const DB_KEY = "app-state";
const FALLBACK_KEY = "shiguang.complete.v2";
const LEGACY = { notes: "shiguang.notes.v1", yearbook: "shiguang.yearbook.v1" };

const now = new Date();
const currentYear = now.getFullYear();
const moods = {
  "晴": { icon: "☀", label: "晴朗" }, "暖": { icon: "◡", label: "温暖" }, "静": { icon: "☁", label: "安静" },
  "雨": { icon: "☂", label: "低落" }, "累": { icon: "◒", label: "疲惫" },
};

const defaultNotes = [
  { id: "morning-light", title: "阳台上的第一束光", body: "早起浇花，发现薄荷又冒出了两片新叶。风很轻，咖啡刚好，一天就这样慢慢开始。", tag: "片刻", mood: "晴", pinned: true, photo: "", createdAt: new Date(currentYear, now.getMonth(), Math.max(1, now.getDate() - 1), 8, 12).toISOString(), updatedAt: new Date().toISOString() },
  { id: "weekend-list", title: "周末想做的小事", body: "去旧书店走一圈\n给爸妈打个电话\n把搁置很久的相册整理好", tag: "生活", mood: "暖", pinned: false, photo: "", createdAt: new Date(currentYear, now.getMonth(), Math.max(1, now.getDate() - 3), 18, 40).toISOString(), updatedAt: new Date().toISOString() },
  { id: "tiny-idea", title: "一个关于时间的念头", body: "也许记录不是为了记住全部，而是让某些普通的瞬间，在后来仍然有名字。", tag: "灵感", mood: "静", pinned: false, photo: "", createdAt: new Date(currentYear, now.getMonth(), Math.max(1, now.getDate() - 6), 21, 16).toISOString(), updatedAt: new Date().toISOString() },
];

const defaultMarkdown = `# ${currentYear}，缓慢而明亮的一年

> 日子不是一条直线，它更像一间慢慢被填满的屋子。

## 这一年，我记得

- 春天学会了一道拿手菜
- 夏夜和朋友走了很远的路
- 开始认真听身体和内心的声音

## 那些微小的改变

我不再急着给每件事一个答案。允许计划之外的停顿，也允许自己偶尔只是晒晒太阳、看看云。

## 想谢谢的人

谢谢那些在普通日子里，仍然愿意分享一顿饭、一段路和一句“最近好吗”的人。

---

明年，愿我继续好奇，继续真诚，也继续把日子过成自己喜欢的样子。
`;

let state = {
  version: 4,
  notes: [],
  goals: [],
  trash: [],
  yearbook: defaultMarkdown,
  theme: "light",
};
let calendarCursor = new Date(currentYear, now.getMonth(), 1);
let reviewCursor = new Date(currentYear, now.getMonth(), 1);
let selectedDate = dateKey(now);
let activeFilter = "all";
let searchQuery = "";
let pendingPhoto = "";
let installPrompt = null;
let dbPromise = null;
let saveTimer = null;
let reminderTimer = null;
let activeReminderId = "";
let goalFilter = "all";
let goalSearchQuery = "";
let pendingGoalSteps = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const els = {
  notesGrid: $("#notesGrid"), notesEmpty: $("#notesEmpty"), noteCount: $("#noteCount"), trashCount: $("#trashCount"), search: $("#searchInput"),
  noteModal: $("#noteModal"), form: $("#noteForm"), noteId: $("#noteId"), noteTitle: $("#noteTitle"), noteBody: $("#noteBody"), noteDate: $("#noteDate"), noteDateHint: $("#noteDateHint"), notePinned: $("#notePinned"), reminderEnabled: $("#reminderEnabled"), reminderAt: $("#reminderAt"), reminderTimeWrap: $("#reminderTimeWrap"), reminderHint: $("#reminderHint"),
  deleteNote: $("#deleteNote"), collectNote: $("#collectNote"), dialogTitle: $("#dialogTitle"), dialogEyebrow: $("#dialogEyebrow"), photoInput: $("#notePhoto"), photoPreview: $("#photoPreview"), photoPicker: $("#photoPicker"), removePhoto: $("#removePhoto"),
  calendarLabel: $("#calendarMonthLabel"), calendarGrid: $("#calendarGrid"), selectedDateLabel: $("#selectedDateLabel"), timeline: $("#timeline"), calendarNoteHint: $("#calendarNoteHint"), addCalendarNote: $("#addCalendarNote"),
  reviewLabel: $("#reviewMonthLabel"), reviewMonthNumber: $("#reviewMonthNumber"), reviewStats: $("#reviewStats"), moodChart: $("#moodChart"), tagChart: $("#tagChart"), reviewHighlights: $("#reviewHighlights"),
  editor: $("#markdownEditor"), preview: $("#markdownPreview"), wordCount: $("#wordCount"),
  goalsGrid: $("#goalsGrid"), goalsEmpty: $("#goalsEmpty"), goalsSummary: $("#goalsSummary"), goalCount: $("#goalCount"), goalModal: $("#goalModal"), goalForm: $("#goalForm"), goalId: $("#goalId"), goalTitle: $("#goalTitle"), goalBody: $("#goalBody"), goalTargetDate: $("#goalTargetDate"), goalStepsEditor: $("#goalStepsEditor"), deleteGoal: $("#deleteGoal"),
  trashList: $("#trashList"), trashEmpty: $("#trashEmpty"), dataModal: $("#dataModal"), reminderModal: $("#reminderModal"), reminderEyebrow: $("#reminderEyebrow"), reminderDialogTitle: $("#reminderDialogTitle"), reminderDialogTime: $("#reminderDialogTime"), reminderDialogBody: $("#reminderDialogBody"), toast: $("#toast"), saveState: $("#saveState"), installHint: $("#installHint"), installApp: $("#installApp"),
};

function openDb() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB unavailable"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function loadFromStorage() {
  try {
    const db = await openDb();
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction(DB_STORE).objectStore(DB_STORE).get(DB_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (value) return value;
  } catch { /* localStorage fallback below */ }
  try {
    const fallback = JSON.parse(localStorage.getItem(FALLBACK_KEY));
    if (fallback) return fallback;
  } catch { /* start from legacy/default */ }
  try {
    const legacyNotes = JSON.parse(localStorage.getItem(LEGACY.notes));
    const legacyYearbook = localStorage.getItem(LEGACY.yearbook);
    if (Array.isArray(legacyNotes) || legacyYearbook) {
      return { version: 2, notes: Array.isArray(legacyNotes) ? legacyNotes : defaultNotes, trash: [], yearbook: legacyYearbook || defaultMarkdown, theme: "light" };
    }
  } catch { /* start from defaults */ }
  return { version: 2, notes: defaultNotes, trash: [], yearbook: defaultMarkdown, theme: "light" };
}

async function writeToStorage() {
  const snapshot = typeof structuredClone === "function" ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const request = db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).put(snapshot, DB_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(snapshot)); }
    catch { showToast("保存空间不足，请先导出备份并移除部分照片"); throw new Error("Storage full"); }
  }
}

function scheduleSave() {
  els.saveState?.classList.add("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await writeToStorage(); els.saveState?.classList.remove("saving"); }
    catch { els.saveState?.classList.add("error"); }
  }, 120);
}

function normalizeState(raw) {
  const cleanNotes = (Array.isArray(raw?.notes) ? raw.notes : defaultNotes).map((note) => ({
    id: String(note.id || uid()), title: String(note.title || "无题"), body: String(note.body || ""), tag: ["生活", "灵感", "片刻"].includes(note.tag) ? note.tag : "生活",
    mood: moods[note.mood] ? note.mood : "晴", pinned: Boolean(note.pinned), photo: typeof note.photo === "string" ? note.photo : "", noteDate: noteDateKey(note), reminderAt: typeof note.reminderAt === "string" && note.reminderAt ? note.reminderAt : "", createdAt: note.createdAt || new Date().toISOString(), updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
  }));
  const cleanGoals = (Array.isArray(raw?.goals) ? raw.goals : []).filter((goal) => goal && typeof goal === "object").map((goal) => ({
    id: String(goal.id || uid()), title: String(goal.title || "一个小愿望").slice(0, 60), body: String(goal.body || "").slice(0, 1500), targetDate: validGoalDate(goal.targetDate),
    milestones: (Array.isArray(goal.milestones) ? goal.milestones : []).filter((step) => step && String(step.text || "").trim()).slice(0, 30).map((step) => ({ id: String(step.id || uid()), text: String(step.text).slice(0, 120), done: step.done === true })),
    status: goal.status === "completed" ? "completed" : "active", completedAt: goal.completedAt || "", createdAt: goal.createdAt || new Date().toISOString(), updatedAt: goal.updatedAt || goal.createdAt || new Date().toISOString(),
  }));
  return { version: 4, notes: cleanNotes, goals: cleanGoals, trash: Array.isArray(raw?.trash) ? raw.trash.map((note) => ({ ...note, noteDate: noteDateKey(note) })) : [], yearbook: typeof raw?.yearbook === "string" ? raw.yearbook : defaultMarkdown, theme: ["light", "dark", "system"].includes(raw?.theme) ? raw.theme : "light" };
}

function validGoalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && dateKey(date) === value ? value : "";
}

function noteDateKey(note) {
  const chosen = validGoalDate(note?.noteDate);
  if (chosen) return chosen;
  const created = note?.createdAt ? new Date(note.createdAt) : new Date();
  return dateKey(Number.isFinite(created.getTime()) ? created : new Date());
}
function noteDay(note) { return `${noteDateKey(note)}T12:00:00`; }
function calendarDraftDate() {
  if (selectedDate) return selectedDate;
  return monthKey(calendarCursor) === monthKey(new Date()) ? dateKey(new Date()) : dateKey(calendarCursor);
}
function defaultReminderForDate(day) {
  return day > dateKey(new Date()) ? `${day}T09:00` : toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000));
}

function uid() { return crypto.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function dateKey(input) { const d = new Date(input); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function monthKey(input) { const d = new Date(input); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthName(input) { return new Date(input).toLocaleDateString("zh-CN", { year: "numeric", month: "long" }); }
function fullDate(input) { return new Date(input).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }); }
function shortDate(input) { return new Date(input).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }); }
function shortTime(input) { return new Date(input).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }); }
function reminderText(input) { return new Date(input).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }); }
function toDateTimeLocal(input) { const d = new Date(input); const offset = d.getTimezoneOffset() * 60000; return new Date(d.getTime() - offset).toISOString().slice(0, 16); }
function notesForMonth(cursor) { const key = monthKey(cursor); return state.notes.filter((note) => noteDateKey(note).slice(0, 7) === key); }
function downloadFile(content, filename, type) { const blob = new Blob([content], { type }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }

function showToast(message) {
  els.toast.textContent = message; els.toast.classList.add("show"); clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function renderNotes() {
  const query = searchQuery.trim().toLowerCase();
  const visible = state.notes.filter((note) => {
    const matchesFilter = activeFilter === "all" || (activeFilter === "pinned" ? note.pinned : note.tag === activeFilter);
    return matchesFilter && (!query || `${note.title} ${note.body} ${note.tag} ${note.mood}`.toLowerCase().includes(query));
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || noteDateKey(b).localeCompare(noteDateKey(a)) || new Date(b.createdAt) - new Date(a.createdAt));
  els.notesGrid.innerHTML = visible.map((note) => `
    <article class="note-card ${note.photo ? "has-photo" : ""}" data-id="${escapeHtml(note.id)}">
      ${note.photo ? `<img class="note-photo" src="${note.photo}" alt="${escapeHtml(note.title)}的照片" />` : ""}
      ${note.pinned ? '<span class="pin-ribbon" aria-label="已置顶"></span>' : ""}
      <span class="mood-stamp" title="心情：${moods[note.mood].label}">${moods[note.mood].icon}</span>
      <div class="note-top"><span class="note-tag">${escapeHtml(note.tag)}</span><time class="note-time" datetime="${noteDateKey(note)}">${noteDateKey(note) > dateKey(new Date()) ? "计划 · " : ""}${shortDate(noteDay(note))}</time></div>
      <h2>${escapeHtml(note.title)}</h2><p>${escapeHtml(note.body)}</p>
      ${note.reminderAt ? `<span class="reminder-badge ${new Date(note.reminderAt) <= new Date() ? "overdue" : ""}"><svg viewBox="0 0 24 24"><path d="M7 16h10l-1.2-2v-4a3.8 3.8 0 0 0-7.6 0v4L7 16ZM10 19h4"/></svg>${new Date(note.reminderAt) <= new Date() ? "待确认 · " : "提醒 · "}${reminderText(note.reminderAt)}</span>` : ""}
      <div class="note-card-actions">
        <button class="card-action ${note.pinned ? "active" : ""}" type="button" data-action="pin" title="${note.pinned ? "取消置顶" : "置顶"}" aria-label="${note.pinned ? "取消置顶" : "置顶"}"><svg viewBox="0 0 24 24"><path d="m9 4 6 0-.8 6 2.8 3H7l2.8-3L9 4ZM12 13v7"/></svg></button>
        <button class="card-action" type="button" data-action="collect" title="收录到年终手记" aria-label="收录到年终手记"><svg viewBox="0 0 24 24"><path d="M5 5h10v14H5zM15 9h4v10H9M8 9h4M8 12h4"/></svg></button>
        <button class="card-action" type="button" data-action="edit" title="编辑便签" aria-label="编辑便签"><svg viewBox="0 0 24 24"><path d="m5 16-.7 3.7L8 19l10-10-3-3L5 16ZM13.5 7.5l3 3"/></svg></button>
      </div>
    </article>`).join("");
  els.notesEmpty.hidden = visible.length > 0;
  els.noteCount.textContent = state.notes.length;
  els.trashCount.textContent = state.trash.length;
}

function openNote(id = "", targetDate = "") {
  const note = state.notes.find((item) => item.id === id);
  els.form.reset(); els.noteId.value = note?.id || ""; els.noteTitle.value = note?.title || ""; els.noteBody.value = note?.body || ""; els.notePinned.checked = Boolean(note?.pinned);
  els.noteDate.value = note ? noteDateKey(note) : validGoalDate(targetDate) || dateKey(new Date()); els.noteDate.setCustomValidity(""); els.reminderAt.setCustomValidity("");
  const tagRadio = els.form.querySelector(`input[name="noteTag"][value="${note?.tag || "生活"}"]`); if (tagRadio) tagRadio.checked = true;
  const moodRadio = els.form.querySelector(`input[name="noteMood"][value="${note?.mood || "晴"}"]`); if (moodRadio) moodRadio.checked = true;
  pendingPhoto = note?.photo || ""; renderPhotoPreview(); els.reminderEnabled.checked = Boolean(note?.reminderAt); els.reminderAt.value = note?.reminderAt ? toDateTimeLocal(note.reminderAt) : defaultReminderForDate(els.noteDate.value); renderReminderField(); updateNoteDateField();
  els.dialogEyebrow.textContent = note ? "EDIT NOTE" : "NEW NOTE"; els.dialogTitle.textContent = note ? "再读一遍，也可以改改" : "留下一点什么";
  els.deleteNote.hidden = !note; els.collectNote.hidden = !note; openModal(els.noteModal); setTimeout(() => els.noteTitle.focus(), 50);
}

function updateNoteDateField() {
  els.noteDate.setCustomValidity("");
  const day = validGoalDate(els.noteDate.value);
  els.noteDateHint.textContent = day && day > dateKey(new Date())
    ? "会显示在这个未来日期。需要到时提醒，请打开下面的“提醒便签”。"
    : "便签会显示在所选日期；可以提前安排，也可以补记过去。";
  if (day && !els.reminderEnabled.checked) els.reminderAt.value = defaultReminderForDate(day);
}

function openNewNote() {
  openNote("", $("#calendarView").classList.contains("active") ? calendarDraftDate() : dateKey(new Date()));
}

function renderPhotoPreview() {
  els.photoPreview.hidden = !pendingPhoto; els.removePhoto.hidden = !pendingPhoto; els.photoPicker.querySelector("span").hidden = Boolean(pendingPhoto);
  if (pendingPhoto) els.photoPreview.src = pendingPhoto; else els.photoPreview.removeAttribute("src");
}

function renderReminderField() {
  els.reminderTimeWrap.hidden = !els.reminderEnabled.checked;
  els.reminderAt.required = els.reminderEnabled.checked;
  els.reminderAt.min = toDateTimeLocal(new Date());
  els.reminderHint.textContent = window.chrome?.webview
    ? "Windows 会记住这个时间；即使关机，开机登录后也会补提醒。"
    : "iPhone 和网页端需保持拾光打开才能准时提醒；错过后会在下次打开时补上。";
}

function postNativeReminder(message) {
  try { window.chrome?.webview?.postMessage(message); } catch { /* portable mode */ }
}

function scheduleNativeReminder(note) {
  if (!note?.reminderAt) return;
  postNativeReminder({ type: "scheduleReminder", id: note.id, title: note.title, body: note.body, at: note.reminderAt });
}

function cancelNativeReminder(id) {
  if (id) postNativeReminder({ type: "cancelReminder", id });
}

function resetNativeReminders() {
  postNativeReminder({ type: "resetReminders" });
  state.notes.filter((note) => note.reminderAt && new Date(note.reminderAt) > new Date()).forEach(scheduleNativeReminder);
}

function showReminder(note, missed = false) {
  if (!note || !els.reminderModal.hidden) return;
  activeReminderId = note.id;
  els.reminderEyebrow.textContent = missed ? "MISSED REMINDER" : "IT'S TIME";
  els.reminderDialogTitle.textContent = note.title;
  els.reminderDialogTime.textContent = `${missed ? "错过的提醒" : "提醒时间"} · ${reminderText(note.reminderAt)}`;
  els.reminderDialogBody.textContent = note.body;
  openModal(els.reminderModal);
  postNativeReminder({ type: "reminderDue", id: note.id, title: note.title, body: note.body });
  if (!window.chrome?.webview && "Notification" in window && Notification.permission === "granted") {
    try { new Notification(`拾光提醒 · ${note.title}`, { body: note.body, icon: "./icon.svg" }); } catch { /* visual dialog still works */ }
  }
}

function checkReminders(requestedId = "") {
  if (!els.reminderModal.hidden) return;
  const due = state.notes.filter((note) => note.reminderAt && new Date(note.reminderAt) <= new Date()).sort((a, b) => new Date(a.reminderAt) - new Date(b.reminderAt));
  const requested = requestedId ? state.notes.find((note) => note.id === requestedId && note.reminderAt) : null;
  const note = requested || due[0];
  if (note) showReminder(note, new Date(note.reminderAt).getTime() < Date.now() - 60_000);
}

function completeActiveReminder() {
  if (!activeReminderId) return;
  const id = activeReminderId; activeReminderId = "";
  state.notes = state.notes.filter((note) => note.id !== id);
  cancelNativeReminder(id); closeModal(els.reminderModal); scheduleSave(); renderAll(); showToast("提醒已确认，便签已经自动删除");
  setTimeout(() => checkReminders(), 250);
}

function snoozeActiveReminder() {
  const note = state.notes.find((item) => item.id === activeReminderId); if (!note) return;
  note.reminderAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); note.updatedAt = new Date().toISOString(); activeReminderId = "";
  scheduleNativeReminder(note); closeModal(els.reminderModal); scheduleSave(); renderAll(); showToast("会在 10 分钟后再次提醒");
}

function openModal(modal) { modal.hidden = false; document.body.style.overflow = "hidden"; }
function closeModal(modal) { modal.hidden = true; if ($$(".modal-backdrop").every((item) => item.hidden)) document.body.style.overflow = ""; }

async function resizeImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件");
  if (file.size > 5 * 1024 * 1024) throw new Error("照片不能超过 5 MB");
  const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
  const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = dataUrl; });
  const max = 1280; const scale = Math.min(1, max / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); return canvas.toDataURL("image/jpeg", .82);
}

function moveToTrash(id) {
  const note = state.notes.find((item) => item.id === id); if (!note) return;
  state.notes = state.notes.filter((item) => item.id !== id); state.trash.unshift({ ...note, deletedAt: new Date().toISOString() }); cancelNativeReminder(id); scheduleSave(); renderAll(); showToast("已移到回收站");
}

function collectToYearbook(id) {
  const note = state.notes.find((item) => item.id === id); if (!note) return;
  const block = `\n\n### ${shortDate(noteDay(note))} · ${note.title}\n\n> 心情：${moods[note.mood].label}｜${note.tag}\n\n${note.body}\n`;
  state.yearbook = `${state.yearbook.trimEnd()}${block}`; els.editor.value = state.yearbook; updateMarkdown(false); scheduleSave(); showToast("已经收录到年终手记");
}

function renderCalendar() {
  els.calendarLabel.textContent = monthName(calendarCursor);
  const year = calendarCursor.getFullYear(); const month = calendarCursor.getMonth(); const first = new Date(year, month, 1); const mondayOffset = (first.getDay() + 6) % 7; const start = new Date(year, month, 1 - mondayOffset);
  const counts = state.notes.reduce((map, note) => { const key = noteDateKey(note); map[key] = (map[key] || 0) + 1; return map; }, {});
  els.calendarGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start); day.setDate(start.getDate() + index); const key = dateKey(day); const count = counts[key] || 0; const outside = day.getMonth() !== month; const isToday = key === dateKey(new Date()); const isSelected = key === selectedDate;
    return `<button class="calendar-day ${outside ? "outside" : ""} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${key}" type="button" aria-pressed="${isSelected}" aria-label="${fullDate(day)}，${count} 条便签"><span class="day-number">${day.getDate()}</span>${count ? `<span class="day-marks">${Array.from({length: Math.min(3,count)}, () => "<i></i>").join("")}<small>${count}</small></span>` : ""}</button>`;
  }).join("");
  renderTimeline();
}

function renderTimeline() {
  let notes = notesForMonth(calendarCursor);
  if (selectedDate) notes = state.notes.filter((note) => noteDateKey(note) === selectedDate);
  notes.sort((a, b) => noteDateKey(a).localeCompare(noteDateKey(b)) || new Date(a.reminderAt || a.createdAt) - new Date(b.reminderAt || b.createdAt));
  els.selectedDateLabel.textContent = selectedDate ? fullDate(`${selectedDate}T12:00:00`) : `${calendarCursor.getMonth() + 1} 月的便签`;
  els.addCalendarNote.textContent = selectedDate ? "为这一天写便签" : "为这个月写便签";
  els.calendarNoteHint.textContent = selectedDate ? "给这一天留一句话，或开启提醒，记住待办的小事。" : "点选任意日期，就能提前安排或补记过去。";
  els.timeline.innerHTML = notes.length ? notes.map((note) => `<div class="timeline-item"><time>${selectedDate ? "" : `${shortDate(noteDay(note))} · `}${note.reminderAt ? `提醒 ${reminderText(note.reminderAt)}` : "便签"} · ${escapeHtml(note.tag)} · ${moods[note.mood].icon}</time><button type="button" data-id="${escapeHtml(note.id)}"><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.body)}</p></button></div>`).join("") : '<div class="timeline-empty">还没有便签。<br>提前写下想记住的事吧。</div>';
}

function renderReview() {
  const notes = notesForMonth(reviewCursor).sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt));
  const days = new Set(notes.map(noteDateKey)).size; const chars = notes.reduce((sum, note) => sum + note.title.length + note.body.length, 0);
  els.reviewLabel.textContent = monthName(reviewCursor); els.reviewMonthNumber.textContent = String(reviewCursor.getMonth() + 1).padStart(2, "0");
  els.reviewStats.innerHTML = `<div class="review-stat"><strong>${notes.length}</strong><span>段记录</span></div><div class="review-stat"><strong>${days}</strong><span>个有字的日子</span></div><div class="review-stat"><strong>${chars}</strong><span>个生活的字</span></div>`;
  const moodCounts = Object.keys(moods).reduce((map, mood) => ({ ...map, [mood]: notes.filter((note) => note.mood === mood).length }), {}); const moodMax = Math.max(1, ...Object.values(moodCounts));
  els.moodChart.innerHTML = Object.entries(moods).map(([key, info]) => `<div class="mood-column"><i style="height:${Math.max(4, moodCounts[key] / moodMax * 96)}px"></i><b title="${info.label}">${info.icon}</b><small>${moodCounts[key]}</small></div>`).join("");
  const tags = ["生活", "灵感", "片刻"].map((tag) => ({ tag, count: notes.filter((note) => note.tag === tag).length })); const tagMax = Math.max(1, ...tags.map((item) => item.count));
  els.tagChart.innerHTML = tags.map((item) => `<div class="tag-row"><span>${item.tag}</span><div class="tag-track"><div class="tag-fill" style="width:${item.count / tagMax * 100}%"></div></div><b>${item.count}</b></div>`).join("");
  els.reviewHighlights.innerHTML = notes.length ? notes.slice(0,3).map((note) => `<article class="highlight"><time>${shortDate(noteDay(note))} · ${moods[note.mood].icon}</time><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.body)}</p></article>`).join("") : '<div class="timeline-empty">这个月还没有记录。先去写下一张便签吧。</div>';
  $("#addReviewToYearbook").disabled = notes.length === 0;
}

function monthlyReviewMarkdown() {
  const notes = notesForMonth(reviewCursor).sort((a,b) => noteDateKey(a).localeCompare(noteDateKey(b)) || new Date(a.createdAt) - new Date(b.createdAt)); if (!notes.length) return "";
  const topMood = Object.keys(moods).sort((a,b) => notes.filter(n => n.mood === b).length - notes.filter(n => n.mood === a).length)[0];
  return `\n\n## ${monthName(reviewCursor)}回顾\n\n> 这个月写下 ${notes.length} 段记录，最常出现的心情是“${moods[topMood].label}”。\n\n${notes.slice(0,3).map((note) => `- **${note.title}**：${note.body.replace(/\n/g," ").slice(0,80)}`).join("\n")}\n`;
}

function addReviewToYearbook() {
  const block = monthlyReviewMarkdown(); if (!block) return;
  state.yearbook = `${state.yearbook.trimEnd()}${block}`; els.editor.value = state.yearbook; updateMarkdown(false); scheduleSave(); showToast("月度回顾已写入年终手记");
}

function markdownToHtml(markdown) {
  let html = escapeHtml(markdown).replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>").replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>").replace(/^---$/gm, "<hr>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/^[-*] (.*)$/gm, "<li>$1</li>");
  html = html.replace(/(?:<li>.*<\/li>\n?)+/g, (list) => `<ul>${list}</ul>`);
  return html.split(/\n{2,}/).map((block) => /^(<h\d|<blockquote|<hr|<ul)/.test(block) ? block : `<p>${block.replace(/\n/g, "<br>")}</p>`).join("");
}

function updateMarkdown(shouldSave = true) {
  state.yearbook = els.editor.value; els.preview.innerHTML = markdownToHtml(state.yearbook); els.wordCount.textContent = `${state.yearbook.replace(/[#>*_`\-\s]/g, "").length} 字`; if (shouldSave) scheduleSave();
}

function goalProgress(goal) {
  if (goal.status === "completed") return 100;
  return goal.milestones.length ? Math.round(goal.milestones.filter((step) => step.done).length / goal.milestones.length * 100) : 0;
}

function goalDeadline(goal) {
  if (goal.status === "completed") return { label: goal.completedAt ? `${shortDate(goal.completedAt)}完成` : "愿望已实现", overdue: false };
  if (!goal.targetDate) return { label: "按自己的节奏", overdue: false };
  const today = dateKey(new Date());
  const days = Math.round((Date.parse(`${goal.targetDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return { label: `${shortDate(`${goal.targetDate}T12:00:00`)} · ${days < 0 ? `已过计划 ${-days} 天` : days === 0 ? "计划今天完成" : `还有 ${days} 天`}`, overdue: days < 0 };
}

function renderGoals() {
  const active = state.goals.filter((goal) => goal.status !== "completed").length;
  const doneSteps = state.goals.reduce((sum, goal) => sum + goal.milestones.filter((step) => step.done).length, 0);
  els.goalCount.textContent = active;
  els.goalsSummary.innerHTML = `<div><strong>${active}</strong><span>正在靠近</span></div><div><strong>${state.goals.length - active}</strong><span>已经实现</span></div><div><strong>${doneSteps}</strong><span>走过的小步</span></div>`;
  const query = goalSearchQuery.trim().toLowerCase();
  const visible = state.goals.filter((goal) => (goalFilter === "all" || goal.status === goalFilter) && (!query || `${goal.title} ${goal.body} ${goal.milestones.map((step) => step.text).join(" ")}`.toLowerCase().includes(query))).sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || (a.targetDate || "9999").localeCompare(b.targetDate || "9999") || new Date(b.createdAt) - new Date(a.createdAt));
  els.goalsGrid.innerHTML = visible.map((goal) => {
    const progress = goalProgress(goal); const deadline = goalDeadline(goal); const done = goal.milestones.filter((step) => step.done).length; const completed = goal.status === "completed";
    return `<article class="goal-card ${completed ? "is-completed" : ""}" data-id="${escapeHtml(goal.id)}"><div class="goal-card-top"><span class="goal-status ${completed ? "completed" : ""}">${completed ? "✓ 已完成" : "● 进行中"}</span><button class="card-action" type="button" data-goal-action="edit" title="编辑目标" aria-label="编辑目标：${escapeHtml(goal.title)}"><svg viewBox="0 0 24 24"><path d="m5 16-.7 3.7L8 19l10-10-3-3L5 16ZM13.5 7.5l3 3"/></svg></button></div><h2>${escapeHtml(goal.title)}</h2>${goal.body ? `<p class="goal-description">${escapeHtml(goal.body)}</p>` : ""}<div class="goal-progress-label"><span>${goal.milestones.length ? `${done} / ${goal.milestones.length} 步` : completed ? "这一程，已经走到了" : "从第一小步开始"}</span><strong>${progress}%</strong></div><div class="goal-progress-track" role="progressbar" aria-label="${escapeHtml(goal.title)}的进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><i style="width:${progress}%"></i></div>${goal.milestones.length ? `<div class="goal-checklist">${goal.milestones.map((step) => `<label class="goal-check ${step.done ? "done" : ""}"><input type="checkbox" data-goal-step="${escapeHtml(step.id)}" ${step.done ? "checked" : ""}/><span>${escapeHtml(step.text)}</span></label>`).join("")}</div>` : '<p class="goal-no-steps">可以先留一个方向，再慢慢补上行动。</p>'}<div class="goal-card-footer"><time class="goal-deadline ${deadline.overdue ? "overdue" : ""}" ${goal.targetDate ? `datetime="${goal.targetDate}"` : ""}>${deadline.label}</time><div class="goal-card-actions"><button class="text-button" type="button" data-goal-action="collect">写入手记</button><button class="mini-button" type="button" data-goal-action="${completed ? "restart" : "complete"}">${completed ? "重新开始" : "完成目标"}</button></div></div></article>`;
  }).join("");
  els.goalsEmpty.hidden = visible.length > 0;
  const isNew = state.goals.length === 0;
  $("#goalsEmptyTitle").textContent = isNew ? "给一个愿望留个位置" : goalFilter === "completed" && !query ? "好事正在慢慢发生" : "这里暂时很安静";
  $("#goalsEmptyText").textContent = isNew ? "写下目标，再拆成几件可以慢慢完成的小事。" : goalFilter === "completed" && !query ? "完成的目标会留在这里，等你以后再回看。" : "换个关键词或筛选，或者写下一个新目标。";
}

function renderGoalStepsEditor(focusLast = false) {
  els.goalStepsEditor.innerHTML = pendingGoalSteps.map((step, index) => `<div class="goal-step-editor" data-step-id="${escapeHtml(step.id)}"><label class="goal-step-done"><input type="checkbox" ${step.done ? "checked" : ""} aria-label="第 ${index + 1} 步已完成" /></label><input class="goal-step-text" value="${escapeHtml(step.text)}" maxlength="120" placeholder="第 ${index + 1} 小步，比如：选好第一本书" aria-label="第 ${index + 1} 步内容" required /><button class="icon-button" type="button" data-remove-step aria-label="移除第 ${index + 1} 步"><svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/></svg></button></div>`).join("");
  $("#addGoalStep").disabled = pendingGoalSteps.length >= 30;
  $("#goalStepsHint").hidden = pendingGoalSteps.length > 0;
  if (focusLast) els.goalStepsEditor.lastElementChild?.querySelector(".goal-step-text").focus();
}

function openGoal(id = "") {
  const goal = state.goals.find((item) => item.id === id);
  els.goalForm.reset(); els.goalId.value = goal?.id || ""; els.goalTitle.value = goal?.title || ""; els.goalBody.value = goal?.body || ""; els.goalTargetDate.value = goal?.targetDate || "";
  pendingGoalSteps = goal ? goal.milestones.map((step) => ({ ...step })) : [];
  $("#goalDialogTitle").textContent = goal ? "调整一下，再向前走" : "给愿望一个方向";
  els.deleteGoal.hidden = !goal; renderGoalStepsEditor(); openModal(els.goalModal); setTimeout(() => els.goalTitle.focus(), 50);
}

function syncGoalCompletion(goal) {
  if (!goal.milestones.length) return;
  const completed = goal.milestones.every((step) => step.done);
  goal.status = completed ? "completed" : "active";
  goal.completedAt = completed ? goal.completedAt || new Date().toISOString() : "";
}

function collectGoalToYearbook(goal) {
  const block = `\n\n## 目标 · ${goal.title}\n\n${goal.body ? `${goal.body}\n\n` : ""}> ${goal.status === "completed" ? "已完成" : "进行中"} · 进度 ${goalProgress(goal)}%${goal.targetDate ? ` · 计划完成：${goal.targetDate}` : ""}\n\n${goal.milestones.map((step) => `- [${step.done ? "x" : " "}] ${step.text}`).join("\n")}\n`;
  state.yearbook = `${state.yearbook.trimEnd()}${block}`; els.editor.value = state.yearbook; updateMarkdown(false); scheduleSave(); showToast("这段努力已经写入年终手记");
}

function renderTrash() {
  els.trashList.innerHTML = state.trash.map((note) => `<article class="trash-item" data-id="${escapeHtml(note.id)}"><div><h3>${escapeHtml(note.title)}</h3><p>${shortDate(note.deletedAt)}删除 · ${escapeHtml(note.tag)} · ${moods[note.mood]?.icon || ""}</p></div><div class="trash-actions"><button type="button" class="mini-button" data-action="restore">恢复</button><button type="button" class="mini-button danger" data-action="purge">永久删除</button></div></article>`).join("");
  els.trashEmpty.hidden = state.trash.length > 0; els.trashCount.textContent = state.trash.length; $("#emptyTrash").disabled = state.trash.length === 0;
}

function renderAll() { renderNotes(); renderGoals(); renderCalendar(); renderReview(); renderTrash(); }

function switchView(name) {
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `${name}View`)); $$('[data-view]').forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  if (name === "goals") renderGoals(); if (name === "calendar") renderCalendar(); if (name === "review") renderReview(); if (name === "trash") renderTrash(); $("#mobileAdd").setAttribute("aria-label", name === "goals" ? "新建目标" : "新建便签"); window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyTheme(choice) {
  state.theme = choice; const effective = choice === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : choice;
  document.documentElement.dataset.theme = effective; $$('[data-theme-choice]').forEach((button) => button.classList.toggle("active", button.dataset.themeChoice === choice));
  $("meta[name=theme-color]").content = effective === "dark" ? "#1d201c" : "#f3eee5";
}

function backupAll() {
  const backup = { app: "拾光", format: "shiguang-backup", version: 4, exportedAt: new Date().toISOString(), data: state };
  downloadFile(JSON.stringify(backup, null, 2), `拾光-完整备份-${dateKey(now)}.json`, "application/json;charset=utf-8"); showToast("完整备份已经导出");
}

async function restoreBackup(file) {
  try {
    const parsed = JSON.parse(await file.text()); if (parsed?.format !== "shiguang-backup" || !parsed.data || !Array.isArray(parsed.data.notes)) throw new Error("not a backup");
    if (!confirm(`将用备份中的 ${parsed.data.notes.length} 张便签和 ${Array.isArray(parsed.data.goals) ? parsed.data.goals.length : 0} 个目标替换当前全部内容。继续吗？`)) return;
    state = normalizeState(parsed.data); await writeToStorage(); applyTheme(state.theme); els.editor.value = state.yearbook; updateMarkdown(false); renderAll(); resetNativeReminders(); closeModal(els.dataModal); showToast("记忆已经完整恢复");
  } catch { showToast("这个文件不是有效的拾光备份"); }
}

function shiftMonth(cursor, amount) { return new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1); }

function bindEvents() {
  $$('[data-view]').forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $("#addNote").addEventListener("click", openNewNote); $("#mobileAdd").addEventListener("click", () => $("#goalsView").classList.contains("active") ? openGoal() : openNewNote());
  els.addCalendarNote.addEventListener("click", () => openNote("", calendarDraftDate())); els.noteDate.addEventListener("input", updateNoteDateField); els.noteDate.addEventListener("change", updateNoteDateField);
  $("#closeModal").addEventListener("click", () => closeModal(els.noteModal)); $("#openDataPanel").addEventListener("click", () => openModal(els.dataModal)); $("#mobileData").addEventListener("click", () => openModal(els.dataModal)); $("#closeDataModal").addEventListener("click", () => closeModal(els.dataModal));
  [els.noteModal, els.dataModal, els.goalModal].forEach((modal) => modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(modal); }));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && els.reminderModal.hidden) { if (!els.goalModal.hidden) closeModal(els.goalModal); else if (!els.noteModal.hidden) closeModal(els.noteModal); else if (!els.dataModal.hidden) closeModal(els.dataModal); } });
  $("#addGoal").addEventListener("click", () => openGoal()); $("#closeGoalModal").addEventListener("click", () => closeModal(els.goalModal));
  $("#goalSearch").addEventListener("input", (event) => { goalSearchQuery = event.target.value; renderGoals(); });
  $$('[data-goal-filter]').forEach((button) => button.addEventListener("click", () => { goalFilter = button.dataset.goalFilter; $$('[data-goal-filter]').forEach((item) => { const active = item === button; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); }); renderGoals(); }));
  $("#addGoalStep").addEventListener("click", () => { if (pendingGoalSteps.length >= 30) return; pendingGoalSteps.push({ id: uid(), text: "", done: false }); renderGoalStepsEditor(true); });
  els.goalStepsEditor.addEventListener("input", (event) => { if (!event.target.matches(".goal-step-text")) return; const step = pendingGoalSteps.find((item) => item.id === event.target.closest("[data-step-id]").dataset.stepId); if (step) step.text = event.target.value; });
  els.goalStepsEditor.addEventListener("change", (event) => { if (event.target.type !== "checkbox") return; const step = pendingGoalSteps.find((item) => item.id === event.target.closest("[data-step-id]").dataset.stepId); if (step) step.done = event.target.checked; });
  els.goalStepsEditor.addEventListener("click", (event) => { const button = event.target.closest("[data-remove-step]"); if (!button) return; pendingGoalSteps = pendingGoalSteps.filter((step) => step.id !== button.closest("[data-step-id]").dataset.stepId); renderGoalStepsEditor(); });
  els.goalForm.addEventListener("submit", (event) => {
    event.preventDefault(); const old = state.goals.find((item) => item.id === els.goalId.value); const title = els.goalTitle.value.trim(); const targetDate = validGoalDate(els.goalTargetDate.value);
    if (!title || pendingGoalSteps.some((step) => !step.text.trim()) || (els.goalTargetDate.value && !targetDate)) return;
    const goal = { id: old?.id || uid(), title, body: els.goalBody.value.trim(), targetDate, milestones: pendingGoalSteps.map((step) => ({ ...step, text: step.text.trim() })), status: old?.status || "active", completedAt: old?.completedAt || "", createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    syncGoalCompletion(goal); state.goals = old ? state.goals.map((item) => item.id === goal.id ? goal : item) : [goal, ...state.goals];
    goalFilter = "all"; goalSearchQuery = ""; $("#goalSearch").value = ""; $$('[data-goal-filter]').forEach((button) => { const active = button.dataset.goalFilter === "all"; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
    scheduleSave(); renderGoals(); closeModal(els.goalModal); showToast(old ? "目标已调整，继续按自己的节奏" : "愿望收好了，慢慢向它靠近");
  });
  els.goalsGrid.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-goal-step]"); if (!checkbox) return; const goal = state.goals.find((item) => item.id === checkbox.closest(".goal-card").dataset.id); const step = goal?.milestones.find((item) => item.id === checkbox.dataset.goalStep); if (!step) return;
    const wasCompleted = goal.status === "completed"; step.done = checkbox.checked; goal.updatedAt = new Date().toISOString(); syncGoalCompletion(goal); scheduleSave(); renderGoals(); if (!wasCompleted && goal.status === "completed") showToast("这个目标完成了，记得为自己高兴一下");
  });
  els.goalsGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-goal-action]"); if (!button) return; const goal = state.goals.find((item) => item.id === button.closest(".goal-card").dataset.id); if (!goal) return;
    const action = button.dataset.goalAction;
    if (action === "edit") { openGoal(goal.id); return; }
    if (action === "collect") { collectGoalToYearbook(goal); return; }
    if (action === "complete") { if (goal.milestones.some((step) => !step.done) && !confirm("还有未完成的小步。确定将它们一起标记完成吗？")) return; goal.milestones.forEach((step) => { step.done = true; }); goal.status = "completed"; goal.completedAt = new Date().toISOString(); }
    if (action === "restart") { if (!confirm("重新开始会清空这个目标的小步勾选，确定继续吗？")) return; goal.milestones.forEach((step) => { step.done = false; }); goal.status = "active"; goal.completedAt = ""; }
    goal.updatedAt = new Date().toISOString(); scheduleSave(); renderGoals(); showToast(action === "complete" ? "又实现了一个愿望，真好" : "新一程，慢慢走");
  });
  els.deleteGoal.addEventListener("click", () => { const id = els.goalId.value; if (!id || !confirm("确定删除这个目标和全部小步吗？删除后不能恢复。")) return; state.goals = state.goals.filter((goal) => goal.id !== id); scheduleSave(); renderGoals(); closeModal(els.goalModal); showToast("目标已删除，给新的方向留点空间"); });
  $$('[data-filter]').forEach((button) => button.addEventListener("click", () => { activeFilter = button.dataset.filter; $$('[data-filter]').forEach((item) => item.classList.toggle("active", item === button)); renderNotes(); }));
  els.search.addEventListener("input", (event) => { searchQuery = event.target.value; renderNotes(); });
  els.notesGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".note-card"); if (!card) return; const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "pin") { const note = state.notes.find((item) => item.id === card.dataset.id); note.pinned = !note.pinned; note.updatedAt = new Date().toISOString(); scheduleSave(); renderNotes(); showToast(note.pinned ? "已放在最前面" : "已取消置顶"); }
    else if (action === "collect") collectToYearbook(card.dataset.id); else openNote(card.dataset.id);
  });
  els.form.addEventListener("submit", (event) => {
    event.preventDefault(); const id = els.noteId.value; const old = state.notes.find((item) => item.id === id); const noteDate = validGoalDate(els.noteDate.value); const reminderAt = els.reminderEnabled.checked ? new Date(els.reminderAt.value) : null;
    if (!noteDate) { els.noteDate.setCustomValidity("请选择有效的便签日期"); els.noteDate.reportValidity(); return; }
    els.noteDate.setCustomValidity("");
    if (reminderAt && (!Number.isFinite(reminderAt.getTime()) || reminderAt <= new Date())) { els.reminderAt.setCustomValidity("请选择未来的提醒时间"); els.reminderAt.reportValidity(); return; }
    els.reminderAt.setCustomValidity(""); const note = { id: id || uid(), title: els.noteTitle.value.trim(), body: els.noteBody.value.trim(), noteDate, tag: new FormData(els.form).get("noteTag"), mood: new FormData(els.form).get("noteMood"), pinned: els.notePinned.checked, photo: pendingPhoto, reminderAt: reminderAt ? reminderAt.toISOString() : "", createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (!note.title || !note.body) return; state.notes = id ? state.notes.map((item) => item.id === id ? note : item) : [note, ...state.notes];
    if ($("#calendarView").classList.contains("active")) { selectedDate = noteDate; calendarCursor = new Date(`${noteDate}T12:00:00`); calendarCursor.setDate(1); }
    if (old?.reminderAt && !note.reminderAt) cancelNativeReminder(note.id); if (note.reminderAt) scheduleNativeReminder(note); scheduleSave(); renderAll(); closeModal(els.noteModal); showToast(note.reminderAt ? "便签已收好，提醒时间也记住了" : `便签已收在 ${shortDate(noteDay(note))}`);
  });
  els.deleteNote.addEventListener("click", () => { const id = els.noteId.value; if (id) { moveToTrash(id); closeModal(els.noteModal); } });
  els.collectNote.addEventListener("click", () => collectToYearbook(els.noteId.value));
  els.photoInput.addEventListener("change", async () => { const file = els.photoInput.files[0]; if (!file) return; try { pendingPhoto = await resizeImage(file); renderPhotoPreview(); } catch (error) { showToast(error.message || "照片读取失败"); } finally { els.photoInput.value = ""; } });
  els.removePhoto.addEventListener("click", () => { pendingPhoto = ""; renderPhotoPreview(); });
  els.reminderEnabled.addEventListener("change", () => { renderReminderField(); if (els.reminderEnabled.checked) els.reminderAt.focus(); }); els.reminderAt.addEventListener("input", () => els.reminderAt.setCustomValidity(""));
  $("#completeReminder").addEventListener("click", completeActiveReminder); $("#snoozeReminder").addEventListener("click", snoozeActiveReminder);
  $("#calendarPrev").addEventListener("click", () => { calendarCursor = shiftMonth(calendarCursor, -1); selectedDate = null; renderCalendar(); }); $("#calendarNext").addEventListener("click", () => { calendarCursor = shiftMonth(calendarCursor, 1); selectedDate = null; renderCalendar(); });
  $("#calendarToday").addEventListener("click", () => { const today = new Date(); selectedDate = dateKey(today); calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1); renderCalendar(); });
  els.calendarGrid.addEventListener("click", (event) => { const day = event.target.closest("[data-date]"); if (!day) return; selectedDate = day.dataset.date; const d = new Date(`${day.dataset.date}T12:00:00`); calendarCursor = new Date(d.getFullYear(), d.getMonth(), 1); renderCalendar(); });
  els.timeline.addEventListener("click", (event) => { const button = event.target.closest("[data-id]"); if (button) openNote(button.dataset.id); });
  $("#reviewPrev").addEventListener("click", () => { reviewCursor = shiftMonth(reviewCursor, -1); renderReview(); }); $("#reviewNext").addEventListener("click", () => { reviewCursor = shiftMonth(reviewCursor, 1); renderReview(); }); $("#addReviewToYearbook").addEventListener("click", addReviewToYearbook);
  els.editor.addEventListener("input", () => updateMarkdown(true)); $$('[data-mode]').forEach((button) => button.addEventListener("click", () => { const isPreview = button.dataset.mode === "preview"; $$('[data-mode]').forEach((item) => item.classList.toggle("active", item === button)); els.editor.hidden = isPreview; els.preview.hidden = !isPreview; if (isPreview) els.preview.innerHTML = markdownToHtml(state.yearbook); }));
  $("#exportMd").addEventListener("click", () => { downloadFile(state.yearbook, `${currentYear}-年终手记.md`, "text/markdown;charset=utf-8"); showToast("Markdown 文档已导出"); });
  els.trashList.addEventListener("click", (event) => { const item = event.target.closest(".trash-item"); const action = event.target.closest("[data-action]")?.dataset.action; if (!item || !action) return; const note = state.trash.find((entry) => entry.id === item.dataset.id); if (action === "restore") { state.trash = state.trash.filter((entry) => entry.id !== note.id); const { deletedAt, ...restored } = note; state.notes.unshift(restored); if (restored.reminderAt && new Date(restored.reminderAt) > new Date()) scheduleNativeReminder(restored); scheduleSave(); renderAll(); showToast("便签已经回到原处"); } else if (action === "purge" && confirm("永久删除后无法恢复。确定删除这张便签吗？")) { state.trash = state.trash.filter((entry) => entry.id !== note.id); cancelNativeReminder(note.id); scheduleSave(); renderTrash(); showToast("已永久删除"); } });
  $("#emptyTrash").addEventListener("click", () => { if (state.trash.length && confirm(`永久删除回收站中的 ${state.trash.length} 张便签吗？`)) { state.trash = []; scheduleSave(); renderTrash(); showToast("回收站已清空"); } });
  $("#backupAll").addEventListener("click", backupAll); $("#restoreInput").addEventListener("change", (event) => { const file = event.target.files[0]; if (file) restoreBackup(file); event.target.value = ""; });
  $$('[data-theme-choice]').forEach((button) => button.addEventListener("click", () => { applyTheme(button.dataset.themeChoice); scheduleSave(); })); matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (state.theme === "system") applyTheme("system"); });
  els.installApp.addEventListener("click", async () => { if (!installPrompt) { const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; showToast(location.protocol === "file:" ? "本地版已经可以离线使用" : ios ? "在 Safari 点分享图标，再选“添加到主屏幕”" : "请使用浏览器菜单中的“安装此应用”"); return; } installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; updateInstallUi(); });
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event; updateInstallUi(); }); window.addEventListener("appinstalled", () => { installPrompt = null; updateInstallUi(true); showToast("拾光已经安装到桌面"); });
  window.chrome?.webview?.addEventListener?.("message", (event) => {
    const message = event.data;
    if (message?.type === "reminderScheduleError") showToast("Windows 开机提醒守候未开启；打开拾光时仍会补提醒");
  });
}

function updateInstallUi(installed = matchMedia("(display-mode: standalone)").matches) {
  installed = installed || new URLSearchParams(location.search).has("desktop") || Boolean(window.chrome?.webview);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (installed) { els.installApp.disabled = true; els.installApp.textContent = "已经安装"; els.installHint.textContent = "你正在独立的拾光窗口中使用。"; }
  else if (location.protocol === "file:") { els.installApp.textContent = "当前为便携版"; els.installHint.textContent = "这个版本已经可以离线使用；桌面安装版在下载包中。"; }
  else if (ios) { els.installApp.disabled = false; els.installApp.textContent = "添加到主屏幕"; els.installHint.textContent = "在 Safari 点分享图标，再选“添加到主屏幕”，就能像 App 一样打开。"; }
  else { els.installApp.disabled = false; els.installApp.textContent = installPrompt ? "安装到桌面" : "查看安装方式"; }
}

function registerWebMcpTools() {
  const context = document.modelContext; if (!context?.registerTool) return; const register = (tool) => { try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch {} };
  register({ name: "list_notes", title: "查看便签", description: "查看拾光中最近的便签，可按标签筛选。", inputSchema: { type: "object", properties: { tag: { type: "string", enum: ["生活", "灵感", "片刻"] }, limit: { type: "integer", minimum: 1, maximum: 20 } }, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute(input = {}) { const list = state.notes.filter((n) => !input.tag || n.tag === input.tag).slice(0, input.limit || 10).map(({id,title,body,tag,mood,noteDate,createdAt,pinned,reminderAt}) => ({id,title,body,tag,mood,noteDate,createdAt,pinned,reminderAt})); return { notes: list }; } });
  register({
    name: "create_note", title: "创建便签", description: "创建一张生活便签并保存到当前设备，可选择过去、今天或未来的便签日期，并单独设置提醒时间。",
    inputSchema: { type: "object", properties: { title: { type: "string", minLength: 1, maxLength: 40 }, body: { type: "string", minLength: 1, maxLength: 1000 }, tag: { type: "string", enum: ["生活", "灵感", "片刻"] }, mood: { type: "string", enum: Object.keys(moods) }, pinned: { type: "boolean" }, noteDate: { type: "string", description: "便签所在的日历日期，YYYY-MM-DD；省略时为今天" }, reminderAt: { type: "string", description: "可选的 ISO 8601 未来提醒时间，独立于便签日期" } }, required: ["title", "body", "tag", "mood"], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(input) {
      if (!input || typeof input.title !== "string" || typeof input.body !== "string" || !["生活","灵感","片刻"].includes(input.tag) || !moods[input.mood]) throw new Error("便签内容无效");
      const noteDate = input.noteDate === undefined ? dateKey(new Date()) : validGoalDate(input.noteDate);
      if (!noteDate) throw new Error("便签日期必须是有效的 YYYY-MM-DD 日期");
      const reminderAt = input.reminderAt ? new Date(input.reminderAt) : null;
      if (reminderAt && (!Number.isFinite(reminderAt.getTime()) || reminderAt <= new Date())) throw new Error("提醒时间必须是未来时间");
      const note = { id: uid(), title: input.title.trim().slice(0,40), body: input.body.trim().slice(0,1000), noteDate, tag: input.tag, mood: input.mood, pinned: Boolean(input.pinned), photo: "", reminderAt: reminderAt ? reminderAt.toISOString() : "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      if (!note.title || !note.body) throw new Error("标题和内容不能为空");
      state.notes.unshift(note); if (note.reminderAt) scheduleNativeReminder(note); await writeToStorage(); renderAll(); switchView("notes");
      return { id: note.id, saved: true, noteDate: note.noteDate, reminderAt: note.reminderAt || null };
    }
  });
  register({ name: "add_monthly_review_to_yearbook", title: "收录月度回顾", description: "把指定月份的便签整理成月度回顾并写入年终手记。", inputSchema: { type: "object", properties: { year: { type: "integer", minimum: 2000, maximum: 2100 }, month: { type: "integer", minimum: 1, maximum: 12 } }, required: ["year", "month"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, async execute(input) { reviewCursor = new Date(input.year, input.month - 1, 1); const block = monthlyReviewMarkdown(); if (!block) throw new Error("这个月还没有便签"); state.yearbook = `${state.yearbook.trimEnd()}${block}`; els.editor.value = state.yearbook; updateMarkdown(false); await writeToStorage(); renderReview(); switchView("yearbook"); return { saved: true, noteCount: notesForMonth(reviewCursor).length }; } });
}

async function init() {
  state = normalizeState(await loadFromStorage()); applyTheme(state.theme); els.editor.value = state.yearbook; updateMarkdown(false);
  $("#todayDate").textContent = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" }); $("#yearLabel").textContent = currentYear;
  bindEvents(); renderAll(); updateInstallUi(); registerWebMcpTools(); scheduleSave();
  state.notes.filter((note) => note.reminderAt && new Date(note.reminderAt) > new Date()).forEach(scheduleNativeReminder);
  const requestedReminderId = new URLSearchParams(location.search).get("reminder") || "";
  setTimeout(() => checkReminders(requestedReminderId), 250);
  clearInterval(reminderTimer); reminderTimer = setInterval(() => checkReminders(), 15_000);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

init().catch(() => { state = normalizeState({ notes: defaultNotes, trash: [], yearbook: defaultMarkdown, theme: "light" }); bindEvents(); renderAll(); showToast("本地数据载入失败，已打开临时记录空间"); });
