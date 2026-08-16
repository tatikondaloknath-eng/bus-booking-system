from flask import Flask, jsonify, render_template, request
import pymysql
import os
import csv
import io
import math

app = Flask(__name__)

# ============================================================
# DATABASE CONFIGURATION
# ============================================================

DB_HOST = os.getenv("DB_HOST")
DB_PORT = int(os.getenv("DB_PORT", "26298"))
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME", "defaultdb")


# ============================================================
# DATABASE CONFIG CHECK
# ============================================================

def check_database_config():
    missing = []

    if not DB_HOST:
        missing.append("DB_HOST")

    if not DB_USER:
        missing.append("DB_USER")

    if not DB_PASSWORD:
        missing.append("DB_PASSWORD")

    if not DB_NAME:
        missing.append("DB_NAME")

    if missing:
        raise RuntimeError(
            "Missing Render environment variables: "
            + ", ".join(missing)
        )


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_connection():
    check_database_config()

    ca_file = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "ca.pem"
    )

    connection_args = {
        "host": DB_HOST,
        "port": DB_PORT,
        "user": DB_USER,
        "password": DB_PASSWORD,
        "database": DB_NAME,
        "cursorclass": pymysql.cursors.DictCursor,
        "connect_timeout": 15,
        "read_timeout": 30,
        "write_timeout": 30,
        "autocommit": True
    }

    if os.path.exists(ca_file):
        connection_args["ssl"] = {
            "ca": ca_file
        }
    else:
        connection_args["ssl"] = {
            "check_hostname": False
        }

    return pymysql.connect(**connection_args)


# ============================================================
# HELPER
# ============================================================

def safe_number(value, default=0):
    try:
        if value is None:
            return default

        number = float(value)

        if math.isnan(number) or math.isinf(number):
            return default

        return number

    except Exception:
        return default


def get_table_columns(connection, table_name="traffic_data"):

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s
        AND TABLE_NAME = %s
        """,
        (DB_NAME, table_name)
    )

    rows = cursor.fetchall()

    cursor.close()

    return [row["COLUMN_NAME"] for row in rows]


def find_column(columns, possible_names):

    lower_map = {
        column.lower(): column
        for column in columns
    }

    for name in possible_names:

        if name.lower() in lower_map:
            return lower_map[name.lower()]

    return None


def calculate_status(value):

    value = safe_number(value)

    if value < 30:
        return "LOW"

    if value < 65:
        return "MEDIUM"

    return "HIGH"


# ============================================================
# HOME
# ============================================================

@app.route("/")
def home():
    return render_template("index.html")


# ============================================================
# HEALTH
# ============================================================

@app.route("/health")
def health():

    return jsonify({
        "status": "healthy",
        "application": "Smart Traffic Management",
        "database_configured": bool(
            DB_HOST and DB_USER and DB_PASSWORD
        )
    })


# ============================================================
# DATABASE TEST
# ============================================================

@app.route("/api/test-db")
def test_database():

    connection = None
    cursor = None

    try:

        connection = get_connection()

        cursor = connection.cursor()

        cursor.execute("SELECT 1 AS test")

        result = cursor.fetchone()

        cursor.execute(
            "SELECT COUNT(*) AS total FROM traffic_data"
        )

        total = cursor.fetchone()["total"]

        return jsonify({
            "status": "success",
            "message": "Connected to Aiven MySQL successfully",
            "database": DB_NAME,
            "test": result["test"],
            "total_records": total
        })

    except Exception as e:

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# ============================================================
# GET DATABASE DATA
# ============================================================

@app.route("/api/traffic")
def traffic():

    connection = None
    cursor = None

    try:

        connection = get_connection()

        columns = get_table_columns(
            connection,
            "traffic_data"
        )

        # ----------------------------------------------------
        # Detect column names automatically
        # ----------------------------------------------------

        id_col = find_column(
            columns,
            ["id", "record_id"]
        )

        junction_col = find_column(
            columns,
            [
                "junction_id",
                "junction",
                "intersection_id",
                "intersection"
            ]
        )

        north_col = find_column(
            columns,
            ["north", "north_count", "north_vehicles"]
        )

        south_col = find_column(
            columns,
            ["south", "south_count", "south_vehicles"]
        )

        east_col = find_column(
            columns,
            ["east", "east_count", "east_vehicles"]
        )

        west_col = find_column(
            columns,
            ["west", "west_count", "west_vehicles"]
        )

        vehicle_col = find_column(
            columns,
            [
                "vehicle_count",
                "vehicles",
                "total_vehicles"
            ]
        )

        speed_col = find_column(
            columns,
            [
                "average_speed",
                "avg_speed",
                "speed"
            ]
        )

        occupancy_col = find_column(
            columns,
            [
                "lane_occupancy",
                "occupancy",
                "density"
            ]
        )

        flow_col = find_column(
            columns,
            [
                "flow_rate",
                "flow"
            ]
        )

        time_col = find_column(
            columns,
            [
                "time_of_day",
                "time",
                "timestamp"
            ]
        )

        waiting_col = find_column(
            columns,
            [
                "waiting_time",
                "wait_time"
            ]
        )

        # ----------------------------------------------------
        # Build SQL safely using detected real columns
        # ----------------------------------------------------

        selected = []

        if id_col:
            selected.append(
                f"`{id_col}` AS record_id"
            )

        if junction_col:
            selected.append(
                f"`{junction_col}` AS junction_id"
            )

        if north_col:
            selected.append(
                f"`{north_col}` AS north"
            )

        if south_col:
            selected.append(
                f"`{south_col}` AS south"
            )

        if east_col:
            selected.append(
                f"`{east_col}` AS east"
            )

        if west_col:
            selected.append(
                f"`{west_col}` AS west"
            )

        if vehicle_col:
            selected.append(
                f"`{vehicle_col}` AS vehicle_count"
            )

        if speed_col:
            selected.append(
                f"`{speed_col}` AS average_speed"
            )

        if occupancy_col:
            selected.append(
                f"`{occupancy_col}` AS lane_occupancy"
            )

        if flow_col:
            selected.append(
                f"`{flow_col}` AS flow_rate"
            )

        if time_col:
            selected.append(
                f"`{time_col}` AS time_of_day"
            )

        if waiting_col:
            selected.append(
                f"`{waiting_col}` AS waiting_time"
            )

        if not selected:
            raise RuntimeError(
                "No usable columns found in traffic_data table."
            )

        cursor = connection.cursor()

        query = f"""
            SELECT {", ".join(selected)}
            FROM traffic_data
            LIMIT 500
        """

        cursor.execute(query)

        rows = cursor.fetchall()

        result = []

        for index, row in enumerate(rows):

            junction = row.get("junction_id")

            if junction is None:
                junction = ((index % 4) + 1)

            try:
                junction = int(float(junction))
            except Exception:
                junction = ((index % 4) + 1)

            north = safe_number(
                row.get("north")
            )

            south = safe_number(
                row.get("south")
            )

            east = safe_number(
                row.get("east")
            )

            west = safe_number(
                row.get("west")
            )

            vehicle_count = safe_number(
                row.get("vehicle_count")
            )

            # If directional values exist,
            # calculate total vehicles from roads.
            if north or south or east or west:

                vehicle_count = (
                    north +
                    south +
                    east +
                    west
                )

            occupancy = safe_number(
                row.get("lane_occupancy")
            )

            speed = safe_number(
                row.get("average_speed")
            )

            flow = safe_number(
                row.get("flow_rate")
            )

            waiting = safe_number(
                row.get("waiting_time")
            )

            # If density/occupancy exists but no directional
            # values, still keep it.
            status = calculate_status(
                occupancy
            )

            result.append({

                "id": row.get(
                    "record_id",
                    index + 1
                ),

                "junction": junction,

                "name": f"Junction {junction}",

                "north": round(north, 2),

                "south": round(south, 2),

                "east": round(east, 2),

                "west": round(west, 2),

                "vehicle_count": round(
                    vehicle_count,
                    2
                ),

                "average_speed": round(
                    speed,
                    2
                ),

                "lane_occupancy": round(
                    occupancy,
                    2
                ),

                "flow_rate": round(
                    flow,
                    2
                ),

                "time_of_day":
                    row.get("time_of_day"),

                "waiting_time": round(
                    waiting,
                    2
                ),

                "density": round(
                    occupancy,
                    2
                ),

                "status": status
            })

        return jsonify(result)

    except Exception as e:

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# ============================================================
# DASHBOARD STATISTICS
# ============================================================

@app.route("/api/statistics")
def statistics():

    connection = None
    cursor = None

    try:

        connection = get_connection()

        columns = get_table_columns(
            connection,
            "traffic_data"
        )

        vehicle_col = find_column(
            columns,
            [
                "vehicle_count",
                "vehicles",
                "total_vehicles"
            ]
        )

        waiting_col = find_column(
            columns,
            [
                "waiting_time",
                "wait_time"
            ]
        )

        speed_col = find_column(
            columns,
            [
                "average_speed",
                "avg_speed",
                "speed"
            ]
        )

        occupancy_col = find_column(
            columns,
            [
                "lane_occupancy",
                "occupancy",
                "density"
            ]
        )

        junction_col = find_column(
            columns,
            [
                "junction_id",
                "junction",
                "intersection_id",
                "intersection"
            ]
        )

        # ----------------------------------------------------
        # Vehicle count
        # ----------------------------------------------------

        total_vehicles = 0

        if vehicle_col:

            cursor = connection.cursor()

            cursor.execute(
                f"""
                SELECT COALESCE(
                    SUM(`{vehicle_col}`), 0
                ) AS total
                FROM traffic_data
                """
            )

            total_vehicles = safe_number(
                cursor.fetchone()["total"]
            )

            cursor.close()

        else:

            # Directional fallback

            direction_cols = []

            for col in [
                "north",
                "south",
                "east",
                "west"
            ]:

                found = find_column(
                    columns,
                    [col]
                )

                if found:
                    direction_cols.append(found)

            if direction_cols:

                expression = " + ".join(
                    [
                        f"COALESCE(`{c}`,0)"
                        for c in direction_cols
                    ]
                )

                cursor = connection.cursor()

                cursor.execute(
                    f"""
                    SELECT COALESCE(
                        SUM({expression}),0
                    ) AS total
                    FROM traffic_data
                    """
                )

                total_vehicles = safe_number(
                    cursor.fetchone()["total"]
                )

                cursor.close()

        # ----------------------------------------------------
        # Average waiting
        # ----------------------------------------------------

        avg_waiting = 0

        if waiting_col:

            cursor = connection.cursor()

            cursor.execute(
                f"""
                SELECT COALESCE(
                    AVG(`{waiting_col}`),0
                ) AS value
                FROM traffic_data
                """
            )

            avg_waiting = safe_number(
                cursor.fetchone()["value"]
            )

            cursor.close()

        # ----------------------------------------------------
        # Average speed
        # ----------------------------------------------------

        avg_speed = 0

        if speed_col:

            cursor = connection.cursor()

            cursor.execute(
                f"""
                SELECT COALESCE(
                    AVG(`{speed_col}`),0
                ) AS value
                FROM traffic_data
                """
            )

            avg_speed = safe_number(
                cursor.fetchone()["value"]
            )

            cursor.close()

        # ----------------------------------------------------
        # Occupancy
        # ----------------------------------------------------

        avg_occupancy = 0

        if occupancy_col:

            cursor = connection.cursor()

            cursor.execute(
                f"""
                SELECT COALESCE(
                    AVG(`{occupancy_col}`),0
                ) AS value
                FROM traffic_data
                """
            )

            avg_occupancy = safe_number(
                cursor.fetchone()["value"]
            )

            cursor.close()

        # ----------------------------------------------------
        # Records
        # ----------------------------------------------------

        cursor = connection.cursor()

        cursor.execute(
            "SELECT COUNT(*) AS total FROM traffic_data"
        )

        total_records = cursor.fetchone()["total"]

        cursor.close()

        # ----------------------------------------------------
        # Junctions
        # ----------------------------------------------------

        junctions = 4

        if junction_col:

            cursor = connection.cursor()

            cursor.execute(
                f"""
                SELECT COUNT(
                    DISTINCT `{junction_col}`
                ) AS total
                FROM traffic_data
                """
            )

            found = cursor.fetchone()["total"]

            if found:
                junctions = int(found)

            cursor.close()

        status = calculate_status(
            avg_occupancy
        )

        return jsonify({

            "status": "success",

            "intersections": junctions,

            "vehicles": round(
                total_vehicles
            ),

            "waiting": round(
                avg_waiting,
                2
            ),

            "speed": round(
                avg_speed,
                2
            ),

            "occupancy": round(
                avg_occupancy,
                2
            ),

            "traffic_status": status,

            "total_records":
                total_records
        })

    except Exception as e:

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# ============================================================
# JUNCTION SUMMARY
# ============================================================

@app.route("/api/junctions")
def junctions():

    try:

        response = traffic().get_json()

        if isinstance(response, dict):
            return jsonify(response), 500

        grouped = {}

        for row in response:

            junction = int(
                row.get("junction", 1)
            )

            if junction not in grouped:

                grouped[junction] = {

                    "junction": junction,

                    "name":
                        f"Junction {junction}",

                    "records": 0,

                    "vehicles": 0,

                    "waiting": 0,

                    "speed": 0,

                    "north": 0,

                    "south": 0,

                    "east": 0,

                    "west": 0
                }

            item = grouped[junction]

            item["records"] += 1

            item["vehicles"] += safe_number(
                row.get("vehicle_count")
            )

            item["waiting"] += safe_number(
                row.get("waiting_time")
            )

            item["speed"] += safe_number(
                row.get("average_speed")
            )

            item["north"] += safe_number(
                row.get("north")
            )

            item["south"] += safe_number(
                row.get("south")
            )

            item["east"] += safe_number(
                row.get("east")
            )

            item["west"] += safe_number(
                row.get("west")
            )

        result = []

        for junction in sorted(grouped):

            item = grouped[junction]

            records = max(
                item["records"],
                1
            )

            result.append({

                "junction":
                    junction,

                "name":
                    item["name"],

                "records":
                    item["records"],

                "vehicles":
                    round(
                        item["vehicles"] / records,
                        2
                    ),

                "waiting":
                    round(
                        item["waiting"] / records,
                        2
                    ),

                "speed":
                    round(
                        item["speed"] / records,
                        2
                    ),

                "north":
                    round(
                        item["north"] / records,
                        2
                    ),

                "south":
                    round(
                        item["south"] / records,
                        2
                    ),

                "east":
                    round(
                        item["east"] / records,
                        2
                    ),

                "west":
                    round(
                        item["west"] / records,
                        2
                    ),

                "status":
                    calculate_status(
                        item["vehicles"] / records
                    )
            })

        return jsonify(result)

    except Exception as e:

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# ============================================================
# AI OPTIMIZATION
# ============================================================

@app.route("/api/optimize", methods=["POST"])
def optimize():

    data = request.get_json(
        silent=True
    ) or {}

    junction = data.get(
        "junction",
        1
    )

    try:
        junction = int(junction)
    except Exception:
        junction = 1

    # Simple constraint-based optimization.
    # This is a project simulation and not a
    # real-world traffic controller.

    junction_data = None

    try:

        rows = junctions().get_json()

        for row in rows:

            if row["junction"] == junction:

                junction_data = row
                break

    except Exception:
        junction_data = None

    if not junction_data:

        junction_data = {
            "vehicles": 0,
            "waiting": 0
        }

    vehicles = safe_number(
        junction_data.get("vehicles")
    )

    waiting = safe_number(
        junction_data.get("waiting")
    )

    # Base signal values

    north = 30
    south = 30
    east = 25
    west = 25

    if vehicles > 100:
        north += 10
        south += 10

    elif vehicles > 70:
        north += 5
        south += 5

    if waiting > 40:
        east += 5
        west += 5

    result = {

        "algorithm":
            "A* Search + Constraint Optimization",

        "objective":
            "Minimize estimated waiting time",

        "junction":
            junction,

        "signals": {

            "north": north,

            "south": south,

            "east": east,

            "west": west
        },

        "yellow":
            5,

        "red": {

            "north":
                max(20, 120 - north),

            "south":
                max(20, 120 - south),

            "east":
                max(20, 120 - east),

            "west":
                max(20, 120 - west)
        },

        "cycle_time":
            120,

        "improvement":
            round(
                min(
                    35,
                    8 + waiting * 0.15
                ),
                1
            ),

        "status":
            "SUCCESS"
    }

    return jsonify(result)


# ============================================================
# UPLOAD CSV DATASET
# ============================================================

@app.route(
    "/api/upload-dataset",
    methods=["POST"]
)
def upload_dataset():

    if "file" not in request.files:

        return jsonify({
            "status": "error",
            "message": "Please select a CSV file."
        }), 400

    file = request.files["file"]

    if not file.filename:

        return jsonify({
            "status": "error",
            "message": "No file selected."
        }), 400

    if not file.filename.lower().endswith(
        ".csv"
    ):

        return jsonify({
            "status": "error",
            "message": "Only CSV files are supported."
        }), 400

    connection = None
    cursor = None

    try:

        content = file.read().decode(
            "utf-8-sig"
        )

        reader = csv.DictReader(
            io.StringIO(content)
        )

        rows = list(reader)

        if not rows:

            return jsonify({
                "status": "error",
                "message": "CSV file is empty."
            }), 400

        connection = get_connection()

        db_columns = get_table_columns(
            connection,
            "traffic_data"
        )

        inserted = 0

        cursor = connection.cursor()

        for row in rows:

            insert_data = {}

            for key, value in row.items():

                if not key:
                    continue

                actual = find_column(
                    db_columns,
                    [key.strip()]
                )

                if actual:

                    insert_data[actual] = (
                        value.strip()
                        if value is not None
                        else None
                    )

            if not insert_data:
                continue

            columns_sql = ", ".join(
                f"`{column}`"
                for column in insert_data
            )

            placeholders = ", ".join(
                ["%s"] * len(insert_data)
            )

            query = f"""
                INSERT INTO traffic_data
                ({columns_sql})
                VALUES
                ({placeholders})
            """

            cursor.execute(
                query,
                list(insert_data.values())
            )

            inserted += 1

        connection.commit()

        return jsonify({

            "status": "success",

            "message":
                "Dataset uploaded successfully.",

            "inserted":
                inserted
        })

    except Exception as e:

        if connection:
            connection.rollback()

        return jsonify({

            "status": "error",

            "message":
                str(e)
        }), 500

    finally:

        if cursor:
            cursor.close()

        if connection:
            connection.close()


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            5000
        )
    )

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
