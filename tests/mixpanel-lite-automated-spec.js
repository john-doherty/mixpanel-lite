var path = require('path');
var puppeteer = require('puppeteer');
var utils = require('./utils');

var url = 'file://' + path.join(__dirname, 'environment.html');
var page = null;
var browser = null;

describe('mixpanel-lite .automated', function () {

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

    afterEach(async function () {

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

    it('should send .automated=true to /track endpoint if automated', async function () {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        await page.setRequestInterception(true);

        // setup mixpanel
        await utils.setMixpanelToken(page, token);

        // listen for track requests
        var trackRequests = utils.waitForPuppeteerRequests(page, 1, 'https://api.mixpanel.com/track');

        // send event (in offline mode)
        await utils.sendMixpanelEvent(page, eventName);

        // Now wait for requests to be sent
        var results = await trackRequests;

        // decode the data and convert to JSON object so we can inspect
        var eventPayload = utils.getJsonPayloadFromMixpanelUrl(results[0].url);

        // check the tracking data we sent is correct
        expect(eventPayload?.event).toEqual(eventName);
        expect(eventPayload?.properties?.automated).toEqual(true);
    });

    it('should NOT send .automated=true to /track endpoint if not automated', async function () {

        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        await page.setRequestInterception(true);

        // bypass automation detection
        page.evaluate(function () {

            // override navigator.userAgent (include `HeadlessChrome` for puppeteer)
            Object.defineProperty(navigator, "userAgent", {
                get: function () { return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'; }
            });

            // return false for `navigator.webdriver` check
            Object.defineProperty(navigator, "webdriver", {
                get: function () { return false; }
            });
        });

        // setup mixpanel
        await utils.setMixpanelToken(page, token);

        // listen for track requests
        var trackRequests = utils.waitForPuppeteerRequests(page, 1, 'https://api.mixpanel.com/track');

        // send event (in offline mode)
        await utils.sendMixpanelEvent(page, eventName);

        // Now wait for requests to be sent
        var results = await trackRequests;

        // decode the data and convert to JSON object so we can inspect
        var eventPayload = utils.getJsonPayloadFromMixpanelUrl(results[0].url);

        // check the tracking data we sent is correct
        expect(eventPayload?.event).toEqual(eventName);
        expect(eventPayload?.properties?.automated).toBeUndefined();
    });
});
