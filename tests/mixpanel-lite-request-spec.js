'use strict';

var path = require('path');
var puppeteer = require('puppeteer');
var querystring = require('querystring');

var url = 'file://' + path.join(__dirname, 'environment.html');
var page = null;
var browser = null;

describe('mixpanel-lite request', function () {

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

    it('should sent data to /track endpoint', function (done) {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        page.setRequestInterception(true).then(function() {

            // intercept ajax requests
            page.on('request', function(request) {

                var requestUrl = request.url();
                var query = requestUrl.substr(requestUrl.indexOf('?') + 1);
                var params = querystring.parse(query);

                // be sure we've intercepted the correct URL
                expect(requestUrl.startsWith('https://api.mixpanel.com/track')).toEqual(true);

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

                var requestUrl = request.url();
                var query = requestUrl.substr(requestUrl.indexOf('?') + 1);
                var params = querystring.parse(query);

                // be sure we've intercepted the correct URL
                expect(requestUrl.startsWith('https://api.mixpanel.com/engage')).toEqual(true);

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
});
