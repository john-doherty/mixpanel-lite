'use strict';

var path = require('path');
var puppeteer = require('puppeteer');
var querystring = require('querystring');

var url = 'file://' + path.join(__dirname, 'environment.html');
var page = null;
var browser = null;

describe('mixpanel-lite', function () {

    // create a new browser instance before each test
    beforeEach(function (done) {

        jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

        puppeteer.launch({
            headless: true,
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

    it('should expose the correct interface', function (done) {

        page.evaluate(function () {
            return window.mixpanel;
        })
        .then(function (mixpanel) {
            expect(mixpanel).toBeDefined();
            expect(mixpanel.init).toBeDefined();
            expect(mixpanel.track).toBeDefined();
            expect(mixpanel.reset).toBeDefined();
            expect(mixpanel.identify).toBeDefined();
            expect(mixpanel.people).toBeDefined();
            expect(mixpanel.people.set).toBeDefined();
            expect(mixpanel.mute).toBeDefined();
            expect(mixpanel.unmute).toBeDefined();
            expect(mixpanel.muted).toEqual(false);
            done();
        });
    });

    it('should return muted interface when muted', function (done) {

        page.evaluate(function () {
            window.mixpanel.init(null, { mute: true });
            return window.mixpanel;
        })
        .then(function (mixpanel) {
            expect(mixpanel).toBeDefined();
            expect(mixpanel.muted).toEqual(true);
            done();
        });
    });

    it('should issue warning if no token passed', function (done) {

        page.on('console', function(message) {
            expect(message).toBeDefined();
            expect(message._text).toEqual('mixpanel.init: invalid token');
            expect(message._type).toEqual('warning');
            done();
        });

        page.evaluate(function () {
            window.mixpanel.init();
            return window.mixpanel;
        });
    });

    it('should sent data to /track endpoint', function (done) {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        page.setRequestInterception(true).then(function() {

            // intercept ajax requests
            page.on('request', function(request) {

                var url = request.url();
                var query = url.substr(url.indexOf('?') + 1);
                var params = querystring.parse(query);

                // be sure we've intercepted the correct URL
                expect(url.startsWith('https://api.mixpanel.com/track')).toEqual(true);

                // confirm it sent the correct params
                expect(params).toBeDefined();
                expect(params._).toBeDefined();
                expect(params.data).toBeDefined();
                expect(params.data).not.toEqual('');

                // decode the data and convert to JSON object so we can inspect
                var data = JSON.parse(Buffer.from(params.data, 'base64').toString('ascii'));

                // check the tracking data we sent is correct
                expect(data.properties).toBeDefined();
                expect(data.properties.distinct_id).toBeDefined();
                expect(data.properties.$browser).toEqual('Chrome');
                expect(data.properties.token).toEqual(token);
                expect(data.event).toEqual(eventName);

                done();
            });

            // execute tracking (pass local vars into dom)
            page.evaluate(function (t, e) {
                window.mixpanel.init(t);
                window.mixpanel.track(e);
            }, token, eventName);
        })
        .catch(function(err) {
            done(err);
        });
    });

    it('should sent data to /engage endpoint', function (done) {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var email = 'test-email-' + now + '@johndoherty.info';

        page.setRequestInterception(true).then(function() {

            // intercept ajax requests
            page.on('request', function(request) {

                var url = request.url();
                var query = url.substr(url.indexOf('?') + 1);
                var params = querystring.parse(query);

                // be sure we've intercepted the correct URL
                expect(url.startsWith('https://api.mixpanel.com/engage')).toEqual(true);

                // confirm it sent the correct params
                expect(params).toBeDefined();
                expect(params._).toBeDefined();
                expect(params.data).toBeDefined();
                expect(params.data).not.toEqual('');

                // decode the data and convert to JSON object so we can inspect
                var data = JSON.parse(Buffer.from(params.data, 'base64').toString('ascii'));

                expect(data.$distinct_id).toBeDefined();
                expect(data.$set.$email).toEqual(email);
                expect(data.$token).toEqual(token);

                done();
            });

            // execute tracking (pass local vars into dom)
            page.evaluate(function (t, e) {
                window.mixpanel.init(t);
                window.mixpanel.people.set({ $email: e });
            }, token, email);
        })
        .catch(function(err) {
            done(err);
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

        var numberOfEvents = 10;

        // go offline
        page.setOfflineMode(true).then(function() {

            // create some tracking events
            return page.evaluate(function (num) {

                window.mixpanel.init((new Date()).getTime());

                for (var i = 0, l = num; i < l; i++) {
                    window.mixpanel.track('event-' + i + '-' + (new Date()).getTime());
                }
            }, numberOfEvents);
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
            expect(data.length).toEqual(numberOfEvents);

            // setup ajax intercept
            return page.setRequestInterception(true).then(function() {

                // intercept ajax requests
                page.on('request', function(request) {

                    if (request.url().startsWith('https://api.mixpanel.com/track')) {
                        numberOfEvents--;
                    }

                    request.continue();

                    if (numberOfEvents === 0) {
                        done();
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
});
