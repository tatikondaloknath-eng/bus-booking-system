// ============================================================
// SMART TRAFFIC MANAGEMENT
// FRONTEND JAVASCRIPT
// ============================================================

let trafficData = [];
let junctionData = [];

let selectedJunction = 1;

let simulationTimer = null;


// ============================================================
// HELPERS
// ============================================================

function $(id) {
    return document.getElementById(id);
}


function number(value, decimals = 0) {

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return 0;
    }

    return decimals
        ? n.toFixed(decimals)
        : Math.round(n);
}


function formatNumber(value) {

    return Number(value || 0)
        .toLocaleString("en-IN");
}


function statusClass(status) {

    return String(status || "LOW")
        .toLowerCase();
}


function showError(element, message) {

    if (element) {

        element.innerHTML =
            `<div class="error">${message}</div>`;
    }
}


// ============================================================
// NAVIGATION
// ============================================================

document.querySelectorAll(".nav-btn").forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const section =
                    button.dataset.section;

                openSection(section);
            }
        );
    }
);


document.querySelectorAll(
    ".small-btn[data-section]"
).forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                openSection(
                    button.dataset.section
                );
            }
        );
    }
);


function openSection(section) {

    document
        .querySelectorAll(".section")
        .forEach(
            element => {
                element.classList.remove(
                    "active-section"
                );
            }
        );

    const target =
        $(section);

    if (target) {

        target.classList.add(
            "active-section"
        );
    }

    document
        .querySelectorAll(".nav-btn")
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.section === section
                );
            }
        );

    if (section === "dataset") {
        renderDataset();
    }

    if (section === "intersections") {
        renderIntersections();
    }

    if (section === "reports") {
        renderReports();
    }

    if (section === "settings") {
        testDatabase();
    }
}


// ============================================================
// CLOCK
// ============================================================

function updateClock() {

    const now =
        new Date();

    if ($("clock")) {

        $("clock").textContent =
            now.toLocaleTimeString();
    }
}

setInterval(
    updateClock,
    1000
);

updateClock();


// ============================================================
// LOAD EVERYTHING
// ============================================================

async function loadAllData() {

    await Promise.all([
        loadStatistics(),
        loadTrafficData(),
        loadJunctions(),
        testDatabase()
    ]);

    updateSelectedIntersection();

    renderDataset();

    renderIntersections();

    renderReports();
}


// ============================================================
// DATABASE TEST
// ============================================================

async function testDatabase() {

    try {

        const response =
            await fetch("/api/test-db");

        const data =
            await response.json();

        if (
            data.status ===
            "success"
        ) {

            if ($("databaseMessage")) {

                $("databaseMessage").textContent =
                    `Connected • ${formatNumber(
                        data.total_records
                    )} records`;
            }

            if ($("settingsConnection")) {

                $("settingsConnection").innerHTML =
                    `✓ Connected successfully<br>
                     Database: ${data.database}<br>
                     Records: ${formatNumber(
                         data.total_records
                     )}`;
            }

        } else {

            throw new Error(
                data.message
            );
        }

    } catch (error) {

        if ($("databaseMessage")) {

            $("databaseMessage").textContent =
                "Database connection failed";
        }

        if ($("settingsConnection")) {

            $("settingsConnection").innerHTML =
                `✕ Database error<br>
                 ${error.message}`;
        }
    }
}


// ============================================================
// STATISTICS
// ============================================================

async function loadStatistics() {

    try {

        const response =
            await fetch(
                "/api/statistics"
            );

        const data =
            await response.json();

        if (
            data.status !==
            "success"
        ) {
            throw new Error(
                data.message
            );
        }

        $("totalIntersections")
            .textContent =
            data.intersections;

        $("totalVehicles")
            .textContent =
            formatNumber(
                data.vehicles
            );

        $("avgWaiting")
            .textContent =
            number(
                data.waiting,
                2
            );

        $("trafficStatus")
            .textContent =
            data.traffic_status;

        $("trafficStatus").className =
            "status-text " +
            statusClass(
                data.traffic_status
            );

        $("reportRecords")
            .textContent =
            formatNumber(
                data.total_records
            );

        $("reportVehicles")
            .textContent =
            formatNumber(
                data.vehicles
            );

        $("reportWaiting")
            .textContent =
            number(
                data.waiting,
                2
            ) + " sec";

        $("reportSpeed")
            .textContent =
            number(
                data.speed,
                2
            );

    } catch (error) {

        console.error(
            "Statistics error:",
            error
        );
    }
}


// ============================================================
// TRAFFIC DATA
// ============================================================

async function loadTrafficData() {

    try {

        const response =
            await fetch(
                "/api/traffic"
            );

        const data =
            await response.json();

        if (
            !Array.isArray(data)
        ) {

            throw new Error(
                data.message ||
                "Invalid traffic data"
            );
        }

        trafficData =
            data;

        renderRecentRecords();

        renderDataset();

    } catch (error) {

        console.error(
            "Traffic data error:",
            error
        );

        showError(
            $("filteredDatasetRows"),
            error.message
        );
    }
}


// ============================================================
// JUNCTION DATA
// ============================================================

async function loadJunctions() {

    try {

        const response =
            await fetch(
                "/api/junctions"
            );

        const data =
            await response.json();

        if (
            !Array.isArray(data)
        ) {

            throw new Error(
                data.message ||
                "Invalid junction data"
            );
        }

        junctionData =
            data;

        renderJunctionCards();

    } catch (error) {

        console.error(
            "Junction error:",
            error
        );
    }
}


// ============================================================
// DASHBOARD JUNCTION CARDS
// ============================================================

function renderJunctionCards() {

    const container =
        $("junctionCards");

    if (!container) return;

    if (!junctionData.length) {

        container.innerHTML =
            `<div class="loading">
                No junction data found.
             </div>`;

        return;
    }

    container.innerHTML =
        junctionData
            .map(
                item => `

                <div
                    class="junction-card ${
                        item.junction ==
                        selectedJunction
                            ? "selected"
                            : ""
                    }"
                    onclick="selectJunction(
                        ${item.junction}
                    )"
                >

                    <div
                        class="junction-card-header"
                    >

                        <h4>
                            ${item.name}
                        </h4>

                        <span
                            class="badge ${statusClass(
                                item.status
                            )}"
                        >
                            ${item.status}
                        </span>

                    </div>


                    <div
                        class="junction-values"
                    >

                        <div>
                            <span>
                                Vehicles
                            </span>

                            <strong>
                                ${number(
                                    item.vehicles,
                                    1
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Waiting
                            </span>

                            <strong>
                                ${number(
                                    item.waiting,
                                    1
                                )}s
                            </strong>
                        </div>

                        <div>
                            <span>
                                Speed
                            </span>

                            <strong>
                                ${number(
                                    item.speed,
                                    1
                                )}
                            </strong>
                        </div>

                    </div>

                </div>
            `
            )
            .join("");
}


// ============================================================
// SELECT JUNCTION
// ============================================================

function selectJunction(junction) {

    selectedJunction =
        Number(junction);

    $("dashboardJunction").value =
        selectedJunction;

    $("optimizationJunction").value =
        selectedJunction;

    $("simulationJunction").value =
        selectedJunction;

    renderJunctionCards();

    updateSelectedIntersection();
}


// ============================================================
// DASHBOARD JUNCTION SELECT
// ============================================================

$("dashboardJunction")
    ?.addEventListener(
        "change",
        function () {

            selectJunction(
                this.value
            );
        }
    );


// ============================================================
// UPDATE INTERSECTION
// ============================================================

function updateSelectedIntersection() {

    const records =
        trafficData.filter(
            row =>
                Number(row.junction) ===
                Number(selectedJunction)
        );

    if (!records.length) {

        setRoad(
            "northRoad",
            "NORTH",
            0
        );

        setRoad(
            "southRoad",
            "SOUTH",
            0
        );

        setRoad(
            "eastRoad",
            "EAST",
            0
        );

        setRoad(
            "westRoad",
            "WEST",
            0
        );

        return;
    }

    const avg = field => {

        const values =
            records.map(
                row =>
                    Number(
                        row[field] || 0
                    )
            );

        return values.reduce(
            (a, b) => a + b,
            0
        ) / values.length;
    };

    setRoad(
        "northRoad",
        "NORTH",
        avg("north")
    );

    setRoad(
        "southRoad",
        "SOUTH",
        avg("south")
    );

    setRoad(
        "eastRoad",
        "EAST",
        avg("east")
    );

    setRoad(
        "westRoad",
        "WEST",
        avg("west")
    );

    runDashboardOptimization();
}


function setRoad(
    id,
    direction,
    value
) {

    const element =
        $(id);

    if (!element) return;

    element.innerHTML =
        `${direction}
         <strong>
            ${number(value, 0)} cars
         </strong>`;
}


// ============================================================
// DATASET FILTER
// ============================================================

$("datasetJunctionSelect")
    ?.addEventListener(
        "change",
        renderDataset
    );


function renderDataset() {

    const tbody =
        $("filteredDatasetRows");

    if (!tbody) return;

    const filter =
        $("datasetJunctionSelect")
            ?.value || "all";

    let rows =
        trafficData;

    if (filter !== "all") {

        rows =
            trafficData.filter(
                row =>
                    String(
                        row.junction
                    ) === filter
            );
    }

    $("junctionRecordCount")
        .textContent =
        rows.length;

    $("datasetTitle")
        .textContent =
        filter === "all"
            ? "All Junctions"
            : `Junction ${filter}`;

    $("datasetSubtitle")
        .textContent =
        `Showing ${formatNumber(
            rows.length
        )} traffic records`;

    if (!rows.length) {

        tbody.innerHTML =
            `<tr>
                <td colspan="12">
                    No records found.
                 </td>
             </tr>`;

        return;
    }

    tbody.innerHTML =
        rows
            .map(
                row => `

                <tr>

                    <td>
                        ${row.id}
                    </td>

                    <td>
                        Junction ${row.junction}
                    </td>

                    <td>
                        ${number(row.north)}
                    </td>

                    <td>
                        ${number(row.south)}
                    </td>

                    <td>
                        ${number(row.east)}
                    </td>

                    <td>
                        ${number(row.west)}
                    </td>

                    <td>
                        ${number(
                            row.vehicle_count
                        )}
                    </td>

                    <td>
                        ${number(
                            row.average_speed,
                            2
                        )}
                    </td>

                    <td>
                        ${number(
                            row.lane_occupancy,
                            2
                        )}
                    </td>

                    <td>
                        ${number(
                            row.flow_rate,
                            2
                        )}
                    </td>

                    <td>
                        ${row.time_of_day ?? "-"}
                    </td>

                    <td>
                        ${number(
                            row.waiting_time,
                            2
                        )} sec
                    </td>

                </tr>

            `
            )
            .join("");
}


// ============================================================
// RECENT RECORDS
// ============================================================

function renderRecentRecords() {

    const container =
        $("recentRecords");

    if (!container) return;

    const rows =
        trafficData.slice(0, 6);

    if (!rows.length) {

        container.innerHTML =
            "No traffic records.";

        return;
    }

    container.innerHTML =
        rows
            .map(
                row => `

                <div class="mini-row">

                    <span>
                        #${row.id}
                    </span>

                    <span>
                        J${row.junction}
                    </span>

                    <span>
                        ${number(
                            row.vehicle_count
                        )} cars
                    </span>

                    <span>
                        ${number(
                            row.average_speed,
                            1
                        )}
                    </span>

                    <span>
                        ${number(
                            row.waiting_time,
                            1
                        )} sec
                    </span>

                </div>

            `
            )
            .join("");
}


// ============================================================
// INTERSECTIONS PAGE
// ============================================================

function renderIntersections() {

    const container =
        $("intersectionCards");

    if (!container) return;

    if (!junctionData.length) {

        container.innerHTML =
            `<div class="loading">
                No junction data.
             </div>`;

        return;
    }

    container.innerHTML =
        junctionData
            .map(
                item => `

                <div
                    class="intersection-card"
                >

                    <h3>
                        ${item.name}
                    </h3>

                    <div
                        class="road-grid"
                    >

                        ${roadBox(
                            "North",
                            item.north
                        )}

                        ${roadBox(
                            "South",
                            item.south
                        )}

                        ${roadBox(
                            "East",
                            item.east
                        )}

                        ${roadBox(
                            "West",
                            item.west
                        )}

                    </div>

                    <br>

                    <span>
                        Status:
                    </span>

                    <strong>
                        ${item.status}
                    </strong>

                </div>
            `
            )
            .join("");
}


function roadBox(
    direction,
    value
) {

    return `
        <div class="road-box">

            <span>
                ${direction}
            </span>

            <strong>
                ${number(value, 0)}
                cars
            </strong>

        </div>
    `;
}


// ============================================================
// OPTIMIZATION
// ============================================================

$("runOptimization")
    ?.addEventListener(
        "click",
        runOptimization
    );


$("dashboardOptimizeBtn")
    ?.addEventListener(
        "click",
        runDashboardOptimization
    );


async function runOptimization() {

    const junction =
        Number(
            $("optimizationJunction")
                .value
        );

    const output =
        $("optimizationOutput");

    output.innerHTML =
        "Running optimization...";

    try {

        const response =
            await fetch(
                "/api/optimize",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        junction
                    })
                }
            );

        const data =
            await response.json();

        if (
            data.status !==
            "SUCCESS"
        ) {

            throw new Error(
                data.message ||
                "Optimization failed"
            );
        }

        output.innerHTML = `

            <h3>
                ✓ Optimization Successful
            </h3>

            <br>

            <p>
                <strong>
                    Junction:
                </strong>
                ${data.junction}
            </p>

            <p>
                <strong>
                    Algorithm:
                </strong>
                ${data.algorithm}
            </p>

            <p>
                <strong>
                    Objective:
                </strong>
                ${data.objective}
            </p>

            <br>

            <div class="road-grid">

                ${roadBox(
                    "North Green",
                    data.signals.north
                )}

                ${roadBox(
                    "South Green",
                    data.signals.south
                )}

                ${roadBox(
                    "East Green",
                    data.signals.east
                )}

                ${roadBox(
                    "West Green",
                    data.signals.west
                )}

            </div>

            <br>

            <p>
                Improvement:
                <strong
                    class="green-text"
                >
                    ${data.improvement}%
                </strong>
            </p>
        `;

        updateSignalTable(data);

    } catch (error) {

        output.innerHTML =
            `<div class="error">
                ${error.message}
             </div>`;
    }
}


async function runDashboardOptimization() {

    try {

        const response =
            await fetch(
                "/api/optimize",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        junction:
                            selectedJunction
                    })
                }
            );

        const data =
            await response.json();

        if (
            data.status ===
            "SUCCESS"
        ) {

            updateSignalTable(
                data
            );

            $("cycleTime")
                .textContent =
                data.cycle_time;

            $("improvement")
                .textContent =
                data.improvement +
                "%";
        }

    } catch (error) {

        console.error(
            error
        );
    }
}


// ============================================================
// SIGNAL TABLE
// ============================================================

function updateSignalTable(
    data
) {

    const container =
        $("signalRows");

    if (!container) return;

    const directions = [
        ["North", "north"],
        ["South", "south"],
        ["East", "east"],
        ["West", "west"]
    ];

    container.innerHTML =
        directions
            .map(
                ([name, key]) => `

                <div class="signal-row">

                    <span>
                        ${name}
                    </span>

                    <strong>
                        ${data.signals[key]}
                        sec
                    </strong>

                    <span>
                        ${data.yellow}
                        sec
                    </span>

                    <span>
                        ${data.red[key]}
                        sec
                    </span>

                </div>
            `
            )
            .join("");
}


// ============================================================
// UPLOAD DATASET
// ============================================================

$("uploadButton")
    ?.addEventListener(
        "click",
        () => {

            $("datasetFile")
                .click();
        }
    );


$("datasetFile")
    ?.addEventListener(
        "change",
        uploadDataset
    );


async function uploadDataset() {

    const file =
        $("datasetFile")
            .files[0];

    if (!file) return;

    const formData =
        new FormData();

    formData.append(
        "file",
        file
    );

    const button =
        $("uploadButton");

    button.disabled =
        true;

    button.textContent =
        "Uploading...";

    try {

        const response =
            await fetch(
                "/api/upload-dataset",
                {
                    method: "POST",
                    body: formData
                }
            );

        const data =
            await response.json();

        if (
            data.status !==
            "success"
        ) {

            throw new Error(
                data.message
            );
        }

        alert(
            `Upload successful.\n\n` +
            `Inserted records: ${
                data.inserted
            }`
        );

        await loadAllData();

    } catch (error) {

        alert(
            "Upload failed:\n\n" +
            error.message
        );

    } finally {

        button.disabled =
            false;

        button.textContent =
            "⬆ Upload CSV";

        $("datasetFile")
            .value = "";
    }
}


// ============================================================
// SIMULATION
// ============================================================

$("startSimulation")
    ?.addEventListener(
        "click",
        startSimulation
    );


$("stopSimulation")
    ?.addEventListener(
        "click",
        stopSimulation
    );


function startSimulation() {

    stopSimulation();

    const area =
        $("simCars");

    if (!area) return;

    area.innerHTML = "";

    for (
        let i = 0;
        i < 15;
        i++
    ) {

        const car =
            document.createElement(
                "div"
            );

        car.className =
            "car";

        car.style.left =
            Math.random() *
            90 + "%";

        car.style.top =
            Math.random() *
            90 + "%";

        area.appendChild(
            car
        );
    }

    simulationTimer =
        setInterval(
            () => {

                document
                    .querySelectorAll(
                        ".car"
                    )
                    .forEach(
                        car => {

                            const x =
                                Math.random() *
                                90;

                            const y =
                                Math.random() *
                                90;

                            car.style.left =
                                x + "%";

                            car.style.top =
                                y + "%";
                        }
                    );

            },
            500
        );
}


function stopSimulation() {

    if (simulationTimer) {

        clearInterval(
            simulationTimer
        );

        simulationTimer =
            null;
    }
}


// ============================================================
// REPORTS
// ============================================================

function renderReports() {

    const container =
        $("reportTable");

    if (!container) return;

    if (!junctionData.length) {

        container.innerHTML =
            "No report data.";

        return;
    }

    container.innerHTML =
        junctionData
            .map(
                item => `

                <div
                    class="report-row"
                >

                    <strong>
                        ${item.name}
                    </strong>

                    <span>
                        ${number(
                            item.vehicles,
                            1
                        )} vehicles
                    </span>

                    <span>
                        ${number(
                            item.waiting,
                            1
                        )} sec waiting
                    </span>

                    <span>
                        ${number(
                            item.speed,
                            1
                        )} speed
                    </span>

                    <span>
                        ${item.status}
                    </span>

                </div>
            `
            )
            .join("");
}


// ============================================================
// INITIAL LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadAllData();

    }
);
