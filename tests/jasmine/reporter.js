var JasmineConsoleReporter = require('jasmine-console-reporter');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

var jasmineEnv = jasmine.getEnv();
var reporter = new JasmineConsoleReporter({
    colors: 1, // (0|false)|(1|true)|2
    cleanStack: 1, // (0|false)|(1|true)|2|3
    verbosity: 4, // (0|false)|1|2|(3|true)|4|Object
    listStyle: 'indent', // "flat"|"indent"
    timeUnit: 'ms', // "ms"|"ns"|"s"
    timeThreshold: { ok: 500, warn: 1000, ouch: 3000 }, // Object|Number
    activity: false, // boolean or string ("dots"|"star"|"flip"|"bouncingBar"|...)
    emoji: true
});

jasmineEnv.clearReporters();
jasmineEnv.addReporter(reporter);
