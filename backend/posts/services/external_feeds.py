import requests
from django.utils import timezone
import os
from dotenv import load_dotenv
from django.utils import timezone
from django.conf import settings
from django.core.files.storage import default_storage

load_dotenv()


def getJokes():
    try:
        response = requests.get("https://v2.jokeapi.dev/joke/Any?type=twopart")
        if response.status_code == 200:
            joke = response.json()
            return [
                {
                    "id": joke.get("id"),
                    "username": "yourRandomJoker",
                    "caption": f"{joke.get('setup')} - {joke.get('delivery')}",
                    "dateTime": timezone.now(),
                    "photos": [],
                }
            ]
    except Exception as e:
        print(f"Error fetching jokes: {e}")
        return []


def getUselessFacts():
    try:
        response = requests.get("https://uselessfacts.jsph.pl/api/v2/facts/random")
        if response.status_code == 200:
            facts = response.json()
            return [
                {
                    "id": facts.get("id"),
                    "username": "Mr.Facts",
                    "caption": facts.get("text"),
                    "dateTime": timezone.now(),
                    "photos": [],
                }
            ]
    except Exception as e:
        print(f"Error fetching facts: {e}")
        return []


def getAdvice():
    try:
        api_url = "https://api.api-ninjas.com/v1/advice"
        response = requests.get(api_url, headers={"X-Api-Key": os.getenv("X-Api-Key")})
        if response.status_code == 200:
            advice = response.json()
            return [
                {
                    "id": advice.get("id"),
                    "username": "AdviceGuy",
                    "caption": advice.get("advice"),
                    "dateTime": timezone.now(),
                    "photos": [],
                }
            ]
    except Exception as e:
        print(f"Error fetching advice: {e}")
        return []


def getQuotes():
    try:
        api_url = "https://api.api-ninjas.com/v1/quotes"
        response = requests.get(api_url, headers={"X-Api-Key": os.getenv("X-Api-Key")})
        if response.status_code == 200:
            quotes = response.json()
            for quote in quotes:
                return [
                    {
                        "id": quote.get("id"),
                        "username": quote.get("author"),
                        "caption": quote.get("quote"),
                        "dateTime": timezone.now(),
                        "photos": [],
                    }
                ]
    except Exception as e:
        print(f"Error fetching quotes: {e}")
        return []


def getRiddle():
    try:
        api_url = "https://api.api-ninjas.com/v1/riddles"
        response = requests.get(api_url, headers={"X-Api-Key": os.getenv("X-Api-Key")})
        if response.status_code == 200:
            riddles = response.json()
            for riddle in riddles:
                return [
                    {
                        "id": riddle.get("id"),
                        "username": riddle.get("title"),
                        "caption": riddle.get("question"),
                        "answer": riddle.get("answer"),
                        "dateTime": timezone.now(),
                        "photos": [],
                    }
                ]
    except Exception as e:
        print(f"Error fetching riddle: {e}")
        return []


def getMemeFromReddit():
    try:
        response = requests.get("https://meme-api.com/gimme")
        if response.status_code == 200:
            meme = response.json()
            return [
                {
                    "id": meme.get("id"),
                    "username": meme.get("author"),
                    "caption": meme.get("title"),
                    "dateTime": timezone.now(),
                    "photos": [meme.get("url")],
                }
            ]
    except Exception as e:
        print(f"Error fetching meme: {e}")
        return []

BACKEND_DOMAIN = "http://192.168.43.245:8001"

def getRandomAnimeImage():
    try:
        response = requests.get("https://pic.re/image")
        if response.status_code == 200:
            anime_folder = os.path.join(settings.MEDIA_ROOT, "anime")
            os.makedirs(anime_folder, exist_ok=True)

            filename = f"anime_{timezone.now().strftime('%Y%m%d%H%M%S')}.jpg"
            image_path = os.path.join(anime_folder, filename)

            with open(image_path, "wb") as f:
                f.write(response.content)

            # Build relative and full URL
            relative_url = f"{settings.MEDIA_URL}anime/{filename}"
            full_url = f"{BACKEND_DOMAIN}{relative_url}"

            return [
                {
                    "id": "",
                    "username": "",
                    "caption": "",
                    "dateTime": timezone.now(),
                    "photos": [full_url],  # 👈 Always return as array
                }
            ]
    except Exception as e:
        print(f"Error fetching anime: {e}")
        return []
