var path = require('path');
var puppeteer = require('puppeteer');
var querystring = require('querystring');
var utils = require('./utils');

var url = 'file://' + path.join(__dirname, 'environment.html');
var page = null;
var browser = null;

describe('mixpanel-lite: .ad', function () {

    // create a new browser instance before each test
    beforeEach(async function () {

        // Launch a new browser instance
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // get page
        page = (await browser.pages())[0];
    });

    afterEach(async function () {

        return page.evaluate(function () {
            return localStorage.removeItem('mixpanel-lite');
        })
        .then(function () {
            return utils.sleep(500);
        })
        .then(function () {
            return browser.close();
        });
    });

    it('should send advert data to /track endpoint', async function () {
        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        // open page with UTM params
        await page.goto(url + '?dclid=randomDclidValue&fbclid=randomFbclidValue&gclid=randomGclidValue&ko_click_id=randomKoClickIdValue&li_fat_id=randomLiFatIdValue&msclkid=randomMsclkidValue&ttclid=randomTtclidValue&twclid=randomTwclidValue&wbraid=randomWbraidValue');

        await page.setRequestInterception(true);

        const requestPromise = new Promise((resolve, reject) => {
            page.once('request', function (request) {
                var requestUrl = request.url();
                var query = requestUrl.substr(requestUrl.indexOf('?') + 1);
                var params = querystring.parse(query);

                try {
                    // Assertions
                    expect(requestUrl.startsWith('https://api.mixpanel.com/track')).toBe(true);
                    expect(params).toBeDefined();
                    expect(params._).toBeDefined();
                    expect(params.data).toBeDefined();
                    expect(params.data).not.toEqual('');

                    var data = JSON.parse(Buffer.from(params.data, 'base64').toString('ascii'));

                    expect(data.event).toEqual(eventName);
                    expect(data.properties).toBeDefined();
                    expect(data.properties.distinct_id).toBeDefined();
                    expect(data.properties.$browser).toEqual('Chrome');
                    expect(data.properties.token).toEqual(token);
                    expect(data.properties.ad.dclid).toEqual('randomDclidValue');
                    expect(data.properties.ad.fbclid).toEqual('randomFbclidValue');
                    expect(data.properties.ad.ko_click_id).toEqual('randomKoClickIdValue');
                    expect(data.properties.ad.li_fat_id).toEqual('randomLiFatIdValue');
                    expect(data.properties.ad.msclkid).toEqual('randomMsclkidValue');
                    expect(data.properties.ad.ttclid).toEqual('randomTtclidValue');
                    expect(data.properties.ad.twclid).toEqual('randomTwclidValue');
                    expect(data.properties.ad.wbraid).toEqual('randomWbraidValue');

                    resolve(); // Resolve the promise after assertions
                }
                catch (error) {
                    reject(error); // Reject the promise if an assertion fails
                }
            });
        });

        // Trigger the tracking
        await page.evaluate(function (t, e) {
            window.mixpanel.init(t);
            window.mixpanel.track(e);
        }, token, eventName);

        // Wait for the requestPromise to resolve
        await requestPromise;
    });

    it('should NOT send advert data to /track endpoint', async function () {
        var now = (new Date()).getTime();
        var token = 'test-token-' + now;
        var eventName = 'test-event-' + now;

        // open page without UTM params
        await page.goto(url);

        await page.setRequestInterception(true);

        const requestPromise = new Promise((resolve, reject) => {
            page.once('request', function (request) {
                var requestUrl = request.url();
                var query = requestUrl.substr(requestUrl.indexOf('?') + 1);
                var params = querystring.parse(query);

                try {
                    // Assertions
                    expect(requestUrl.startsWith('https://api.mixpanel.com/track')).toBe(true);
                    expect(params).toBeDefined();
                    expect(params._).toBeDefined();
                    expect(params.data).toBeDefined();
                    expect(params.data).not.toEqual('');

                    var data = JSON.parse(Buffer.from(params.data, 'base64').toString('ascii'));

                    expect(data.event).toEqual(eventName);
                    expect(data.properties).toBeDefined();
                    expect(data.properties.distinct_id).toBeDefined();
                    expect(data.properties.$browser).toEqual('Chrome');
                    expect(data.properties.token).toEqual(token);

                    expect(data.properties.ad).toBeUndefined();

                    resolve(); // Resolve the promise after assertions
                }
                catch (error) {
                    reject(error); // Reject the promise if an assertion fails
                }
            });
        });

        // Trigger the tracking
        await page.evaluate(function (t, e) {
            window.mixpanel.init(t);
            window.mixpanel.track(e);
        }, token, eventName);

        // Wait for the requestPromise to resolve
        await requestPromise;
    });
});
