const express = require("express");
const app = express();

const server = app.listen(3000, () => {
  console.log("Start sever port: 3000");
});

app.get("/api/test", (req, res, next) => {
  console.log("/api/test");
  res.json({"Hello": "World"});
});

