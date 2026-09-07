// ==========================================
// STORAGE
// ==========================================

const STORAGE_KEY = "myCounters";

let counters = [];
let editingCounterId = null;
let activeCounterId = null;
let reportCounterId = null;


// ==========================================
// LOAD COUNTERS
// ==========================================

function loadCounters() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        counters = data ? JSON.parse(data) : [];
    } catch (error) {
        counters = [];
        console.error("Error loading counters:", error);
    }
}


// ==========================================
// SAVE COUNTERS
// ==========================================

function saveCounters() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(counters)
    );
}


// ==========================================
// DOM READY
// ==========================================

document.addEventListener("DOMContentLoaded", function () {

    loadCounters();

    renderCounters();


    // CREATE BUTTON

    document
        .getElementById("createCounterBtn")
        .addEventListener("click", openCreateModal);


    // FORM SUBMIT

    document
        .getElementById("counterForm")
        .addEventListener("submit", saveCounter);


    // COUNTER SCREEN CLICK

    document
        .getElementById("counterScreen")
        .addEventListener("click", handleCounterClick);


    // BACK BUTTON

    document
        .getElementById("backBtn")
        .addEventListener("click", function (event) {

            event.stopPropagation();

            closeCounterScreen();

        });


    // EDIT BUTTON

    document
        .getElementById("counterEditBtn")
        .addEventListener("click", function (event) {

            event.stopPropagation();

            const id = activeCounterId;

            closeCounterScreen();

            if (id) {
                editCounter(id);
            }

        });

});


// ==========================================
// OPEN CREATE MODAL
// ==========================================

function openCreateModal() {

    editingCounterId = null;

    document
        .getElementById("modalTitle")
        .innerText = "Create Counter";


    document
        .getElementById("counterForm")
        .reset();


    document
        .getElementById("counterModal")
        .classList
        .add("show");

}


// ==========================================
// CLOSE MODAL
// ==========================================

function closeModal() {

    document
        .getElementById("counterModal")
        .classList
        .remove("show");

}


// ==========================================
// SAVE COUNTER
// ==========================================

async function saveCounter(event) {

    event.preventDefault();


    const title =
        document
            .getElementById("counterTitle")
            .value
            .trim();


    const target =
        Number(
            document
                .getElementById("counterTarget")
                .value
        );


    const stopAtTarget =
        document
            .getElementById("stopAtTarget")
            .value;


    const file =
        document
            .getElementById("counterBackground")
            .files[0];


    if (!title) {

        alert("Please enter counter title");

        return;

    }


    if (!target || target <= 0) {

        alert("Please enter valid target");

        return;

    }


    let background = null;


    if (file) {

        background =
            await convertImageToBase64(file);

    }


    // EDIT

    if (editingCounterId) {

        const counter =
            counters.find(
                item => item.id === editingCounterId
            );


        if (counter) {

            counter.title = title;

            counter.target = target;

            counter.stopAtTarget = stopAtTarget;


            if (background) {

                counter.background = background;

            }

        }

    }

    // CREATE

    else {

        const newCounter = {

            id:
                Date.now().toString()
                + Math.random().toString(16).slice(2),

            title: title,

            target: target,

            stopAtTarget: stopAtTarget,

            score: 0,

            background: background,

            history: []

        };


        counters.push(newCounter);

    }


    saveCounters();

    renderCounters();

    closeModal();

}


// ==========================================
// IMAGE TO BASE64
// ==========================================

function convertImageToBase64(file) {

    return new Promise(function (resolve, reject) {

        const reader = new FileReader();


        reader.onload = function (event) {

            resolve(event.target.result);

        };


        reader.onerror = function () {

            reject("Image upload failed");

        };


        reader.readAsDataURL(file);

    });

}


// ==========================================
// RENDER COUNTERS
// ==========================================

// function renderCounters() {

//     const counterList =
//         document.getElementById("counterList");


//     const emptyState =
//         document.getElementById("emptyState");


//     counterList.innerHTML = "";


//     if (counters.length === 0) {

//         emptyState.style.display = "block";

//         return;

//     }


//     emptyState.style.display = "none";


//     counters.forEach(function (counter) {

//         const card =
//             document.createElement("div");


//         card.className = "counter-card";


//         const bgStyle =
//             counter.background
//                 ? `background-image: url("${counter.background}")`
//                 : "";


//         card.innerHTML = `

//             <div
//                 class="counter-card-bg"
//                 style="${bgStyle}"
//             ></div>

//             <div class="counter-card-content">

//                 <h2>${escapeHTML(counter.title)}</h2>

//                 <div class="score">
//                     ${counter.score}
//                 </div>

//                 <div class="target">
//                     Target: ${counter.target}
//                 </div>

//                 <div class="card-buttons">

//                     <button
//                         class="open-btn"
//                         onclick="openCounter('${counter.id}')"
//                     >
//                         Open
//                     </button>

//                     <button
//                         class="report-btn"
//                         onclick="openReport('${counter.id}')"
//                     >
//                         Reports
//                     </button>

//                 </div>


//                 <div class="card-buttons">

//                     <button
//                         class="edit-btn"
//                         onclick="editCounter('${counter.id}')"
//                     >
//                         Edit
//                     </button>


//                     <button
//                         class="delete-btn"
//                         onclick="deleteCounter('${counter.id}')"
//                     >
//                         Delete
//                     </button>

//                 </div>

//             </div>

//         `;


//         counterList.appendChild(card);

//     });

// }

function renderCounters() {

    const counterList =
        document.getElementById("counterList");


    const emptyState =
        document.getElementById("emptyState");


    counterList.innerHTML = "";


    if (counters.length === 0) {

        emptyState.style.display = "block";

        return;

    }


    emptyState.style.display = "none";


    counters.forEach(function (counter) {

        const card =
            document.createElement("div");


        card.className =
            "counter-card";


        // BACKGROUND IMAGE

        const bgStyle =
            counter.background
                ? `
                    background-image:
                    linear-gradient(
                        rgba(0,0,0,0.25),
                        rgba(0,0,0,0.25)
                    ),
                    url("${counter.background}");

                    background-size: cover;

                    background-position: center;
                  `
                : "";


        card.innerHTML = `

            <div
                class="counter-card-bg"
                style="${bgStyle}"
            >

                <div class="counter-image-overlay">

                    <h2>
                        ${escapeHTML(counter.title)}
                    </h2>

                </div>

            </div>


            <div class="counter-card-content">


                <div class="counter-score-row">

                    <div>

                        <div class="score">
                            ${counter.score}
                        </div>

                        <div class="target">
                            Target: ${counter.target}
                        </div>

                    </div>


                    <div class="target-status">

                        ${counter.stopAtTarget === "yes"
                ? "🎯 Target Stop ON"
                : "♾️ Unlimited"
            }

                    </div>

                </div>


                <div class="card-buttons">

                    <button
                        class="open-btn"
                        onclick="openCounter('${counter.id}')"
                    >
                        Open
                    </button>


                    <button
                        class="report-btn"
                        onclick="openReport('${counter.id}')"
                    >
                        Reports
                    </button>

                </div>


                <div class="card-buttons">


                    <button
                        class="edit-btn"
                        onclick="editCounter('${counter.id}')"
                    >
                        ✏ Edit
                    </button>


                    <button
                        class="delete-btn"
                        onclick="deleteCounter('${counter.id}')"
                    >
                        🗑 Delete
                    </button>


                </div>


            </div>

        `;


        counterList.appendChild(card);

    });

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


// ==========================================
// OPEN COUNTER
// ==========================================

function openCounter(id) {

    activeCounterId = id;


    const counter =
        counters.find(
            item => item.id === id
        );


    if (!counter) return;


    document
        .getElementById("activeCounterTitle")
        .innerText =
        counter.title;


    document
        .getElementById("activeCounterNumber")
        .innerText =
        counter.score;


    document
        .getElementById("activeCounterTarget")
        .innerText =
        counter.target;


    const counterScreen =
        document.getElementById("counterScreen");


    if (counter.background) {

        counterScreen.style.backgroundImage =
            `
            linear-gradient(
                rgba(0,0,0,0.55),
                rgba(0,0,0,0.55)
            ),
            url("${counter.background}")
            `;

    } else {

        counterScreen.style.backgroundImage =
            "";

    }


    updateProgress();


    counterScreen
        .classList
        .add("show");

}


// ==========================================
// HANDLE SCREEN CLICK
// ==========================================

function handleCounterClick(event) {

    if (event.target.closest("button")) {
        return;
    }


    increaseCounter();

}


// ==========================================
// INCREASE COUNTER
// ==========================================

function increaseCounter() {

    const counter =
        counters.find(
            item =>
                item.id === activeCounterId
        );


    if (!counter) return;


    // STOP AT TARGET

    if (
        counter.stopAtTarget === "yes"
        &&
        counter.score >= counter.target
    ) {

        alert(
            "🎉 Target Completed!"
        );

        return;

    }


    // INCREASE

    counter.score++;


    // SAVE HISTORY

    const today =
        getLocalDateString();


    const existingHistory =
        counter.history.find(
            item => item.date === today
        );


    if (existingHistory) {

        existingHistory.count++;

    } else {

        counter.history.push({

            date: today,

            count: 1

        });

    }


    saveCounters();


    document
        .getElementById("activeCounterNumber")
        .innerText =
        counter.score;


    updateProgress();

}


// ==========================================
// LOCAL DATE
// ==========================================

function getLocalDateString() {

    const date = new Date();


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    return `${year}-${month}-${day}`;

}


// ==========================================
// UPDATE PROGRESS
// ==========================================

function updateProgress() {

    const counter =
        counters.find(
            item =>
                item.id === activeCounterId
        );


    if (!counter) return;


    let percent =
        (
            counter.score /
            counter.target
        )
        * 100;


    if (percent > 100) {
        percent = 100;
    }


    document
        .getElementById("progressBar")
        .style.width =
        percent + "%";

}


// ==========================================
// CLOSE COUNTER
// ==========================================

function closeCounterScreen() {

    document
        .getElementById("counterScreen")
        .classList
        .remove("show");


    activeCounterId = null;


    renderCounters();

}


// ==========================================
// EDIT COUNTER
// ==========================================

function editCounter(id) {

    const counter =
        counters.find(
            item => item.id === id
        );


    if (!counter) return;


    editingCounterId = id;


    document
        .getElementById("modalTitle")
        .innerText =
        "Edit Counter";


    document
        .getElementById("counterTitle")
        .value =
        counter.title;


    document
        .getElementById("counterTarget")
        .value =
        counter.target;


    document
        .getElementById("stopAtTarget")
        .value =
        counter.stopAtTarget;


    document
        .getElementById("counterModal")
        .classList
        .add("show");

}


// ==========================================
// DELETE COUNTER
// ==========================================

function deleteCounter(id) {

    const confirmDelete =
        confirm(
            "Are you sure you want to delete this counter?"
        );


    if (!confirmDelete) {
        return;
    }


    counters =
        counters.filter(
            item => item.id !== id
        );


    saveCounters();

    renderCounters();

}


// ==========================================
// OPEN REPORT
// ==========================================

function openReport(id) {

    reportCounterId = id;


    document
        .getElementById("reportModal")
        .classList
        .add("show");


    setActiveReportTab("daily");

    renderReport("daily");

}


// ==========================================
// CLOSE REPORT
// ==========================================

function closeReport() {

    document
        .getElementById("reportModal")
        .classList
        .remove("show");

}


// ==========================================
// SHOW REPORT
// ==========================================

function showReport(type) {

    setActiveReportTab(type);

    renderReport(type);

}


// ==========================================
// ACTIVE TAB
// ==========================================

function setActiveReportTab(type) {

    const buttons =
        document.querySelectorAll(
            ".report-tab"
        );


    buttons.forEach(function (button) {

        button
            .classList
            .remove("active");


        if (
            button.innerText
                .toLowerCase() === type
        ) {

            button
                .classList
                .add("active");

        }

    });

}


// ==========================================
// RENDER REPORT
// ==========================================

function renderReport(type) {

    const counter =
        counters.find(
            item =>
                item.id === reportCounterId
        );


    if (!counter) return;


    const reportContent =
        document.getElementById(
            "reportContent"
        );


    let data = [];


    // DAILY

    if (type === "daily") {

        data =
            counter.history.map(
                item => ({
                    label: formatDate(item.date),
                    count: item.count
                })
            );

    }


    // WEEKLY

    if (type === "weekly") {

        const weeks = {};


        counter.history.forEach(function (item) {

            const date =
                new Date(
                    item.date + "T00:00:00"
                );


            const weekKey =
                getWeekKey(date);


            if (!weeks[weekKey]) {

                weeks[weekKey] = 0;

            }


            weeks[weekKey] += item.count;

        });


        data =
            Object.entries(weeks)
                .map(
                    ([label, count]) => ({
                        label,
                        count
                    })
                );

    }


    // MONTHLY

    if (type === "monthly") {

        const months = {};


        counter.history.forEach(function (item) {

            const date =
                new Date(
                    item.date + "T00:00:00"
                );


            const key =
                `${date.getFullYear()}-${String(
                    date.getMonth() + 1
                ).padStart(2, "0")}`;


            if (!months[key]) {

                months[key] = 0;

            }


            months[key] += item.count;

        });


        data =
            Object.entries(months)
                .map(
                    ([key, count]) => ({

                        label:
                            formatMonth(key),

                        count

                    })
                );

    }


    // NO DATA

    if (data.length === 0) {

        reportContent.innerHTML = `
            <p style="text-align:center; padding:30px;">
                No report data available.
            </p>
        `;

        return;

    }


    // RENDER

    reportContent.innerHTML =
        data
            .reverse()
            .map(function (item) {

                return `

                    <div class="report-item">

                        <span>
                            ${item.label}
                        </span>

                        <strong>
                            ${item.count}
                        </strong>

                    </div>

                `;

            })
            .join("");

}


// ==========================================
// FORMAT DATE
// ==========================================

function formatDate(dateString) {

    const date =
        new Date(
            dateString + "T00:00:00"
        );


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );

}


// ==========================================
// FORMAT MONTH
// ==========================================

function formatMonth(key) {

    const parts =
        key.split("-");


    const year =
        Number(parts[0]);


    const month =
        Number(parts[1]) - 1;


    return new Date(
        year,
        month,
        1
    ).toLocaleString(
        "en-IN",
        {
            month: "long",
            year: "numeric"
        }
    );

}


// ==========================================
// WEEK KEY
// ==========================================

function getWeekKey(date) {

    const firstDay =
        new Date(
            date.getFullYear(),
            0,
            1
        );


    const days =
        Math.floor(
            (
                date - firstDay
            ) /
            86400000
        );


    const week =
        Math.ceil(
            (
                days +
                firstDay.getDay() +
                1
            ) /
            7
        );


    return `Week ${week}, ${date.getFullYear()}`;

}
