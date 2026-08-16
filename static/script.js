// ============================================================
// SMART TRAFFIC MANAGEMENT
// FINAL FRONTEND JAVASCRIPT
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
        return decimals ? "0.00" : "0";
    }

    return decimals
        ? n.toFixed(decimals)
        : Math.round(n).toString();
}


function formatNumber(value) {

    return Number(value || 0).toLocaleString("en-IN");
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


function showError(element, message) {

    if (!element) return;

    element.innerHTML = `
        <div class="error">
            ${escapeHTML(message)}
        </div>
    `;
}


// ============================================================
// NAVIGATION
// ============================================================

document.querySelectorAll(".nav-btn").forEach(button => {

    button.addEventListener("click", () => {

        const section = button.dataset.section;

        openSection(section);
    });

});


document.querySelectorAll(".small-btn[data-section]")
    .forEach(button => {

        button.addEventListener("click", () => {

            openSection(button.dataset.section);

        });

    });


function openSection(section) {

    document.querySelectorAll(".section")
        .forEach(element => {

            element.classList.remove("active-section");

        });


    const target = $(section);

    if (target) {

        target.classList.add("active-section");

    }


    document.querySelectorAll(".nav-btn")
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

    const now = new Date();

    if ($("clock")) {

        $("clock").textContent =
            now.toLocaleTimeString();

    }

}


setInterval(updateClock, 1000);

updateClock();


// ============================================================
// LOAD EVERYTHING
// ============================================================

async function loadAllData() {

    console.log("Loading Smart Traffic data...");

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
        "Traffic records loaded:",
        trafficData.length
    );
}


// ============================================================
// DATABASE TEST
// ============================================================

async function testDatabase() {

    try {

        const response =
            await fetch(
                "/api/test-db?cache=" + Date.now()
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
                <strong>✓ Connected successfully</strong><br>
                Database: ${escapeHTML(
                    data.database || "Aiven MySQL"
                )}<br>
                Records:
                ${formatNumber(data.total_records)}
            `;

        }

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

            $("settingsConnection").innerHTML = `
                <div class="error">
                    ✕ Database error<br>
                    ${escapeHTML(error.message)}
                </div>
            `;

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
                "/api/statistics?cache=" + Date.now()
            );


        const data =
            await response.json();


        if (data.status !== "success") {

            throw new Error(
                data.message ||
                "Statistics unavailable"
            );

        }


        if ($("totalIntersections")) {

            $("totalIntersections")
                .textContent =
                data.intersections;

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


        if ($("trafficStatus")) {

            $("trafficStatus")
                .textContent =
                data.traffic_status;


            $("trafficStatus").className =
                "status-text " +
                statusClass(data.traffic_status);

        }


        if ($("reportRecords")) {

            $("reportRecords")
                .textContent =
                formatNumber(data.total_records);

        }


        if ($("reportVehicles")) {

            $("reportVehicles")
                .textContent =
                formatNumber(data.vehicles);

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


// ============================================================
// LOAD ACTUAL DATASET
// ============================================================
//
// IMPORTANT:
//
// /api/traffic = junction summaries
//
// /api/dataset = ACTUAL traffic records
//
// We use /api/dataset here.
//
// ============================================================

async function loadTrafficData() {

    try {

        console.log(
            "Loading actual dataset..."
        );


        const response =
            await fetch(
                "/api/dataset?limit=10000&cache=" +
                Date.now()
            );


        if (!response.ok) {

            throw new Error(
                "Dataset API returned HTTP " +
                response.status
            );

        }


        const result =
            await response.json();


        if (result.status !== "success") {

            throw new Error(
                result.message ||
                "Dataset loading failed"
            );

        }


        if (!Array.isArray(result.data)) {

            throw new Error(
                "Dataset API did not return an array"
            );

        }


        trafficData = result.data;


        console.log(
            "Actual records loaded:",
            trafficData.length
        );


        renderRecentRecords();

        renderDataset();

        updateSelectedIntersection();

    }
    catch (error) {

        console.error(
            "Traffic dataset error:",
            error
        );


        trafficData = [];


        showError(
            $("filteredDatasetRows"),
            "Unable to load dataset: " +
            error.message
        );


        if ($("junctionRecordCount")) {

            $("junctionRecordCount")
                .textContent = "0";

        }

    }

}


// ============================================================
// LOAD JUNCTION SUMMARY
// ============================================================

async function loadJunctions() {

    try {

        const response =
            await fetch(
                "/api/junctions?cache=" +
                Date.now()
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
// DASHBOARD JUNCTION CARDS
// ============================================================

function renderJunctionCards() {

    const container =
        $("junctionCards");


    if (!container) return;


    if (!junctionData.length) {

        container.innerHTML = `
            <div class="loading">
                No junction data found.
            </div>
        `;

        return;

    }


    container.innerHTML =
        junctionData.map(item => {

            return `

                <div
                    class="junction-card ${
                        Number(item.id || item.junction) ===
                        Number(selectedJunction)
                            ? "selected"
                            : ""
                    }"
                    onclick="selectJunction(
                        ${Number(item.id || item.junction)}
                    )"
                >

                    <div
                        class="junction-card-header"
                    >

                        <h4>
                            ${escapeHTML(
                                item.name ||
                                `Junction ${
                                    item.id ||
                                    item.junction
                                }`
                            )}
                        </h4>

                        <span
                            class="badge ${
                                statusClass(item.status)
                            }"
                        >
                            ${escapeHTML(
                                item.status || "LOW"
                            )}
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
                                    item.average_vehicles ??
                                    item.vehicles ??
                                    0,
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
                                    item.waiting_time ??
                                    item.waiting ??
                                    0,
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
                                    item.average_speed ??
                                    item.speed ??
                                    0,
                                    1
                                )}
                            </strong>

                        </div>

                    </div>

                </div>

            `;

        }).join("");

}


// ============================================================
// SELECT JUNCTION
// ============================================================

function selectJunction(junction) {

    selectedJunction =
        Number(junction);


    if ($("dashboardJunction")) {

        $("dashboardJunction").value =
            selectedJunction;

    }


    if ($("optimizationJunction")) {

        $("optimizationJunction").value =
            selectedJunction;

    }


    if ($("simulationJunction")) {

        $("simulationJunction").value =
            selectedJunction;

    }


    if ($("datasetJunctionSelect")) {

        $("datasetJunctionSelect").value =
            String(selectedJunction);

    }


    renderJunctionCards();

    renderDataset();

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
// DATASET JUNCTION SELECT
// ============================================================

$("datasetJunctionSelect")
    ?.addEventListener(
        "change",
        function () {

            const value =
                this.value;


            if (
                value !== "all" &&
                value !== ""
            ) {

                selectedJunction =
                    Number(value);

            }


            renderDataset();

        }
    );


// ============================================================
// UPDATE INTERSECTION
// ============================================================
//
// Shows the latest actual record for selected junction.
//
// ============================================================

function updateSelectedIntersection() {

    if (!trafficData.length) {

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


    const records =
        trafficData.filter(row =>
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


    // Last database record for selected junction
    const latest =
        records[records.length - 1];


    setRoad(
        "northRoad",
        "NORTH",
        latest.north
    );


    setRoad(
        "southRoad",
        "SOUTH",
        latest.south
    );


    setRoad(
        "eastRoad",
        "EAST",
        latest.east
    );


    setRoad(
        "westRoad",
        "WEST",
        latest.west
    );


    // Update dashboard optimization
    runDashboardOptimization();

}


// ============================================================
// ROAD DISPLAY
// ============================================================

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
            ${number(value, 0)} cars
        </strong>
    `;

}


// ============================================================
// DATASET TABLE
// ============================================================

function renderDataset() {

    const tbody =
        $("filteredDatasetRows");


    if (!tbody) return;


    const filter =
        $("datasetJunctionSelect")
            ?.value || "all";


    let rows =
        trafficData;


    // Filter by selected junction
    if (filter !== "all") {

        rows =
            trafficData.filter(
                row =>
                    String(
                        row.junction
                    ) === String(filter)
            );

    }


    // Record count
    if ($("junctionRecordCount")) {

        $("junctionRecordCount")
            .textContent =
            formatNumber(rows.length);

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
                formatNumber(rows.length)
            } actual traffic records`;

    }


    if (!rows.length) {

        tbody.innerHTML = `
            <tr>

                <td
                    colspan="12"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >
                    No records found.
                </td>

            </tr>
        `;

        return;

    }


    // ========================================================
    // LIMIT VISIBLE ROWS
    // ========================================================
    //
    // Your database can contain 10,000 records.
    // We display the first 500 in the browser so the UI
    // remains fast.
    //
    // The record counter still shows the full count.
    //
    // ========================================================

    const visibleRows =
        rows.slice(0, 500);


    tbody.innerHTML =
        visibleRows.map(row => {

            return `

                <tr>

                    <td>
                        ${escapeHTML(row.id)}
                    </td>


                    <td>
                        Junction ${escapeHTML(
                            row.junction
                        )}
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
                        ${escapeHTML(
                            row.time_of_day ||
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

            `;

        }).join("");


    // Show message if more records exist
    if (rows.length > 500) {

        tbody.insertAdjacentHTML(
            "beforeend",
            `
            <tr>

                <td
                    colspan="12"
                    style="
                        text-align:center;
                        padding:18px;
                        opacity:.7;
                    "
                >
                    Showing first 500 of
                    ${formatNumber(rows.length)}
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
        trafficData.slice(-6).reverse();


    if (!rows.length) {

        container.innerHTML =
            "No traffic records.";

        return;

    }


    container.innerHTML =
        rows.map(row => {

            return `

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
                        )}
                    </span>


                    <span>
                        ${number(
                            row.waiting_time,
                            1
                        )} sec
                    </span>

                </div>

            `;

        }).join("");

}


// ============================================================
// INTERSECTIONS PAGE
// ============================================================

function renderIntersections() {

    const container =
        $("intersectionCards");


    if (!container) return;


    if (!junctionData.length) {

        container.innerHTML = `
            <div class="loading">
                No junction data.
            </div>
        `;

        return;

    }


    container.innerHTML =
        junctionData.map(item => {

            return `

                <div
                    class="intersection-card"
                >

                    <h3>
                        ${escapeHTML(
                            item.name ||
                            `Junction ${
                                item.id ||
                                item.junction
                            }`
                        )}
                    </h3>


                    <div class="road-grid">

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
                        ${escapeHTML(
                            item.status || "LOW"
                        )}
                    </strong>

                </div>

            `;

        }).join("");

}


// ============================================================
// ROAD BOX
// ============================================================

function roadBox(
    direction,
    value
) {

    return `

        <div class="road-box">

            <span>
                ${escapeHTML(direction)}
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


    if (!output) return;


    output.innerHTML = `
        <div class="loading">
            Running AI optimization...
        </div>
    `;


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

                    body:
                        JSON.stringify({
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


    }
    catch (error) {

        output.innerHTML = `
            <div class="error">
                ${escapeHTML(
                    error.message
                )}
            </div>
        `;

    }

}


// ============================================================
// DASHBOARD OPTIMIZATION
// ============================================================

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

                    body:
                        JSON.stringify({
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


// ============================================================
// SIGNAL TABLE
// ============================================================

function updateSignalTable(data) {

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
        directions.map(
            ([name, key]) => {

                return `

                    <div
                        class="signal-row"
                    >

                        <span>
                            ${name}
                        </span>


                        <strong>
                            ${number(
                                data.signals[key]
                            )}
                            sec
                        </strong>


                        <span>
                            ${number(
                                data.yellow
                            )}
                            sec
                        </span>


                        <span>
                            ${number(
                                data.red[key]
                            )}
                            sec
                        </span>

                    </div>

                `;

            }
        ).join("");

}


// ============================================================
// CSV UPLOAD
// ============================================================

$("uploadButton")
    ?.addEventListener(
        "click",
        () => {

            const fileInput =
                $("datasetFile");


            if (!fileInput) return;


            fileInput.click();

        }
    );


$("datasetFile")
    ?.addEventListener(
        "change",
        uploadDataset
    );


async function uploadDataset() {

    const input =
        $("datasetFile");


    if (!input) return;


    const file =
        input.files[0];


    if (!file) return;


    if (
        !file.name
            .toLowerCase()
            .endsWith(".csv")
    ) {

        alert(
            "Please select a CSV file."
        );

        input.value = "";

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

        button.disabled =
            true;

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
            data.status !==
            "success"
        ) {

            throw new Error(
                data.message ||
                "Upload failed"
            );

        }


        alert(
            "Dataset uploaded successfully!\n\n" +
            "Inserted records: " +
            data.inserted +
            "\n\n" +
            "Total records: " +
            data.total_records
        );


        // Reload actual database data
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

            button.disabled =
                false;

            button.textContent =
                "⬆ Upload CSV";

        }


        input.value = "";

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


    // Get selected junction records
    const records =
        trafficData.filter(
            row =>
                Number(row.junction) ===
                Number(
                    $("simulationJunction")
                        ?.value || 1
                )
        );


    let carCount = 15;


    if (records.length) {

        const latest =
            records[records.length - 1];


        carCount =
            Math.max(
                5,
                Math.min(
                    40,
                    Math.round(
                        Number(
                            latest.vehicle_count
                        ) / 3
                    )
                )
            );

    }


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
            Math.random() *
            90 +
            "%";


        car.style.top =
            Math.random() *
            90 +
            "%";


        area.appendChild(car);

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

                            car.style.left =
                                Math.random() *
                                90 +
                                "%";


                            car.style.top =
                                Math.random() *
                                90 +
                                "%";

                        }
                    );

            },
            700
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
        junctionData.map(item => {

            return `

                <div
                    class="report-row"
                >

                    <strong>
                        ${escapeHTML(
                            item.name ||
                            `Junction ${
                                item.id ||
                                item.junction
                            }`
                        )}
                    </strong>


                    <span>
                        ${number(
                            item.vehicles ??
                            item.average_vehicles ??
                            0,
                            1
                        )}
                        vehicles
                    </span>


                    <span>
                        ${number(
                            item.waiting_time ??
                            item.waiting ??
                            0,
                            1
                        )}
                        sec waiting
                    </span>


                    <span>
                        ${number(
                            item.average_speed ??
                            item.speed ??
                            0,
                            1
                        )}
                        speed
                    </span>


                    <span>
                        ${escapeHTML(
                            item.status ||
                            "LOW"
                        )}
                    </span>

                </div>

            `;

        }).join("");

}


// ============================================================
// DATASET REFRESH BUTTON SUPPORT
// ============================================================

window.refreshDataset = async function () {

    await loadTrafficData();

};


// ============================================================
// INITIAL LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Smart Traffic Management loaded."
        );


        loadAllData();

    }
);
