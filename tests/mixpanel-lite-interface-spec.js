var path = require('path');
var puppeteer = require('puppeteer');

var url = 'file://' + path.join(__dirname, 'environment.html');
var page = null;
var browser = null;

describe('mixpanel-lite interface', function () {

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
        return browser.close();
    });

    it('should expose the correct interface', async function () {

        return page.evaluate(function () {
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
        });
    });

    it('should return muted interface when muted', async function () {

        return page.evaluate(function () {
            window.mixpanel.init(null, { mute: true });
            return window.mixpanel;
        })
        .then(function (mixpanel) {
            expect(mixpanel).toBeDefined();
            expect(mixpanel.muted).toEqual(true);
        });
    });

    it('should issue warning if no token passed', function (done) {

        page.on('console', function (message) {
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
