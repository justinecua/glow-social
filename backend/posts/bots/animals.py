import random
import re

from .helpers import get_json, https_only, make_post


def dog():  # a random dog photo; the breed comes from the image URL
    photo = https_only(get_json("https://dog.ceo/api/breeds/image/random").get("message"))
    if not photo:
        return None
    match = re.search(r"/breeds/([^/]+)/", photo)  # e.g. /breeds/terrier-yorkshire/ -> "Yorkshire Terrier"
    breed = " ".join(reversed(match.group(1).split("-"))).title() if match else "good boy"
    return make_post(
        f"Meet today's dog: a {breed} 🐶",
        "Rate this pup from 1 to 10 in the comments.",
        tags=["dogs", "pets"],
        photo=photo,
    )


def cat():
    data = get_json("https://api.thecatapi.com/v1/images/search")
    photo = https_only(data[0].get("url") if data else "")
    if not photo:
        return None
    line = random.choice(["Your daily cat 🐱", "Cat of the day. Caption this 👇", "A cat to brighten your feed 🐱"])
    return make_post(line, tags=["cats", "pets"], photo=photo)
