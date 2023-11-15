const express = require("express");

const mongoose = require("mongoose");

const cors = require("cors");

const routes = require("./routes/index");
const imageRoutes = require("./routes/images");
const matchesRoutes = require("./routes/matches");

const { uploadFile, getFileStream } = require("./s3");

const app = express();
const port = 3001;

app.use(express.json());
app.use(cors());
app.use("/api", routes);
app.use("/api/images", imageRoutes);
app.use("/api/matches", matchesRoutes);

//connect to mongoDB
mongoose
  .connect(
    "REMOVED_SENSITIVE_VALUE"
  )
  .then(() => {
    app.listen(port, () => {
      console.log(`app API is running on port: ${port}`);
    });
    console.log("connected to MongoDB");
  })
  .catch((error) => {
    console.log(error);
  });

module.exports = app;
