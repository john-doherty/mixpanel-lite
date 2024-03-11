var path = require('path');
var puppeteer = require('puppeteer');
var utils = require('./utils');
var cuid = require('cuid');

var url = 'file://' + path.join(__dirname, 'environment.html');
var page = null;
var browser = null;

describe('mixpanel-lite: ids', function () {

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

    it('should reused device_id but assign new distinct_id', async function() {

        // create some tracking events
        var event1 = {
            name: `event-${cuid.slug()}`,
            data: {
                age: utils.randomInteger(10, 20)
            }
        };
        var event2 = {
            name: `event-${cuid.slug()}`,
            data: {
                age: utils.randomInteger(30, 40)
            }
        };

        // setup request intercept
        await page.setRequestInterception(true);

        // setup mixpanel
        await utils.setMixpanelToken(page, 'test-token');

        // listen for track requests
        var trackRequests = utils.waitForPuppeteerRequests(page, 2, 'https://api.mixpanel.com/track');

        // send event
        await utils.sendMixpanelEvent(page, event1.name, event1.data);

        // setup mixpanel (2nd time should trigger device_id logic which pulls from storage)
        await utils.setMixpanelToken(page, 'test-token');

        // send event
        await utils.sendMixpanelEvent(page, event2.name, event2.data);

        // wait for requests to be sent
        var results = await trackRequests;

        // get the data sent via tracking request
        var eventPayload1 = utils.getJsonPayloadFromMixpanelUrl(results[0].url);
        var eventPayload2 = utils.getJsonPayloadFromMixpanelUrl(results[1].url);

        // should have the correct event names
        expect(eventPayload1.event).toEqual(event1.name);
        expect(eventPayload2.event).toEqual(event2.name);

        // should have correct event data
        expect(eventPayload1.properties.age).toEqual(event1.data.age);
        expect(eventPayload2.properties.age).toEqual(event2.data.age);

        // should have different distinct_id (one for each call to mixpanel.init)
        expect(eventPayload2.properties.distinct_id).not.toEqual(eventPayload1.properties.distinct_id);

        // should have same device_id (second call, gets value from localStorage)
        expect(eventPayload2.properties.$device_id).toEqual(eventPayload1.properties.$device_id);
    });

    it('should use a unique $insert_id for each event', async function() {

        // setup request intercept
        await page.setRequestInterception(true);

        // setup mixpanel
        await utils.setMixpanelToken(page, 'test-token');

        // listen for track requests
        var trackRequests = utils.waitForPuppeteerRequests(page, 2, 'https://api.mixpanel.com/track');

        // send events
        await utils.sendMixpanelEvent(page, 'event1', { eventNumber: 1 });
        await utils.sendMixpanelEvent(page, 'event2', { eventNumber: 2 });
        await utils.sendMixpanelEvent(page, 'event3', { eventNumber: 3 });

        // wait for requests to be sent
        var results = await trackRequests;

        // get the data sent via tracking request
        var eventPayload1 = utils.getJsonPayloadFromMixpanelUrl(results[0].url);
        var eventPayload2 = utils.getJsonPayloadFromMixpanelUrl(results[1].url);

        // should have the correct event names
        expect(eventPayload1.event).toEqual('event1');
        expect(eventPayload2.event).toEqual('event2');

        // should have different $insert_id values
        expect(eventPayload1.properties.$insert_id).toBeDefined();
        expect(eventPayload2.properties.$insert_id).toBeDefined();
        expect(eventPayload1.properties.$insert_id).not.toEqual(eventPayload2.properties.$insert_id);
    });
});
