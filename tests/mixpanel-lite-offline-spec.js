var path = require('path');
var puppeteer = require('puppeteer');
var utils = require('./utils');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

var url = 'file://' + path.join(__dirname, 'environment.html');
var page = null;
var browser = null;

describe('mixpanel-lite offline', function () {

    // create a new browser instance before each test
    beforeEach(async function () {

        // Launch a new browser instance
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // get page
        page = (await browser.pages())[0];

        // Navigate to the desired URL
        await page.goto(url);
    });

    afterEach(function () {

        return page.evaluate(function () {
            return localStorage.removeItem('mixpanel-lite');
        })
        .then(function() {
            return utils.sleep(250);
        })
        .then(function() {
            return browser.close();
        });
    });

    it('should write data to localStorage first', async function () {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        return page.setOfflineMode(true).then(function() {

            // execute tracking (pass local vars into dom)
            return page.evaluate(function (t, e) {
                window.mixpanel.init(t);
                window.mixpanel.track(e);

                // return local storage so we can inspect it
                return JSON.parse(localStorage.getItem('mixpanel-lite') || {});
            }, token, eventName);
        })
        .then(function(data) {

            // check we have request info
            expect(data).toBeDefined();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toEqual(1);
            expect(data[0].event).toEqual(eventName);
            expect(data[0].properties.token).toEqual(token);
        });
    });

    it('should send offline events when back online', async function () {

        var numberOfTrackEvents = 5;

        await page.setRequestInterception(true); // allow requests to be intercepted
        await page.setOfflineMode(true); // start in offline mode so tracking is written to local db

        // intercept requests so we can count them
        page.on('request', function(request) {

            var requestUrl = request.url();

            if (requestUrl.startsWith('https://api.mixpanel.com/track')) {
                numberOfTrackEvents--;
            }

            request.continue();
        });

        // fire tracking events
        await page.evaluate(function (num) {

            window.mixpanel.init('token-' + (new Date()).getTime());

            for (var i = 0, l = num; i < l; i++) {
                window.mixpanel.track('event-' + i);
            }
        }, numberOfTrackEvents);

        // get events from storage
        var data = await page.evaluate(function () {
            return JSON.parse(localStorage.getItem('mixpanel-lite') || {});
        });

        // check tracking events were saved to local storage
        expect(data).toBeDefined();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toEqual(numberOfTrackEvents);

        // go back online `page.on('request') handler above will execute`
        // once the adequate number of requests have executed, test will complete
        await page.setOfflineMode(false);

        // wait a sec
        await utils.sleep(3000);

        expect(numberOfTrackEvents).toEqual(0);

        return Promise.resolve();
    });

    it('should NOT suppress duplicate events', async function () {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        // go offline
        return page.setOfflineMode(true).then(function() {

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
                return JSON.parse(localStorage.getItem('mixpanel-lite') || {});
            });
        })
        .then(function(data) {

            // check the tracking data was saved to local storage
            expect(data).toBeDefined();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toEqual(4);
        });
    });

    it('should drop first event when pending transactions exceed 100', async function () {

        var maxEvents = 100;

        // go offline
        return page.setOfflineMode(true).then(function() {

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
                return JSON.parse(localStorage.getItem('mixpanel-lite') || {});
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
            expect(data.pop().event).toBe('track-149');
        });
    });

    it('should store correct number of events in order', async function() {

        var maxEvents = utils.randomInteger(19, 99);
        var eventsToSend = [];

        // create some tracking events
        for (var i = 0; i < maxEvents; i++) {
            eventsToSend.push({
                eventName: 'tracking-event-' + i,
                data: {
                    index: i
                }
            });
        }

        // go offline
        return page.setOfflineMode(true).then(function() {

            // init
            return page.evaluate(function () {
                window.mixpanel.init('test-token');
            });
        })
        .then(function() {

            // send events
            return page.evaluate(function (events) {

                for (var ii = 0, ll = events.length; ii < ll; ii++) {
                    window.mixpanel.track(events[ii].eventName, events[ii].data);
                }

            }, eventsToSend);
        })
        .then(function() {

            // get value of local storage
            return page.evaluate(function () {
                return JSON.parse(localStorage.getItem('mixpanel-lite') || {});
            });
        })
        .then(function(data) {

            // check the tracking data was saved to local storage
            expect(data).toBeDefined();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toEqual(eventsToSend.length);

            var firstEvent = data[0];
            var lastEvent = data[data.length - 1];

            // check first event
            expect(firstEvent.eventName).toEqual(eventsToSend[0].event);
            expect(firstEvent.properties.index).toEqual(eventsToSend[0].data.index);

            // check last event
            expect(lastEvent.eventName).toEqual(eventsToSend[eventsToSend.length - 1].event);
            expect(lastEvent.properties.index).toEqual(eventsToSend[eventsToSend.length - 1].data.index);
        });
    });
});
