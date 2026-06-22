from typing import Any

# Define the OpenAI-style tool schema list
AVAILABLE_TOOLS_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "search_flights",
            "description": "Search for flights between origin and destination on a specific date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "origin": {"type": "string", "description": "Three-letter airport code (e.g. NYC, LAX)."},
                    "destination": {"type": "string", "description": "Three-letter airport code (e.g. SFO, MIA)."},
                    "date": {"type": "string", "description": "Flight date in YYYY-MM-DD format."}
                },
                "required": ["origin", "destination", "date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "book_flight",
            "description": "Book a flight using a flight number and passenger name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "flight_number": {"type": "string", "description": "The flight number to book (e.g. AA-102)."},
                    "passenger_name": {"type": "string", "description": "Full name of the passenger."}
                },
                "required": ["flight_number", "passenger_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_calendar",
            "description": "Check the list of meetings and events scheduled on a specific date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format."}
                },
                "required": ["date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "book_room",
            "description": "Book a conference/meeting room.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format."},
                    "room_name": {"type": "string", "description": "Name of the room (e.g. Boardroom, Tesla)."},
                    "start_time": {"type": "string", "description": "Start time (HH:MM)."},
                    "end_time": {"type": "string", "description": "End time (HH:MM)."}
                },
                "required": ["date", "room_name", "start_time", "end_time"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the weather forecast for a city on a specific date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "Name of the city."},
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format."}
                },
                "required": ["city", "date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculator",
            "description": "Evaluate a simple math expression.",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {"type": "string", "description": "Mathematical expression (e.g., '120 * 1.05' or '300 - 45')."}
                },
                "required": ["expression"]
            }
        }
    }
]

# Implement Mock Tools responses
def execute_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """
    Executes mock tool logic and returns a deterministic, canned JSON response.
    """
    name = name.lower().strip()
    
    if name == "search_flights":
        origin = arguments.get("origin", "").upper()
        dest = arguments.get("destination", "").upper()
        date = arguments.get("date", "")
        
        # Canned flights database
        return {
            "success": True,
            "flights": [
                {
                    "flight_number": "AA-102",
                    "airline": "American Airlines",
                    "departure": f"{date}T08:30:00",
                    "arrival": f"{date}T11:45:00",
                    "price": 285.00,
                    "origin": origin,
                    "destination": dest
                },
                {
                    "flight_number": "UA-405",
                    "airline": "United Airlines",
                    "departure": f"{date}T14:15:00",
                    "arrival": f"{date}T17:30:00",
                    "price": 340.00,
                    "origin": origin,
                    "destination": dest
                },
                {
                    "flight_number": "DL-982",
                    "airline": "Delta Air Lines",
                    "departure": f"{date}T19:00:00",
                    "arrival": f"{date}T22:15:00",
                    "price": 195.00,
                    "origin": origin,
                    "destination": dest
                }
            ],
            "message": f"Found 3 flights from {origin} to {dest} on {date}."
        }
        
    elif name == "book_flight":
        flight_number = arguments.get("flight_number", "").upper()
        passenger = arguments.get("passenger_name", "John Doe")
        return {
            "success": True,
            "booking_reference": "REF-XYZ987654",
            "flight_number": flight_number,
            "passenger_name": passenger,
            "status": "Confirmed",
            "message": f"Successfully booked flight {flight_number} for {passenger}."
        }
        
    elif name == "check_calendar":
        date = arguments.get("date", "")
        # Canned calendar database
        return {
            "success": True,
            "date": date,
            "events": [
                {"title": "Product Sync Meeting", "start": "09:00", "end": "10:00", "room": "Tesla"},
                {"title": "Lunch with Design Team", "start": "12:00", "end": "13:00", "room": "External"},
                {"title": "Code Review: Trajectory Parser", "start": "14:30", "end": "15:30", "room": "Boardroom"}
            ]
        }
        
    elif name == "book_room":
        date = arguments.get("date", "")
        room = arguments.get("room_name", "Tesla")
        start = arguments.get("start_time", "10:00")
        end = arguments.get("end_time", "11:00")
        return {
            "success": True,
            "room_name": room,
            "date": date,
            "start_time": start,
            "end_time": end,
            "booking_id": "ROOM-CONF-3312",
            "message": f"Room {room} successfully booked on {date} from {start} to {end}."
        }
        
    elif name == "get_weather":
        city = arguments.get("city", "New York").title()
        date = arguments.get("date", "")
        return {
            "success": True,
            "city": city,
            "date": date,
            "temperature_c": 22,
            "condition": "Partly Cloudy",
            "precipitation_chance": 10,
            "message": f"Weather forecast for {city} on {date} is Partly Cloudy, 22°C."
        }
        
    elif name == "calculator":
        expression = arguments.get("expression", "")
        # Safe mathematical evaluation
        try:
            # Clean the expression of unsafe characters
            allowed_chars = set("0123456789+-*/.() ")
            if not all(c in allowed_chars for c in expression):
                raise ValueError("Invalid characters in expression")
            
            val = eval(expression, {"__builtins__": None}, {})
            return {
                "success": True,
                "expression": expression,
                "result": float(val),
                "message": f"Result: {val}"
            }
        except Exception as e:
            return {
                "success": False,
                "expression": expression,
                "error": str(e),
                "message": f"Failed to evaluate expression: {e}"
            }
            
    else:
        return {
            "success": False,
            "error": f"Tool '{name}' not found in registry.",
            "message": f"Error: Tool '{name}' is not supported."
        }
