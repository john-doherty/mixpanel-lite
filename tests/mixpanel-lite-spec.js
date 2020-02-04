'use strict';

var nock = require('nock');
var jsdom = require('jsdom');
var path = require('path');

var document = null;
var window = null;

// disable all outbound http requests
nock.disableNetConnect();

describe('mixpanel-lite', function () {

    // create a new browser instance before each test
    beforeEach(function (done) {

        // remove all previous nocks
        nock.cleanAll();

        // have nock serve up the lib to the test page
        nock('http://localhost:8080')
            .get('/src/mixpanel-lite.js')
            .replyWithFile(200, path.resolve('./src/mixpanel-lite.js'));

        var virtualConsole = new jsdom.VirtualConsole();

        var options = {
            url: 'http://localhost:8080',
            referrer: 'https://example.com/',
            contentType: 'text/html',
            runScripts: 'dangerously',
            resources: 'usable',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
            virtualConsole: virtualConsole.sendTo(console, { omitJSDOMErrors: true }) // redirect browser output to terminal
        };

        // load test page from disk (includes links to dependent scripts)
        jsdom.JSDOM.fromFile(path.resolve(__dirname, 'environment.html'), options).then(function(dom) {

            // expose the window/document object to tests
            window = dom.window;
            document = window.document;

            // slight wait to allow scripts to load
            setTimeout(function() {
                expect(document).toBeDefined();
                expect(document.title).toBe('Test Page');
                done();
            }, 250);
        });
    });

    it('should expose correct methods', function(done) {
        expect(window.mixpanel).toBeDefined();
        expect(window.mixpanel.init).toBeDefined();
        expect(window.mixpanel.track).toBeDefined();
        expect(window.mixpanel.reset).toBeDefined();
        expect(window.mixpanel.identify).toBeDefined();
        expect(window.mixpanel.people).toBeDefined();
        expect(window.mixpanel.people.set).toBeDefined();
        expect(window.mixpanel.mute).toBeDefined();
        expect(window.mixpanel.unmute).toBeDefined();
        done();
    });

    it('should sent data to /track endpoint', function(done) {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        nock('https://api.mixpanel.com/').get('/track')
            .query(function(query) {
                expect(query).toBeDefined();
                expect(query._).toBeDefined();
                expect(query.data).toBeDefined();
                expect(query.data).not.toEqual('');

                // decode the data and convert to JSON object so we can inspect
                var data = JSON.parse(Buffer.from(query.data, 'base64').toString('ascii'));

                expect(data.properties).toBeDefined();
                expect(data.properties.distinct_id).toBeDefined();
                expect(data.properties.$browser).toEqual('Safari');
                expect(data.properties.token).toEqual(token);
                expect(data.event).toEqual(eventName);

                done();
            })
            .reply(200);

        window.mixpanel.init(token);
        window.mixpanel.track(eventName);
    });

    it('should sent data to /engage endpoint', function(done) {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var email = 'test-email-' + now + '@johndoherty.info';

        nock('https://api.mixpanel.com').get('/engage')
            .query(function(query) {

                expect(query).toBeDefined();
                expect(query._).toBeDefined();
                expect(query.data).toBeDefined();
                expect(query.data).not.toEqual('');

                // decode the data and convert to JSON object so we can inspect
                var data = JSON.parse(Buffer.from(query.data, 'base64').toString('ascii'));

                expect(data.$distinct_id).toBeDefined();
                expect(data.$set.$email).toEqual(email);
                expect(data.$token).toEqual(token);

                done();
            })
            .reply(200);

        window.mixpanel.init(token);
        window.mixpanel.people.set({ $email: email });
    });

    it('should write request to localStorage first', function(done) {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        // for API to reject even thus ensuring the data remains in local storage to test
        nock('https://api.mixpanel.com/').get('/track').reply(500);

        // fire tracking event
        window.mixpanel.init(token);
        window.mixpanel.track(eventName);

        // get data from local storage
        var data = JSON.parse(window.localStorage.getItem('mixpanel-lite') || {});

        // check we have request info
        expect(data).toBeDefined();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toEqual(1);
        expect(data[0].event).toEqual(eventName);
        expect(data[0].properties.token).toEqual(token);

        done();
    });

});
