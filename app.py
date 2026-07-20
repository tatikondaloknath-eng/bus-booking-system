from flask import Flask, render_template, request
import pandas as pd

app = Flask(__name__)

# -------------------------------
# Load Bus Dataset from Excel
# -------------------------------
df = pd.read_excel("bus_data.xlsx")
buses = df.to_dict(orient="records")


# -------------------------------
# Home Page
# -------------------------------
@app.route("/")
def home():
    return render_template("index.html")


# -------------------------------
# Search Bus
# -------------------------------
@app.route("/search", methods=["POST"])
def search():

    source = request.form["source"].strip().lower()
    destination = request.form["destination"].strip().lower()

    result = []

    for bus in buses:

        if (
            str(bus["Source"]).strip().lower() == source
            and str(bus["Destination"]).strip().lower() == destination
        ):
            result.append(bus)

    return render_template(
        "search.html",
        buses=result,
        source=source.title(),
        destination=destination.title(),
    )


# -------------------------------
# Book Bus
# -------------------------------
@app.route("/book/<int:bus_id>")
def book(bus_id):

    selected_bus = None

    for bus in buses:

        if int(bus["Bus_ID"]) == bus_id:
            selected_bus = bus
            break

    if selected_bus is None:
        return "<h2>Bus Not Found</h2>"

    return f"""
    <html>

    <head>

    <title>Booking</title>

    <style>

    body{{
        font-family:Arial;
        background:#f5f5f5;
        padding:40px;
    }}

    .card{{
        width:500px;
        margin:auto;
        background:white;
        padding:25px;
        border-radius:10px;
        box-shadow:0 0 10px gray;
    }}

    h1{{
        color:#d84e55;
    }}

    button{{
        background:#d84e55;
        color:white;
        border:none;
        padding:12px 20px;
        border-radius:5px;
        cursor:pointer;
    }}

    </style>

    </head>

    <body>

    <div class="card">

    <h1>{selected_bus['Bus_Name']}</h1>

    <p><b>Bus Number:</b> {selected_bus['Bus_Number']}</p>

    <p><b>From:</b> {selected_bus['Source']}</p>

    <p><b>To:</b> {selected_bus['Destination']}</p>

    <p><b>Departure:</b> {selected_bus['Departure_Time']}</p>

    <p><b>Arrival:</b> {selected_bus['Arrival_Time']}</p>

    <p><b>Duration:</b> {selected_bus['Duration']}</p>

    <p><b>Bus Type:</b> {selected_bus['Bus_Type']}</p>

    <p><b>Price:</b> ₹{selected_bus['Price']}</p>

    <p><b>Available Seats:</b> {selected_bus['Available_Seats']}</p>

    <br>

    <button>Proceed to Payment</button>

    </div>

    </body>

    </html>
    """


# -------------------------------
# Login
# -------------------------------
@app.route("/login")
def login():
    return "<h2>Login Page - Coming Soon</h2>"


# -------------------------------
# Register
# -------------------------------
@app.route("/register")
def register():
    return "<h2>Register Page - Coming Soon</h2>"


# -------------------------------
# Booking History
# -------------------------------
@app.route("/history")
def history():
    return "<h2>Booking History - Coming Soon</h2>"


# -------------------------------
# Payment
# -------------------------------
@app.route("/payment")
def payment():
    return "<h2>Payment Page - Coming Soon</h2>"


# -------------------------------
# Ticket
# -------------------------------
@app.route("/ticket")
def ticket():
    return "<h2>Ticket Page - Coming Soon</h2>"


# -------------------------------
# Run Application
# -------------------------------
if __name__ == "__main__":
    app.run(debug=True)