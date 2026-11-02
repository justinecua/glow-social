import re
from datetime import date

from django.utils import timezone

from .helpers import get_json, make_post

CITIES = [("Manila", 14.5995, 120.9842), ("Cebu", 10.3157, 123.8854), ("Davao", 7.1907, 125.4553)]  # (name, latitude, longitude)

SOLEMN_HOLIDAYS = re.compile(  # these call for a respectful tone, not "Happy ...!"
    r"All Saints|All Souls|Good Friday|Maundy Thursday|Black Saturday|Holy Saturday",
    re.IGNORECASE,
)

FACTS = [  # short and checkable; add more freely
    "The Philippines is made up of 7,641 islands, based on a 2016 count by NAMRIA.",
    "Filipino and English are the official languages, but more than 170 languages are spoken across the country.",
    "The Philippine eagle is the national bird and one of the largest eagles in the world.",
    "The Philippine tarsier, found in Bohol, is one of the smallest primates in the world.",
    "José Rizal wrote his famous novels, Noli Me Tángere and El Filibusterismo, in Spanish.",
    "The Rice Terraces of the Philippine Cordilleras are a UNESCO World Heritage Site.",
    "Tubbataha Reefs Natural Park in the Sulu Sea is a UNESCO World Heritage Site.",
    "The Puerto Princesa Underground River in Palawan was named one of the New 7 Wonders of Nature.",
    "Mayon Volcano in Albay is famous for its almost perfectly symmetrical cone.",
    "The Philippines declared independence from Spain on June 12, 1898, in Kawit, Cavite.",
    "The first jeepneys were made from US military jeeps left behind after World War II.",
    "Taal Volcano sits on an island in the middle of Taal Lake in Batangas.",
    "The yo-yo became a craze in the US in the 1920s thanks to Pedro Flores, a Filipino immigrant.",
    "The PBA, founded in 1975, is the oldest professional basketball league in Asia.",
    "Mount Apo in Mindanao is the highest mountain in the Philippines.",
    "The narra is the national tree of the Philippines.",
    "The sampaguita is the national flower of the Philippines.",
    "Vigan in Ilocos Sur is a UNESCO World Heritage City known for its Spanish colonial streets.",
]


def describe_weather(code):  # WMO weather code -> (emoji, words)
    if code == 0:
        return "☀️", "Sunny"
    if code in (1, 2):
        return "🌤️", "Partly cloudy"
    if code == 3:
        return "☁️", "Cloudy"
    if code in (45, 48):
        return "🌫️", "Foggy"
    if 51 <= code <= 67 or 80 <= code <= 82:
        return "🌧️", "Rain"
    if code >= 95:
        return "⛈️", "Thunderstorms"
    return "🌥️", "Mixed"


def city_forecast(city, forecast):  # one line like "☀️ Manila: Sunny, 26–33°C · 20% chance of rain"
    day = forecast.get("daily") or {}
    try:
        emoji, words = describe_weather(day["weather_code"][0])
        low, high = round(day["temperature_2m_min"][0]), round(day["temperature_2m_max"][0])
        rain = day.get("precipitation_probability_max", [0])[0] or 0
    except (KeyError, IndexError, TypeError):
        return None, 0
    return f"{emoji} {city}: {words}, {low}–{high}°C · {rain}% chance of rain", rain


def weather():  # today's forecast for Manila, Cebu and Davao (Open-Meteo, no API key)
    latitudes = ",".join(str(lat) for _, lat, _ in CITIES)
    longitudes = ",".join(str(lon) for _, _, lon in CITIES)
    data = get_json(
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitudes}&longitude={longitudes}&timezone=Asia%2FManila&forecast_days=1"
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    )
    forecasts = data if isinstance(data, list) else [data]  # one forecast per city

    lines, rainiest = [], 0
    for (city, _, _), forecast in zip(CITIES, forecasts):
        line, rain = city_forecast(city, forecast)
        if line:
            lines.append(line)
            rainiest = max(rainiest, rain)
    if not lines:
        return None

    today = timezone.localdate()
    return make_post(
        f"Weather today, {today:%A %b} {today.day} 🇵🇭",
        "\n".join(lines),
        "Bring a payong today ☔" if rainiest >= 60 else "",
        "Forecast by Open-Meteo. For official warnings, follow PAGASA.",
        tags=["weather"],
    )


def holiday():  # posts on a public holiday, or 3 days before one ("long weekend check")
    today = timezone.localdate()
    for holiday in get_json(f"https://date.nager.at/api/v3/PublicHolidays/{today.year}/PH"):
        try:
            day = date.fromisoformat(holiday["date"])
        except (KeyError, ValueError):
            continue
        name, local_name = holiday.get("name", ""), holiday.get("localName", "")
        label = f"{name} ({local_name})" if local_name and local_name != name else name

        if day == today and SOLEMN_HOLIDAYS.search(name):
            return make_post(
                f"Today is {label} 🕯️",
                "A day to remember and pray for loved ones. Take care, and travel safe if you're heading home.",
                tags=["holiday"],
            )
        if day == today:
            return make_post(
                f"Happy {name}! 🇵🇭",
                f"Today is {label}, a public holiday in the Philippines. How are you spending it?",
                tags=["holiday"],
            )
        if (day - today).days == 3:
            return make_post(
                "Long weekend check 🗓️",
                f"{label} is in 3 days ({day:%A, %B} {day.day}). Any plans?",
                tags=["holiday"],
            )
    return None


def fact():  # a different fact each day, cycling through FACTS
    return make_post("Did you know? 🇵🇭", FACTS[timezone.localdate().toordinal() % len(FACTS)], tags=["pinoytrivia"])
