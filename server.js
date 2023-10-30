const express = require("express");

const mongoose = require("mongoose");

const cors = require("cors");

const routes = require("./routes/index");

const { uploadFile, getFileStream } = require('./routes/images');

const app = express();
const port = 3001;

app.use(express.json());
app.use(cors());
app.use("/api", routes);

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
