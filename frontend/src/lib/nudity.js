const MODEL_URL = "/models/nsfw/model.json"; // self-hosted in public/, no CDN

let modelPromise = null; // loaded once, on the first photo someone picks

const loadModel = () => {
  if (!modelPromise) {
    modelPromise = Promise.all([import("@tensorflow/tfjs"), import("nsfwjs/core")]).then(
      ([, nsfwjs]) => nsfwjs.load(MODEL_URL)
    );
    modelPromise.catch(() => {
      modelPromise = null; // try again on the next photo
    });
  }
  return modelPromise;
};

const loadImage = async (file) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const isExplicitScores = (predictions) => {
  const score = (name) => predictions.find((p) => p.className === name)?.probability ?? 0;
  const porn = score("Porn");
  const hentai = score("Hentai");
  return porn >= 0.7 || hentai >= 0.7 || porn + hentai >= 0.8; // "Sexy" (swimwear etc.) is allowed
};

/** Quick check before uploading. The server checks every photo again, so a miss here is caught there. */
export const isExplicitPhoto = async (file) => {
  try {
    const model = await loadModel();
    const img = await loadImage(file);
    return isExplicitScores(await model.classify(img));
  } catch (err) {
    console.warn("Photo check unavailable, the server will check it.", err);
    return false; // never block someone because our own check failed to load
  }
};
