import io
from functools import cache

import numpy
from nudenet import NudeDetector
from PIL import Image

EXPLICIT = {  # NudeNet class -> lowest score that blocks the photo; covered, face, feet, belly etc. are ignored
    "FEMALE_BREAST_EXPOSED": 0.7,  # 0.66 came from a clothed avatar in our own photos
    "FEMALE_GENITALIA_EXPOSED": 0.5,
    "MALE_GENITALIA_EXPOSED": 0.5,
    "ANUS_EXPOSED": 0.5,
    "BUTTOCKS_EXPOSED": 0.6,  # higher: swimwear photos score here too
}


@cache
def detector():  # loaded once per worker, on the first upload
    return NudeDetector()


def frames(data):  # BGR arrays for NudeNet; animated GIF/WebP: first, middle and last frame
    image = Image.open(io.BytesIO(data))
    count = getattr(image, "n_frames", 1)
    result = []
    for index in sorted({0, count // 2, count - 1}):
        image.seek(index)
        rgb = numpy.array(image.convert("RGB"))
        result.append(numpy.ascontiguousarray(rgb[:, :, ::-1]))  # OpenCV wants BGR in one memory block
    return result


def is_explicit(data):
    for frame in frames(data):
        for found in detector().detect(frame):
            if found["score"] >= EXPLICIT.get(found["class"], 2):  # 2 = never, for classes not in EXPLICIT
                return True
    return False
