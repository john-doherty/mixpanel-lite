var express = require('express');
var app = express();

var port = 8080;

app.use(express.static('.', { extensions: ['html'] }));

// start the server
app.listen(port, function () {
    console.log('Web server listening on port ' + port);
});
