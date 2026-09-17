const express = require("express");
const imageRouter = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const fs = require("fs/promises");
const { uploadFile, getFileStream } = require("../s3");

// Serve private S3 objects through the API. These image URLs are public.
imageRouter.get("/:key", (req, res) => {
  const readStream = getFileStream(req.params.key);
  readStream.on("contentType", (contentType) => {
    res.setHeader("Content-Type", contentType || "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
  });
  readStream.on("error", (error) => {
    if (res.destroyed) return;
    if (res.headersSent) return res.destroy();
    const missing = error.code === "NoSuchKey" || error.statusCode === 404;
    res.status(missing ? 404 : 502).json({
      msg: missing ? "Image not found" : "Unable to retrieve image",
    });
  });
  res.on("close", () => readStream.destroy());
  readStream.pipe(res);
});

imageRouter.post("/", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: "An image file is required" });
  try {
    // Validate before uploading so a missing configuration does not orphan an object.
    const base = new URL(process.env.PUBLIC_API_URL);
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password ||
        base.pathname !== "/" || base.search || base.hash) {
      throw new Error("Invalid PUBLIC_API_URL");
    }
    const result = await uploadFile(req.file);
    res.json({
      photo_url: `${base.origin}/api/images/${encodeURIComponent(result.Key)}`,
    });
  } catch (error) {
    res.status(502).json({ msg: "Unable to upload image" });
  } finally {
    await fs.unlink(req.file.path).catch(() => {
      console.warn("Unable to remove temporary image upload");
    });
  }
});

module.exports = imageRouter;
