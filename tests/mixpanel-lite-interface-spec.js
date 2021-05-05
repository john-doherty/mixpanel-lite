'use strict';

var path = require('path');
var puppeteer = require('puppeteer');
var querystring = require('querystring');

var url = 'file://' + path.join(__dirname, 'environment.html');
var page = null;
var browser = null;

describe('mixpanel-lite interface', function () {

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
            expect(mixpanel.register).toBeDefined();
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
});
