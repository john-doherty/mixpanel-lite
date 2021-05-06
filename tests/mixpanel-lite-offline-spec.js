'use strict';

var path = require('path');
var puppeteer = require('puppeteer');
var querystring = require('querystring');

var url = 'file://' + path.join(__dirname, 'environment.html');
var page = null;
var browser = null;

describe('mixpanel-lite offline', function () {

    // create a new browser instance before each test
    beforeEach(function (done) {

        jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

        puppeteer.launch({
            headless: true,
            dumpio: true,
            args: []
        })
        .then(function (item) {
            browser = item;
            return browser.newPage();
        })
        .then(function (item) {
            page = item;
            return page.goto(url);
        })
        .then(function() {
            done();
        });
    });

    afterEach(function (done) {
        browser.close().then(function() {
            done();
        });
    });

    it('should write data to localStorage first', function (done) {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        page.setOfflineMode(true).then(function() {

            // execute tracking (pass local vars into dom)
            return page.evaluate(function (t, e) {
                window.mixpanel.init(t);
                window.mixpanel.track(e);

                // return local storage so we can inspect it
                return JSON.parse(window.localStorage.getItem('mixpanel-lite') || {});
            }, token, eventName);
        })
        .then(function(data) {

            // check we have request info
            expect(data).toBeDefined();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toEqual(1);
            expect(data[0].event).toEqual(eventName);
            expect(data[0].properties.token).toEqual(token);

            done();
        })
        .catch(function(err) {
            done(err);
        });
    });

    it('should send data when back online', function (done) {

        var numberOfTrackEvents = 4;

        // go offline
        page.setOfflineMode(true).then(function() {

            // create some tracking events
            return page.evaluate(function (num) {

                window.mixpanel.init((new Date()).getTime());

                for (var i = 0, l = num; i < l; i++) {
                    window.mixpanel.track('event-' + i);
                }
            }, numberOfTrackEvents);
        })
        .then(function() {

            // get value of local storage
            return page.evaluate(function () {
                return JSON.parse(window.localStorage.getItem('mixpanel-lite') || {});
            });
        })
        .then(function(data) {

            // check the tracking data was saved to local storage
            expect(data).toBeDefined();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toEqual(numberOfTrackEvents);

            // setup ajax intercept
            return page.setRequestInterception(true).then(function() {

                // intercept ajax requests
                page.on('request', function(request) {

                    var requestUrl = request.url();

                    request.continue();

                    if (requestUrl.startsWith('https://api.mixpanel.com/track')) {
                        numberOfTrackEvents--;
                    }

                    // // testing...
                    // var query = requestUrl.substr(requestUrl.indexOf('?') + 1);
                    // var params = querystring.parse(query);
                    // var data = JSON.parse(Buffer.from(params.data, 'base64').toString('ascii'));

                    // console.dir(data);

                    // console.log('numberOfTrackEvents', numberOfTrackEvents);

                    if (numberOfTrackEvents === 0) {

                        // get value of local storage
                        page.evaluate(function () {
                            return JSON.parse(window.localStorage.getItem('mixpanel-lite') || {});
                        })
                        .then(function(data) {

                            // check the tracking data was saved to local storage
                            expect(data).toBeDefined();
                            expect(Array.isArray(data)).toBe(true);
                            expect(data.length).toEqual(0);
                            done();
                        });
                    }
                });
            });
        })
        .then(function() {
            // go back online
            return page.setOfflineMode(false);
        })
        .catch(function(err) {
            done(err);
        });
    });

    it('should NOT suppress duplicate events', function (done) {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        // go offline
        page.setOfflineMode(true).then(function() {

            // create some tracking events
            return page.evaluate(function (t, e) {

                window.mixpanel.init(t);
                window.mixpanel.track(e);
                window.mixpanel.track(e);
                window.mixpanel.track(e);
                window.mixpanel.track(e);
            }, token, eventName);
        })
        .then(function() {

            // get value of local storage
            return page.evaluate(function () {
                return JSON.parse(window.localStorage.getItem('mixpanel-lite') || {});
            });
        })
        .then(function(data) {

            // check the tracking data was saved to local storage
            expect(data).toBeDefined();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toEqual(4);
            done();
        })
        .catch(function(err) {
            done(err);
        });
    });

    it('should drop first event when pending transactions exceed 250', function (done) {

        var maxEvents = 250;

        // go offline
        page.setOfflineMode(true).then(function() {

            return page.evaluate(function (max) {

                window.mixpanel.init('test-token');

                // create some tracking events
                for (var i = 0, l = max + 50; i < l; i++) {
                    window.mixpanel.track('track-' + i);
                }

            }, maxEvents);
        })
        .then(function() {

            // get value of local storage
            return page.evaluate(function () {
                return JSON.parse(window.localStorage.getItem('mixpanel-lite') || {});
            });
        })
        .then(function(data) {

            // check the tracking data was saved to local storage
            expect(data).toBeDefined();
            expect(Array.isArray(data)).toBe(true);

            // check the event limit was enforced
            expect(data.length).toEqual(maxEvents);

            // check first event is now 50 (0-49 dropped)
            expect(data.shift().event).toBe('track-50');

            // check last event is the most recent (fifo)
            expect(data.pop().event).toBe('track-299');
            done();
        })
        .catch(function(err) {
            done(err);
        });
    });
});
