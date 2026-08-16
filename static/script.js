// ============================================================
// SMART TRAFFIC MANAGEMENT
// FINAL FRONTEND SCRIPT
// ============================================================

let trafficData = [];
let junctionData = [];
let selectedJunction = 1;
let simulationTimer = null;


// ============================================================
// BASIC HELPERS
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
        ? Number(n.toFixed(decimals))
        : Math.round(n);
}


function formatNumber(value) {

    const n = Number(value || 0);

    return n.toLocaleString("en-IN");
}


function statusClass(status) {

    return String(status || "LOW")
        .toLowerCase();
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function showTableError(message) {

    const tbody = $("filteredDatasetRows");

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td
                colspan="12"
                style="
                    text-align:center;
                    padding:35px;
                    color:#ff6b6b;
                "
            >
                ❌ ${escapeHTML(message)}
            </td>
        </tr>
    `;
}


// ============================================================
// NAVIGATION
// ============================================================

document.querySelectorAll(".nav-btn").forEach(button => {

    button.addEventListener("click", () => {

        openSection(button.dataset.section);

    });

});


document.querySelectorAll(".small-btn[data-section]")
    .forEach(button => {

        button.addEventListener("click", () => {

            openSection(button.dataset.section);

        });

    });


function openSection(section) {

    document
        .querySelectorAll(".section")
        .forEach(el => {

            el.classList.remove("active-section");

        });


    const target = $(section);

    if (target) {

        target.classList.add("active-section");

    }


    document
        .querySelectorAll(".nav-btn")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.section === section
            );

        });


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

    if ($("clock")) {

        $("clock").textContent =
            new Date().toLocaleTimeString();

    }

}


setInterval(updateClock, 1000);

updateClock();


// ============================================================
// DATABASE CONNECTION
// ============================================================

async function testDatabase() {

    try {

        const response = await fetch(
            "/api/test-db",
            {
                cache: "no-store"
            }
        );


        const data =
            await response.json();


        if (data.status !== "success") {

            throw new Error(
                data.message ||
                "Database connection failed"
            );

        }


        if ($("databaseMessage")) {

            $("databaseMessage").textContent =
                `Connected • ${formatNumber(
                    data.total_records
                )} records`;

        }


        if ($("settingsConnection")) {

            $("settingsConnection").innerHTML = `
                ✓ Connected successfully<br>
                Database: ${data.database || "Aiven MySQL"}<br>
                Records: ${formatNumber(
                    data.total_records
                )}
            `;

        }


        console.log(
            "Database connected:",
            data.total_records
        );

    }
    catch (error) {

        console.error(
            "Database error:",
            error
        );


        if ($("databaseMessage")) {

            $("databaseMessage").textContent =
                "Database connection failed";

        }


        if ($("settingsConnection")) {

            $("settingsConnection").innerHTML =
                `✕ Database error<br>
                 ${escapeHTML(error.message)}`;

        }

    }

}


// ============================================================
// STATISTICS
// ============================================================

async function loadStatistics() {

    try {

        const response = await fetch(
            "/api/statistics",
            {
                cache: "no-store"
            }
        );


        const data =
            await response.json();


        if (data.status !== "success") {

            throw new Error(
                data.message ||
                "Statistics failed"
            );

        }


        if ($("totalIntersections")) {

            $("totalIntersections")
                .textContent =
                data.intersections ?? 4;

        }


        if ($("totalVehicles")) {

            $("totalVehicles")
                .textContent =
                formatNumber(data.vehicles);

        }


        if ($("avgWaiting")) {

            $("avgWaiting")
                .textContent =
                number(data.waiting, 2);

        }


        const status =
            data.traffic_status ||
            calculateOverallStatus(
                data.waiting
            );


        if ($("trafficStatus")) {

            $("trafficStatus")
                .textContent = status;

            $("trafficStatus")
                .className =
                "status-text " +
                statusClass(status);

        }


        if ($("reportRecords")) {

            $("reportRecords")
                .textContent =
                formatNumber(
                    data.total_records ??
                    data.records
                );

        }


        if ($("reportVehicles")) {

            $("reportVehicles")
                .textContent =
                formatNumber(
                    data.vehicles
                );

        }


        if ($("reportWaiting")) {

            $("reportWaiting")
                .textContent =
                number(data.waiting, 2) +
                " sec";

        }


        if ($("reportSpeed")) {

            $("reportSpeed")
                .textContent =
                number(data.speed, 2);

        }

    }
    catch (error) {

        console.error(
            "Statistics error:",
            error
        );

    }

}


function calculateOverallStatus(waiting) {

    const w =
        Number(waiting || 0);


    if (w < 20) {

        return "LOW";

    }


    if (w < 40) {

        return "MEDIUM";

    }


    return "HIGH";

}


// ============================================================
// LOAD ACTUAL DATASET
//
// IMPORTANT:
//
// DO NOT use:
//
// /api/dataset
//
// That endpoint is a summary.
//
// Actual records are obtained from:
//
// /api/traffic-by-junction
//
// Backend maximum = 500 records/request.
//
// We therefore load 5 pages for each junction.
//
// 4 junctions × 2500 = 10,000 records.
// ============================================================

async function loadTrafficData() {

    try {

        console.log(
            "Loading actual traffic dataset..."
        );


        const allRecords = [];


        // Each junction contains 2500 records.
        // Backend allows max 500 per request.

        const recordsPerJunction = 2500;
        const pageSize = 500;

        const requests = [];


        for (
            let junction = 1;
            junction <= 4;
            junction++
        ) {

            const totalPages =
                Math.ceil(
                    recordsPerJunction /
                    pageSize
                );


            for (
                let page = 1;
                page <= totalPages;
                page++
            ) {

                requests.push(

                    fetch(
                        `/api/traffic-by-junction` +
                        `?junction=${junction}` +
                        `&page=${page}` +
                        `&limit=${pageSize}`,
                        {
                            cache: "no-store"
                        }
                    )
                    .then(async response => {

                        if (!response.ok) {

                            throw new Error(
                                `Junction ${junction}, ` +
                                `page ${page}: ` +
                                `HTTP ${response.status}`
                            );

                        }


                        return response.json();

                    })

                );

            }

        }


        const results =
            await Promise.all(requests);


        results.forEach(result => {

            if (
                result.status !==
                "success"
            ) {

                throw new Error(
                    result.message ||
                    "Dataset request failed"
                );

            }


            if (
                Array.isArray(
                    result.records
                )
            ) {

                allRecords.push(
                    ...result.records
                );

            }

        });


        // Sort by database ID.

        allRecords.sort(
            (a, b) =>
                Number(a.id || 0) -
                Number(b.id || 0)
        );


        trafficData =
            allRecords;


        console.log(
            "================================"
        );

        console.log(
            "DATASET LOADED SUCCESSFULLY"
        );

        console.log(
            "Total records:",
            trafficData.length
        );

        console.log(
            "Junction 1:",
            trafficData.filter(
                r => Number(r.junction) === 1
            ).length
        );

        console.log(
            "Junction 2:",
            trafficData.filter(
                r => Number(r.junction) === 2
            ).length
        );

        console.log(
            "Junction 3:",
            trafficData.filter(
                r => Number(r.junction) === 3
            ).length
        );

        console.log(
            "Junction 4:",
            trafficData.filter(
                r => Number(r.junction) === 4
            ).length
        );

        console.log(
            "================================"
        );


        renderRecentRecords();

        renderDataset();

        updateSelectedIntersection();

    }
    catch (error) {

        console.error(
            "DATASET ERROR:",
            error
        );


        trafficData = [];


        showTableError(
            "Unable to load dataset: " +
            error.message
        );


        if ($("junctionRecordCount")) {

            $("junctionRecordCount")
                .textContent = "0";

        }


        if ($("datasetSubtitle")) {

            $("datasetSubtitle")
                .textContent =
                "Unable to load traffic records";

        }

    }

}


// ============================================================
// JUNCTION SUMMARIES
// ============================================================

async function loadJunctions() {

    try {

        const response = await fetch(
            "/api/junctions",
            {
                cache: "no-store"
            }
        );


        const data =
            await response.json();


        if (!Array.isArray(data)) {

            throw new Error(
                data.message ||
                "Invalid junction data"
            );

        }


        junctionData = data;


        renderJunctionCards();

        renderIntersections();

        renderReports();

    }
    catch (error) {

        console.error(
            "Junction error:",
            error
        );


        junctionData = [];

        renderJunctionCards();

    }

}


// ============================================================
// JUNCTION CARDS
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
        junctionData.map(item => {

            const id =
                Number(
                    item.id ||
                    item.junction
                );


            return `

                <div
                    class="junction-card ${
                        id === selectedJunction
                            ? "selected"
                            : ""
                    }"
                    onclick="selectJunction(${id})"
                >

                    <div
                        class="junction-card-header"
                    >

                        <h4>
                            ${
                                escapeHTML(
                                    item.name ||
                                    `Junction ${id}`
                                )
                            }
                        </h4>

                        <span
                            class="badge ${
                                statusClass(
                                    item.status
                                )
                            }"
                        >
                            ${
                                escapeHTML(
                                    item.status ||
                                    "LOW"
                                )
                            }
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
                                ${
                                    number(
                                        item.average_vehicles ??
                                        item.vehicles,
                                        1
                                    )
                                }
                            </strong>

                        </div>


                        <div>

                            <span>
                                Waiting
                            </span>

                            <strong>
                                ${
                                    number(
                                        item.waiting_time ??
                                        item.waiting,
                                        1
                                    )
                                }s
                            </strong>

                        </div>


                        <div>

                            <span>
                                Speed
                            </span>

                            <strong>
                                ${
                                    number(
                                        item.average_speed ??
                                        item.speed,
                                        1
                                    )
                                }
                            </strong>

                        </div>

                    </div>

                </div>

            `;

        }).join("");

}


// ============================================================
// JUNCTION SELECTION
// ============================================================

function selectJunction(junction) {

    selectedJunction =
        Number(junction);


    if ($("dashboardJunction")) {

        $("dashboardJunction")
            .value =
            selectedJunction;

    }


    if ($("optimizationJunction")) {

        $("optimizationJunction")
            .value =
            selectedJunction;

    }


    if ($("simulationJunction")) {

        $("simulationJunction")
            .value =
            selectedJunction;

    }


    renderJunctionCards();

    updateSelectedIntersection();


    if ($("datasetJunctionSelect")) {

        $("datasetJunctionSelect")
            .value =
            String(selectedJunction);

        renderDataset();

    }

}


// Dashboard selector

$("dashboardJunction")
    ?.addEventListener(
        "change",
        function () {

            selectJunction(
                this.value
            );

        }
    );


// Dataset selector

$("datasetJunctionSelect")
    ?.addEventListener(
        "change",
        function () {

            const value =
                this.value;


            // "all" means don't
            // change dashboard selection.

            if (value === "all") {

                renderDataset();

                return;

            }


            selectedJunction =
                Number(value);


            if ($("dashboardJunction")) {

                $("dashboardJunction")
                    .value =
                    selectedJunction;

            }


            if ($("optimizationJunction")) {

                $("optimizationJunction")
                    .value =
                    selectedJunction;

            }


            if ($("simulationJunction")) {

                $("simulationJunction")
                    .value =
                    selectedJunction;

            }


            renderJunctionCards();

            updateSelectedIntersection();

            renderDataset();

        }
    );


// ============================================================
// LIVE INTERSECTION
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


    const latest =
        records.reduce(
            (a, b) =>
                Number(b.id || 0) >
                Number(a.id || 0)
                    ? b
                    : a
        );


    /*
        Your current backend record endpoint
        returns vehicle_count, not separate
        north/south/east/west fields.

        Therefore we display the vehicle
        count for the live intersection
        instead of fake directional values.
    */

    const vehicles =
        Number(
            latest.vehicle_count || 0
        );


    setRoad(
        "northRoad",
        "NORTH",
        vehicles
    );

    setRoad(
        "southRoad",
        "SOUTH",
        vehicles
    );

    setRoad(
        "eastRoad",
        "EAST",
        vehicles
    );

    setRoad(
        "westRoad",
        "WEST",
        vehicles
    );

}


function setRoad(
    id,
    direction,
    value
) {

    const element =
        $(id);


    if (!element) return;


    element.innerHTML = `

        ${direction}

        <strong>
            ${formatNumber(
                number(value)
            )} cars
        </strong>

    `;

}


// ============================================================
// DATASET PAGE
// ============================================================

function renderDataset() {

    const tbody =
        $("filteredDatasetRows");


    if (!tbody) return;


    const filter =
        $("datasetJunctionSelect")
            ?.value ||
        "all";


    let rows =
        trafficData;


    if (filter !== "all") {

        rows =
            trafficData.filter(
                row =>
                    String(
                        row.junction
                    ) ===
                    String(filter)
            );

    }


    // Record count

    if ($("junctionRecordCount")) {

        $("junctionRecordCount")
            .textContent =
            formatNumber(
                rows.length
            );

    }


    // Title

    if ($("datasetTitle")) {

        $("datasetTitle")
            .textContent =
            filter === "all"
                ? "All Junctions"
                : `Junction ${filter}`;

    }


    // Subtitle

    if ($("datasetSubtitle")) {

        $("datasetSubtitle")
            .textContent =
            `Showing ${
                formatNumber(
                    rows.length
                )
            } actual traffic records`;

    }


    // Empty dataset

    if (!rows.length) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="12"
                    style="
                        text-align:center;
                        padding:35px;
                    "
                >
                    No records found.
                </td>

            </tr>

        `;

        return;

    }


    /*
        We don't insert 10,000 rows into the
        browser at once.

        Only 200 rows are displayed.
        The record counter still shows
        the REAL number of records.
    */

    const visibleRows =
        rows.slice(0, 200);


    tbody.innerHTML =
        visibleRows.map(row => `

            <tr>

                <td>
                    ${escapeHTML(
                        row.id ?? "-"
                    )}
                </td>


                <td>
                    Junction ${
                        escapeHTML(
                            row.junction ?? "-"
                        )
                    }
                </td>


                <td>
                    ${number(
                        row.north ??
                        row.vehicle_count
                    )}
                </td>


                <td>
                    ${number(
                        row.south ??
                        row.vehicle_count
                    )}
                </td>


                <td>
                    ${number(
                        row.east ??
                        row.vehicle_count
                    )}
                </td>


                <td>
                    ${number(
                        row.west ??
                        row.vehicle_count
                    )}
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
                    ${escapeHTML(
                        row.time_of_day ??
                        "-"
                    )}
                </td>


                <td>
                    ${number(
                        row.waiting_time,
                        2
                    )} sec
                </td>

            </tr>

        `).join("");


    // Inform user that only first 200
    // are visually displayed.

    if (
        rows.length >
        visibleRows.length
    ) {

        tbody.insertAdjacentHTML(
            "beforeend",
            `

                <tr>

                    <td
                        colspan="12"
                        style="
                            text-align:center;
                            padding:18px;
                            color:#7fa4c8;
                        "
                    >

                        Showing first
                        <strong>
                            ${
                                formatNumber(
                                    visibleRows.length
                                )
                            }
                        </strong>

                        of

                        <strong>
                            ${
                                formatNumber(
                                    rows.length
                                )
                            }
                        </strong>

                        records.

                    </td>

                </tr>

            `
        );

    }

}


// ============================================================
// RECENT RECORDS
// ============================================================

function renderRecentRecords() {

    const container =
        $("recentRecords");


    if (!container) return;


    const rows =
        trafficData.slice(
            0,
            6
        );


    if (!rows.length) {

        container.innerHTML =
            "No traffic records.";

        return;

    }


    container.innerHTML =
        rows.map(row => `

            <div class="mini-row">

                <span>
                    #${escapeHTML(row.id)}
                </span>

                <span>
                    J${escapeHTML(
                        row.junction
                    )}
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
                    )} km/h
                </span>

                <span>
                    ${number(
                        row.waiting_time,
                        1
                    )} sec
                </span>

            </div>

        `).join("");

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
        junctionData.map(item => `

            <div class="intersection-card">

                <h3>
                    ${
                        escapeHTML(
                            item.name ||
                            `Junction ${item.id}`
                        )
                    }
                </h3>


                <div class="road-grid">

                    ${
                        roadBox(
                            "North",
                            item.north
                        )
                    }

                    ${
                        roadBox(
                            "South",
                            item.south
                        )
                    }

                    ${
                        roadBox(
                            "East",
                            item.east
                        )
                    }

                    ${
                        roadBox(
                            "West",
                            item.west
                        )
                    }

                </div>


                <br>

                <span>
                    Status:
                </span>

                <strong>
                    ${
                        escapeHTML(
                            item.status ||
                            "LOW"
                        )
                    }
                </strong>

            </div>

        `).join("");

}


function roadBox(
    direction,
    value
) {

    return `

        <div class="road-box">

            <span>
                ${escapeHTML(
                    direction
                )}
            </span>

            <strong>
                ${formatNumber(
                    number(value)
                )} cars
            </strong>

        </div>

    `;

}


// ============================================================
// AI OPTIMIZATION
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
                ?.value ||
            selectedJunction
        );


    const output =
        $("optimizationOutput");


    if (output) {

        output.innerHTML =
            "Running optimization...";

    }


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


        if (output) {

            output.innerHTML = `

                <h3>
                    ✓ Optimization Successful
                </h3>

                <br>

                <p>
                    <strong>
                        Junction:
                    </strong>

                    ${escapeHTML(
                        data.junction
                    )}
                </p>

                <p>
                    <strong>
                        Algorithm:
                    </strong>

                    ${escapeHTML(
                        data.algorithm
                    )}
                </p>

                <p>
                    <strong>
                        Objective:
                    </strong>

                    ${escapeHTML(
                        data.objective
                    )}
                </p>

                <br>

                <div class="road-grid">

                    ${
                        roadBox(
                            "North Green",
                            data.signals?.north
                        )
                    }

                    ${
                        roadBox(
                            "South Green",
                            data.signals?.south
                        )
                    }

                    ${
                        roadBox(
                            "East Green",
                            data.signals?.east
                        )
                    }

                    ${
                        roadBox(
                            "West Green",
                            data.signals?.west
                        )
                    }

                </div>

                <br>

                <p>

                    Improvement:

                    <strong
                        class="green-text"
                    >
                        ${escapeHTML(
                            data.improvement
                        )}%

                    </strong>

                </p>

            `;

        }


        updateSignalTable(data);

    }
    catch (error) {

        if (output) {

            output.innerHTML =
                `<div class="error">
                    ${escapeHTML(
                        error.message
                    )}
                 </div>`;

        }

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


            if ($("cycleTime")) {

                $("cycleTime")
                    .textContent =
                    data.cycle_time;

            }


            if ($("improvement")) {

                $("improvement")
                    .textContent =
                    data.improvement +
                    "%";

            }

        }

    }
    catch (error) {

        console.error(
            "Optimization error:",
            error
        );

    }

}


function updateSignalTable(data) {

    const container =
        $("signalRows");


    if (
        !container ||
        !data.signals
    ) {

        return;

    }


    const directions = [

        ["North", "north"],

        ["South", "south"],

        ["East", "east"],

        ["West", "west"]

    ];


    container.innerHTML =
        directions.map(
            ([name, key]) => `

                <div
                    class="signal-row"
                >

                    <span>
                        ${name}
                    </span>

                    <strong>
                        ${
                            data.signals[key]
                        } sec
                    </strong>

                    <span>
                        ${
                            data.yellow ??
                            5
                        } sec
                    </span>

                    <span>
                        ${
                            data.red?.[key] ??
                            "-"
                        } sec
                    </span>

                </div>

            `
        ).join("");

}


// ============================================================
// CSV UPLOAD
// ============================================================

$("uploadButton")
    ?.addEventListener(
        "click",
        () => {

            $("datasetFile")?.click();

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
            ?.files[0];


    if (!file) return;


    if (
        !file.name
            .toLowerCase()
            .endsWith(".csv")
    ) {

        alert(
            "Please select a CSV file."
        );

        return;

    }


    const formData =
        new FormData();


    formData.append(
        "file",
        file
    );


    const button =
        $("uploadButton");


    if (button) {

        button.disabled = true;

        button.textContent =
            "Uploading...";

    }


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
            !response.ok ||
            data.status !==
            "success"
        ) {

            throw new Error(
                data.message ||
                "Upload failed"
            );

        }


        alert(
            "Upload successful!\n\n" +
            "Inserted records: " +
            data.inserted +
            "\n" +
            "Total records: " +
            data.total_records
        );


        // Reload database data.

        await loadAllData();

    }
    catch (error) {

        console.error(
            "Upload error:",
            error
        );


        alert(
            "Upload failed:\n\n" +
            error.message
        );

    }
    finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "⬆ Upload CSV";

        }


        if ($("datasetFile")) {

            $("datasetFile").value = "";

        }

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


    const records =
        trafficData.filter(
            row =>
                Number(row.junction) ===
                selectedJunction
        );


    const latest =
        records.length
            ? records.reduce(
                (a, b) =>
                    Number(
                        b.id || 0
                    ) >
                    Number(
                        a.id || 0
                    )
                        ? b
                        : a
            )
            : null;


    const total =
        latest
            ? Number(
                latest.vehicle_count ||
                15
            )
            : 15;


    const carCount =
        Math.max(
            5,
            Math.min(
                40,
                Math.round(
                    total / 3
                )
            )
        );


    for (
        let i = 0;
        i < carCount;
        i++
    ) {

        const car =
            document.createElement(
                "div"
            );


        car.className =
            "car";


        car.style.left =
            Math.random() * 90 +
            "%";


        car.style.top =
            Math.random() * 90 +
            "%";


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
                    .forEach(car => {

                        car.style.left =
                            Math.random() *
                            90 +
                            "%";


                        car.style.top =
                            Math.random() *
                            90 +
                            "%";

                    });

            },
            700
        );

}


function stopSimulation() {

    if (simulationTimer) {

        clearInterval(
            simulationTimer
        );

        simulationTimer = null;

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
        junctionData.map(item => `

            <div
                class="report-row"
            >

                <strong>
                    ${
                        escapeHTML(
                            item.name ||
                            `Junction ${item.id}`
                        )
                    }
                </strong>

                <span>
                    ${
                        number(
                            item.vehicles,
                            1
                        )
                    }
                    vehicles
                </span>

                <span>
                    ${
                        number(
                            item.waiting_time ??
                            item.waiting,
                            1
                        )
                    }
                    sec waiting
                </span>

                <span>
                    ${
                        number(
                            item.average_speed ??
                            item.speed,
                            1
                        )
                    }
                    km/h
                </span>

                <span>
                    ${
                        escapeHTML(
                            item.status ||
                            "LOW"
                        )
                    }
                </span>

            </div>

        `).join("");

}


// ============================================================
// LOAD EVERYTHING
// ============================================================

async function loadAllData() {

    console.log(
        "Starting Smart Traffic Management..."
    );


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


    console.log(
        "Smart Traffic Management loaded."
    );

}


// ============================================================
// START APPLICATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadAllData();

    }
);
