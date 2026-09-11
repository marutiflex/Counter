// ==========================================
// STORAGE KEYS
// ==========================================

const STORAGE_KEY = "myCounters";
const SETTINGS_KEY = "myCounterSettings";

let counters = [];
let settings = { theme: "light", sound: false, vibration: false, showArchived: false };

let editingCounterId = null;
let activeCounterId = null;
let reportCounterId = null;
let activeReportTab = "daily";

// session-only undo stack: { counterId, date }
let undoStack = [];

// tracks which reminders already fired today: "counterId-YYYY-MM-DD"
let firedReminders = new Set();


// ==========================================
// LOAD / SAVE
// ==========================================

function loadCounters() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        counters = data ? JSON.parse(data) : [];
        counters.forEach(normalizeCounter);
    } catch (error) {
        counters = [];
        console.error("Error loading counters:", error);
    }
}

function normalizeCounter(counter) {
    if (!counter.emoji) counter.emoji = "📿";
    if (!counter.color) counter.color = "#8B3A3A";
    if (!Array.isArray(counter.history)) counter.history = [];
    if (!counter.reminder) counter.reminder = { enabled: false, time: "20:00" };
    if (typeof counter.score !== "number") counter.score = 0;
    if (typeof counter.archived !== "boolean") counter.archived = false;
}

function saveCounters() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counters));
}

function loadSettings() {
    try {
        const data = localStorage.getItem(SETTINGS_KEY);
        if (data) settings = Object.assign(settings, JSON.parse(data));
    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}


// ==========================================
// DOM READY
// ==========================================

document.addEventListener("DOMContentLoaded", function () {

    loadSettings();
    applyTheme();
    applySettingsToUI();

    loadCounters();
    renderCounters();
    renderDashboardLine();

    document.getElementById("createCounterBtn").addEventListener("click", openCreateModal);
    document.getElementById("counterForm").addEventListener("submit", saveCounter);
    document.getElementById("counterScreen").addEventListener("click", handleCounterClick);

    document.getElementById("backBtn").addEventListener("click", function (event) {
        event.stopPropagation();
        closeCounterScreen();
    });

    document.getElementById("counterEditBtn").addEventListener("click", function (event) {
        event.stopPropagation();
        const id = activeCounterId;
        closeCounterScreen();
        if (id) editCounter(id);
    });

    document.getElementById("undoBtn").addEventListener("click", function (event) {
        event.stopPropagation();
        undoLastTap();
    });

    document.getElementById("resetBtn").addEventListener("click", function (event) {
        event.stopPropagation();
        resetCounter();
    });

    document.querySelectorAll(".quickadd-btn").forEach(function (btn) {
        btn.addEventListener("click", function (event) {
            event.stopPropagation();
            changeScore(Number(btn.dataset.amount));
            undoStack.push({ counterId: activeCounterId, delta: Number(btn.dataset.amount) });
        });
    });

    document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);
    document.getElementById("settingsBtn").addEventListener("click", openSettings);

    document.getElementById("soundToggle").addEventListener("change", function (e) {
        settings.sound = e.target.checked;
        saveSettings();
    });

    document.getElementById("vibrationToggle").addEventListener("change", function (e) {
        settings.vibration = e.target.checked;
        saveSettings();
    });

    document.getElementById("showArchivedToggle").addEventListener("change", function (e) {
        settings.showArchived = e.target.checked;
        saveSettings();
        renderCounters();
    });

    document.getElementById("exportAllBtn").addEventListener("click", exportAllData);
    document.getElementById("importAllBtn").addEventListener("click", function () {
        document.getElementById("importFileInput").click();
    });
    document.getElementById("importFileInput").addEventListener("change", importAllData);
    document.getElementById("exportCsvBtn").addEventListener("click", exportCounterCSV);

    setupEmojiAndColorPickers();

    // check reminders every 30s
    setInterval(checkReminders, 30000);

    // keyboard support: space to count, backspace to undo, when a counter is open
    document.addEventListener("keydown", function (e) {
        const screenOpen = document.getElementById("counterScreen").classList.contains("show");
        if (!screenOpen) return;
        if (e.code === "Space") {
            e.preventDefault();
            increaseCounter();
        }
        if (e.key === "Backspace") {
            e.preventDefault();
            undoLastTap();
        }
    });

});


// ==========================================
// THEME
// ==========================================

function applyTheme() {
    document.body.setAttribute("data-theme", settings.theme);
}

function toggleTheme() {
    settings.theme = settings.theme === "dark" ? "light" : "dark";
    saveSettings();
    applyTheme();
}

function applySettingsToUI() {
    document.getElementById("soundToggle").checked = !!settings.sound;
    document.getElementById("vibrationToggle").checked = !!settings.vibration;
    document.getElementById("showArchivedToggle").checked = !!settings.showArchived;
}


// ==========================================
// SETTINGS MODAL
// ==========================================

function openSettings() {
    document.getElementById("settingsModal").classList.add("show");
}

function closeSettings() {
    document.getElementById("settingsModal").classList.remove("show");
}


// ==========================================
// SOUND + VIBRATION FEEDBACK
// ==========================================

let audioCtx = null;

function playTapSound() {
    if (!settings.sound) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(660, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
    } catch (error) {
        console.error("Sound failed:", error);
    }
}

function triggerVibration() {
    if (!settings.vibration) return;
    if (navigator.vibrate) navigator.vibrate(15);
}


// ==========================================
// OPEN CREATE MODAL
// ==========================================

function openCreateModal() {
    editingCounterId = null;
    document.getElementById("modalTitle").innerText = "Create Counter";
    document.getElementById("counterForm").reset();
    setEmojiSelection("📿");
    setColorSelection("#8B3A3A");
    document.getElementById("reminderEnabled").checked = false;
    document.getElementById("counterModal").classList.add("show");
}

function closeModal() {
    document.getElementById("counterModal").classList.remove("show");
}


// ==========================================
// EMOJI / COLOR PICKERS
// ==========================================

function setupEmojiAndColorPickers() {
    document.querySelectorAll(".emoji-opt").forEach(function (btn) {
        btn.addEventListener("click", function () {
            setEmojiSelection(btn.dataset.emoji);
        });
    });

    document.querySelectorAll(".color-opt").forEach(function (btn) {
        btn.addEventListener("click", function () {
            setColorSelection(btn.dataset.color);
        });
    });
}

function setEmojiSelection(emoji) {
    document.getElementById("counterEmoji").value = emoji;
    document.querySelectorAll(".emoji-opt").forEach(function (btn) {
        btn.classList.toggle("selected", btn.dataset.emoji === emoji);
    });
}

function setColorSelection(color) {
    document.getElementById("counterColor").value = color;
    document.querySelectorAll(".color-opt").forEach(function (btn) {
        btn.classList.toggle("selected", btn.dataset.color === color);
    });
}


// ==========================================
// SAVE COUNTER
// ==========================================

async function saveCounter(event) {
    event.preventDefault();

    const title = document.getElementById("counterTitle").value.trim();
    const target = Number(document.getElementById("counterTarget").value);
    const stopAtTarget = document.getElementById("stopAtTarget").value;
    const emoji = document.getElementById("counterEmoji").value || "📿";
    const color = document.getElementById("counterColor").value || "#8B3A3A";
    const reminderEnabled = document.getElementById("reminderEnabled").checked;
    const reminderTime = document.getElementById("reminderTime").value || "20:00";
    const file = document.getElementById("counterBackground").files[0];

    if (!title) {
        alert("Please enter counter title");
        return;
    }

    if (!target || target <= 0) {
        alert("Please enter valid target");
        return;
    }

    if (reminderEnabled && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    let background = null;
    if (file) background = await convertImageToBase64(file);

    if (editingCounterId) {
        const counter = counters.find(item => item.id === editingCounterId);
        if (counter) {
            counter.title = title;
            counter.target = target;
            counter.stopAtTarget = stopAtTarget;
            counter.emoji = emoji;
            counter.color = color;
            counter.reminder = { enabled: reminderEnabled, time: reminderTime };
            if (background) counter.background = background;
        }
    } else {
        const newCounter = {
            id: Date.now().toString() + Math.random().toString(16).slice(2),
            title: title,
            target: target,
            stopAtTarget: stopAtTarget,
            emoji: emoji,
            color: color,
            score: 0,
            background: background,
            history: [],
            reminder: { enabled: reminderEnabled, time: reminderTime },
            createdAt: getLocalDateString()
        };
        counters.push(newCounter);
    }

    saveCounters();
    renderCounters();
    renderDashboardLine();
    closeModal();
}

function convertImageToBase64(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function (event) { resolve(event.target.result); };
        reader.onerror = function () { reject("Image upload failed"); };
        reader.readAsDataURL(file);
    });
}


// ==========================================
// STATS HELPERS
// ==========================================

function getLocalDateString(offsetDays) {
    const date = new Date();
    if (offsetDays) date.setDate(date.getDate() + offsetDays);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function countForDate(counter, dateStr) {
    const entry = counter.history.find(item => item.date === dateStr);
    return entry ? entry.count : 0;
}

function getStreaks(counter) {
    const activeDates = new Set(counter.history.filter(h => h.count > 0).map(h => h.date));

    // current streak: walk back from today (or yesterday if today has no taps yet)
    let current = 0;
    let cursor = new Date();
    if (!activeDates.has(getLocalDateString())) {
        cursor.setDate(cursor.getDate() - 1);
    }
    while (true) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        if (activeDates.has(key)) {
            current++;
            cursor.setDate(cursor.getDate() - 1);
        } else {
            break;
        }
    }

    // best streak: scan sorted unique dates for longest consecutive run
    const sorted = Array.from(activeDates).sort();
    let best = 0, run = 0, prevDate = null;
    sorted.forEach(function (dateStr) {
        const d = new Date(dateStr + "T00:00:00");
        if (prevDate) {
            const diffDays = Math.round((d - prevDate) / 86400000);
            run = diffDays === 1 ? run + 1 : 1;
        } else {
            run = 1;
        }
        best = Math.max(best, run);
        prevDate = d;
    });

    return { current, best: Math.max(best, current) };
}

function getRecentAverage(counter, days) {
    let total = 0;
    for (let i = 0; i < days; i++) {
        total += countForDate(counter, getLocalDateString(-i));
    }
    return total / days;
}

function getEtaText(counter) {
    if (counter.score >= counter.target) return "Target reached 🎉";
    const avg = getRecentAverage(counter, 7);
    if (avg <= 0) return "";
    const remaining = counter.target - counter.score;
    const days = Math.ceil(remaining / avg);
    return `At your last 7-day pace, ~${days} day${days === 1 ? "" : "s"} to reach target`;
}


// ==========================================
// DASHBOARD LINE
// ==========================================

function renderDashboardLine() {
    const today = getLocalDateString();
    let todayTotal = 0;
    let activeCounters = 0;

    counters.filter(c => !c.archived).forEach(function (counter) {
        const t = countForDate(counter, today);
        if (t > 0) { todayTotal += t; activeCounters++; }
    });

    const line = document.getElementById("dashboardLine");
    if (counters.length === 0) {
        line.innerText = "Create a counter to get started";
    } else if (todayTotal === 0) {
        line.innerText = "Nothing counted yet today";
    } else {
        line.innerText = `Today: ${todayTotal} taps across ${activeCounters} counter${activeCounters === 1 ? "" : "s"}`;
    }
}


// ==========================================
// RENDER COUNTERS
// ==========================================

function renderCounters() {
    const counterList = document.getElementById("counterList");
    const emptyState = document.getElementById("emptyState");

    counterList.innerHTML = "";

    if (counters.length === 0) {
        emptyState.querySelector("h2").innerText = "No counters yet";
        emptyState.querySelector("p").innerText = "Create one to start tracking — a japa count, a habit, reps, anything you tally by hand.";
        emptyState.style.display = "block";
        return;
    }

    const visibleCounters = counters.filter(c => settings.showArchived || !c.archived);

    if (visibleCounters.length === 0) {
        emptyState.querySelector("h2").innerText = "All counters are archived";
        emptyState.querySelector("p").innerText = "Turn on \"Show archived counters\" in Settings to see them.";
        emptyState.style.display = "block";
        return;
    }
    emptyState.style.display = "none";

    visibleCounters.forEach(function (counter) {
        const streaks = getStreaks(counter);
        const today = countForDate(counter, getLocalDateString());
        const yesterday = countForDate(counter, getLocalDateString(-1));
        let percent = (counter.score / counter.target) * 100;
        if (percent > 100) percent = 100;

        const card = document.createElement("div");
        card.className = "counter-card" + (counter.archived ? " is-archived" : "");

        const imageBlock = counter.background
            ? `<div class="counter-card-image" style="background-image:url('${counter.background}')"></div>`
            : "";

        const statusBadge = counter.archived
            ? `<div class="archived-badge">📦 Archived</div>`
            : `<div class="target-status">${counter.stopAtTarget === "yes" ? "🎯 Stops at target" : "♾️ Unlimited"}</div>`;

        card.innerHTML = `
            <div class="counter-card-bg" style="background:${counter.color}"></div>
            ${imageBlock}
            <div class="counter-card-content">

                <div class="card-title-row">
                    <span class="card-emoji">${counter.emoji}</span>
                    <h2>${escapeHTML(counter.title)}</h2>
                </div>

                <div class="counter-score-row">
                    <div>
                        <div class="score" style="color:${counter.color}">${counter.score}</div>
                        <div class="target">Target: ${counter.target}</div>
                    </div>
                    ${statusBadge}
                </div>

                <div class="mini-stats">
                    <span>Today <b>${today}</b></span>
                    <span>Yesterday <b>${yesterday}</b></span>
                    <span>🔥 <b>${streaks.current}</b>-day streak</span>
                </div>

                <div class="mini-progress">
                    <div class="mini-progress-bar" style="width:${percent}%; background:${counter.color}"></div>
                </div>

                <div class="card-buttons">
                    <button class="open-btn" onclick="openCounter('${counter.id}')">Open</button>
                    <button class="report-btn" onclick="openReport('${counter.id}')">Reports</button>
                </div>

                <div class="card-buttons">
                    <button class="edit-btn" onclick="editCounter('${counter.id}')">✏ Edit</button>
                    <button class="delete-btn" onclick="deleteCounter('${counter.id}')">🗑 Delete</button>
                </div>

            </div>
        `;

        counterList.appendChild(card);
    });
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}


// ==========================================
// OPEN COUNTER SCREEN
// ==========================================

function openCounter(id) {
    activeCounterId = id;
    const counter = counters.find(item => item.id === id);
    if (!counter) return;

    document.getElementById("activeCounterEmoji").innerText = counter.emoji;
    document.getElementById("activeCounterTitle").innerText = counter.title;
    document.getElementById("activeCounterNumber").innerText = counter.score;
    document.getElementById("activeCounterTarget").innerText = counter.target;

    const counterScreen = document.getElementById("counterScreen");
    counterScreen.style.backgroundImage = counter.background
        ? `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url("${counter.background}")`
        : "";

    refreshStatStrip(counter);
    updateProgress();

    counterScreen.classList.add("show");
}

function refreshStatStrip(counter) {
    const streaks = getStreaks(counter);
    document.getElementById("statToday").innerText = countForDate(counter, getLocalDateString());
    document.getElementById("statYesterday").innerText = countForDate(counter, getLocalDateString(-1));
    document.getElementById("statStreak").innerText = streaks.current;
    document.getElementById("statBestStreak").innerText = streaks.best;
    document.getElementById("etaText").innerText = getEtaText(counter);
}


// ==========================================
// HANDLE SCREEN CLICK (TAP TO COUNT)
// ==========================================

function handleCounterClick(event) {
    if (event.target.closest("button")) return;
    // if (event.target.closest(".editable-number")) {
    //     editScoreManually();
    //     return;
    // }
    increaseCounter();
}


// ==========================================
// CHANGE SCORE (shared by tap, quick-add, undo)
// ==========================================

function changeScore(delta, options) {
    options = options || {};
    const counter = counters.find(item => item.id === activeCounterId);
    if (!counter) return;

    if (delta > 0 && counter.stopAtTarget === "yes" && counter.score >= counter.target) {
        alert("🎉 Target Completed!");
        return;
    }

    counter.score = Math.max(0, counter.score + delta);

    const today = getLocalDateString();
    let entry = counter.history.find(item => item.date === today);
    if (!entry) {
        entry = { date: today, count: 0 };
        counter.history.push(entry);
    }
    entry.count = Math.max(0, entry.count + delta);

    saveCounters();

    if (!options.silent) {
        playTapSound();
        triggerVibration();
    }

    document.getElementById("activeCounterNumber").innerText = counter.score;
    refreshStatStrip(counter);
    updateProgress();
}

function increaseCounter() {
    const counter = counters.find(item => item.id === activeCounterId);
    if (!counter) return;
    changeScore(1);
    undoStack.push({ counterId: counter.id, delta: 1 });
}

function undoLastTap() {
    if (undoStack.length === 0) return;
    const last = undoStack.pop();
    if (last.counterId !== activeCounterId) return;
    changeScore(-last.delta, { silent: true });
}

function resetCounter() {
    const counter = counters.find(item => item.id === activeCounterId);
    if (!counter) return;

    const ok = confirm(`Reset "${counter.title}" back to 0? Your activity history, streaks and reports stay intact.`);
    if (!ok) return;

    counter.score = 0;
    counter.history =[]
    saveCounters();

    document.getElementById("activeCounterNumber").innerText = counter.score;
    refreshStatStrip(counter);
    updateProgress();
}

document.getElementById('editScrore').addEventListener('click',editScoreManually)

function editScoreManually() {
    const counter = counters.find(item => item.id === activeCounterId);
    if (!counter) return;

    const input = prompt(`Set the exact count for "${counter.title}"`, counter.score);
    if (input === null) return;

    const value = Number(input);
    if (!Number.isFinite(value) || value < 0) {
        alert("Please enter a valid number, 0 or higher.");
        return;
    }

    const diff = Math.round(value) - counter.score;
    changeScore(diff, { silent: true });
}

function updateProgress() {
    const counter = counters.find(item => item.id === activeCounterId);
    if (!counter) return;
    let percent = (counter.score / counter.target) * 100;
    if (percent > 100) percent = 100;
    document.getElementById("progressBar").style.width = percent + "%";
}


// ==========================================
// CLOSE COUNTER SCREEN
// ==========================================

function closeCounterScreen() {
    document.getElementById("counterScreen").classList.remove("show");
    activeCounterId = null;
    undoStack = [];
    renderCounters();
    renderDashboardLine();
}


// ==========================================
// EDIT / DELETE
// ==========================================

function editCounter(id) {
    const counter = counters.find(item => item.id === id);
    if (!counter) return;

    editingCounterId = id;
    document.getElementById("modalTitle").innerText = "Edit Counter";
    document.getElementById("counterTitle").value = counter.title;
    document.getElementById("counterTarget").value = counter.target;
    document.getElementById("stopAtTarget").value = counter.stopAtTarget;
    setEmojiSelection(counter.emoji);
    setColorSelection(counter.color);
    document.getElementById("reminderEnabled").checked = !!counter.reminder.enabled;
    document.getElementById("reminderTime").value = counter.reminder.time || "20:00";

    document.getElementById("counterModal").classList.add("show");
}

function toggleArchive(id) {
    const counter = counters.find(item => item.id === id);
    if (!counter) return;

    counter.archived = !counter.archived;
    saveCounters();
    renderCounters();
    renderDashboardLine();
}

function deleteCounter(id) {
    const confirmDelete = confirm("Are you sure you want to delete this counter?");
    if (!confirmDelete) return;

    counters = counters.filter(item => item.id !== id);
    saveCounters();
    renderCounters();
    renderDashboardLine();
}


// ==========================================
// REMINDERS
// ==========================================

function checkReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const nowTime = `${hh}:${mm}`;
    const today = getLocalDateString();

    counters.forEach(function (counter) {
        if (!counter.reminder || !counter.reminder.enabled) return;
        if (counter.reminder.time !== nowTime) return;

        const key = `${counter.id}-${today}`;
        if (firedReminders.has(key)) return;
        firedReminders.add(key);

        new Notification("Counter reminder", {
            body: `${counter.emoji} Time for "${counter.title}" — today's count is ${countForDate(counter, today)}.`
        });
    });
}


// ==========================================
// REPORTS
// ==========================================

function openReport(id) {
    reportCounterId = id;
    document.getElementById("reportModal").classList.add("show");
    setActiveReportTab("daily");
    renderReport("daily");
}

function closeReport() {
    document.getElementById("reportModal").classList.remove("show");
}

function showReport(type) {
    setActiveReportTab(type);
    renderReport(type);
}

function setActiveReportTab(type) {
    activeReportTab = type;
    document.querySelectorAll(".report-tab").forEach(function (button) {
        button.classList.toggle("active", button.dataset.tab === type);
    });
}

function renderReport(type) {
    const counter = counters.find(item => item.id === reportCounterId);
    if (!counter) return;

    const reportContent = document.getElementById("reportContent");
    const streaks = getStreaks(counter);

    const summaryHTML = `
        <div class="report-summary">
            <div class="report-summary-item"><span>${countForDate(counter, getLocalDateString())}</span><label>Today</label></div>
            <div class="report-summary-item"><span>${countForDate(counter, getLocalDateString(-1))}</span><label>Yesterday</label></div>
            <div class="report-summary-item"><span>${streaks.current}</span><label>Streak</label></div>
            <div class="report-summary-item"><span>${streaks.best}</span><label>Best streak</label></div>
        </div>
    `;

    if (type === "activity") {
        reportContent.innerHTML = summaryHTML + buildHeatmap(counter);
        return;
    }

    let data = [];

    if (type === "daily") {
        data = counter.history.map(item => ({ label: formatDate(item.date), count: item.count }));
    }

    if (type === "weekly") {
        const weeks = {};
        counter.history.forEach(function (item) {
            const date = new Date(item.date + "T00:00:00");
            const weekKey = getWeekKey(date);
            weeks[weekKey] = (weeks[weekKey] || 0) + item.count;
        });
        data = Object.entries(weeks).map(([label, count]) => ({ label, count }));
    }

    if (type === "monthly") {
        const months = {};
        counter.history.forEach(function (item) {
            const date = new Date(item.date + "T00:00:00");
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            months[key] = (months[key] || 0) + item.count;
        });
        data = Object.entries(months).map(([key, count]) => ({ label: formatMonth(key), count }));
    }

    if (data.length === 0) {
        reportContent.innerHTML = summaryHTML + `<p style="text-align:center; padding:30px; color:var(--muted);">No report data available.</p>`;
        return;
    }

    reportContent.innerHTML = summaryHTML + data.reverse().map(function (item) {
        return `<div class="report-item"><span>${item.label}</span><strong>${item.count}</strong></div>`;
    }).join("");
}

function buildHeatmap(counter) {
    const days = 84; // 12 weeks
    const counts = {};
    counter.history.forEach(h => { counts[h.date] = h.count; });

    let maxCount = 0;
    Object.values(counts).forEach(c => { if (c > maxCount) maxCount = c; });

    let cellsHTML = "";
    for (let i = days - 1; i >= 0; i--) {
        const dateStr = getLocalDateString(-i);
        const count = counts[dateStr] || 0;
        const intensity = maxCount === 0 ? 0 : count / maxCount;
        const bg = count === 0 ? "var(--base)" : intensityColor(counter.color, intensity);
        cellsHTML += `<div class="heatmap-cell" style="background:${bg}" title="${dateStr}: ${count}"></div>`;
    }

    return `
        <div class="heatmap">${cellsHTML}</div>
        <div class="heatmap-legend">
            <span>Less</span>
            <div class="heatmap-cell" style="background:var(--base)"></div>
            <div class="heatmap-cell" style="background:${intensityColor(counter.color, 0.33)}"></div>
            <div class="heatmap-cell" style="background:${intensityColor(counter.color, 0.66)}"></div>
            <div class="heatmap-cell" style="background:${intensityColor(counter.color, 1)}"></div>
            <span>More</span>
        </div>
        <p style="margin-top:14px; font-size:13px; color:var(--muted);">Last 84 days of activity.</p>
    `;
}

function intensityColor(hex, intensity) {
    const min = 0.25;
    const alpha = min + intensity * (1 - min);
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha.toFixed(2)})`;
}

function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const bigint = parseInt(clean, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function formatDate(dateString) {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatMonth(key) {
    const parts = key.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    return new Date(year, month, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function getWeekKey(date) {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - firstDay) / 86400000);
    const week = Math.ceil((days + firstDay.getDay() + 1) / 7);
    return `Week ${week}, ${date.getFullYear()}`;
}


// ==========================================
// EXPORT / IMPORT
// ==========================================

function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportAllData() {
    const payload = { exportedAt: new Date().toISOString(), counters: counters };
    downloadFile(`tally-backup-${getLocalDateString()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const parsed = JSON.parse(e.target.result);
            const incoming = Array.isArray(parsed) ? parsed : parsed.counters;
            if (!Array.isArray(incoming)) throw new Error("Invalid backup file");

            const replace = confirm("Replace all current counters with this backup? Cancel to merge instead (adds any counters with new IDs).");

            if (replace) {
                counters = incoming;
            } else {
                const existingIds = new Set(counters.map(c => c.id));
                incoming.forEach(function (c) {
                    if (!existingIds.has(c.id)) counters.push(c);
                });
            }

            counters.forEach(normalizeCounter);
            saveCounters();
            renderCounters();
            renderDashboardLine();
            alert("Backup imported.");
        } catch (error) {
            alert("Could not read that file as a valid backup.");
            console.error(error);
        }
        event.target.value = "";
    };
    reader.readAsText(file);
}

function exportCounterCSV() {
    const counter = counters.find(item => item.id === reportCounterId);
    if (!counter) return;

    const rows = [["date", "count"]];
    counter.history
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach(item => rows.push([item.date, item.count]));

    const csv = rows.map(r => r.join(",")).join("\n");
    downloadFile(`${counter.title.replace(/[^a-z0-9]+/gi, "-")}-history.csv`, csv, "text/csv");
}
