const compression = require('compression');
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.use(compression());
app.use(express.static(__dirname));
app.listen(port);

console.log(`Server listening on ${port}`);
