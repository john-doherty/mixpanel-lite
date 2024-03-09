/**
 * Get a random number between min and max
 * @param {integer} min - minimum number
 * @param {integer} max - maximum number
 * @returns {integer} random number
 */
function randomInteger(min, max) {
    return Math.floor(Math.random() * ((max - min) + 1)) + min;
}

/**
 * returns a promise that is fulfilled after interval has passed
 * @param {integer} timeoutInMs - timeout in milliseconds
 * @return {Promise} resolved when timeout is reached
 */
function sleep(timeoutInMs) {
    return new Promise(function (resolve) {
        setTimeout(resolve, timeoutInMs);
    });
}

/**
 * Setup mixpanel with a token
 * @param {object} puppeteerPage - puppeteer page
 * @param {string} mixpanelToken - token
 * @returns {void}
 */
async function setMixpanelToken(puppeteerPage, mixpanelToken) {

    return puppeteerPage.evaluate(function (token) {
        window.mixpanel.init(token);
    }, mixpanelToken);
}

/**
 * Send an event to Mixpanel in the browser
 * @param {object} puppeteerPage - puppeteer page
 * @param {string} eventName - mixpanel event name
 * @param {object} eventData - mixpanel event data
 * @returns {void}
 */
async function sendMixpanelEvent(puppeteerPage, eventName, eventData) {

    return puppeteerPage.evaluate(function (name, data) {
        window.mixpanel.track(name, data);
    }, eventName, eventData);
}

/**
 * Get the value of `mixpanel-lite` in LocalStorage
 * @param {object} puppeteerPage - puppeteer page
 * @returns {object} mixpanel local storage object
 */
async function getMixpanelLocalStorage(puppeteerPage) {
    // get value of local storage
    return puppeteerPage.evaluate(function () {
        return JSON.parse(localStorage.getItem('mixpanel-lite') || {});
    });
}

/**
 * Creates a promise that resolves when a specific number of Puppeteer request events are received.
 * The promise resolves with an array of objects, each containing the URL, method, and postData of each request.
 * The function can filter events based on a requested URL (excluding query parameters) and request method.
 * @example
 * // Example of calling the function with a URL
 * waitForPuppeteerRequests(page, 5, 'https://example.com/api/data', 'post').then(...)
 *
 * @example
 * // Example of calling the function without a URL (listening to all requests)
 * waitForPuppeteerRequests(page, 3, null, 'GET').then(...)
 *
 * @param {Object} page - The Puppeteer page object to attach the request listeners to.
 * @param {number} requestCount - The number of events to wait for before resolving the promise.
 * @param {string} [requestedUrl] - Optional. If provided, only requests to this URL (excluding query parameters) will be considered.
 * @param {string} [requestMethod='GET'] - Optional. The HTTP method to filter the requests. Defaults to 'GET'.
 * @returns {Promise} A promise that resolves with the details of the requests.
 */
function waitForPuppeteerRequests(page, requestCount, requestedUrl, requestMethod) {
    requestMethod = (requestMethod || 'GET').toUpperCase();
    var requestDetails = [];

    var allRequestsCollected = new Promise(function (resolve) {

        // Function to handle each request
        var handleRequest = function (request) {
            if (requestDetails.length >= requestCount) {
                return;
            }

            var url = request.url();
            var parsedUrl = new URL(url);
            var baseUrl = parsedUrl.origin + parsedUrl.pathname;
            var method = request.method().toUpperCase();
            var postData = request.postData();

            // match URL without query params
            if ((!requestedUrl || baseUrl === requestedUrl) && method === requestMethod) {

                // store the response
                requestDetails.push({ url: url, method: method, postData: postData });

                if (requestDetails.length === requestCount) {
                    resolve(requestDetails);
                }
            }

            request.continue();
        };

        // Attach the listener to the page object
        page.on('request', handleRequest);
    });

    return allRequestsCollected;
}

/**
 * Extracts the value of a specific query parameter from a given URL.
 * If the parameter does not exist, returns an empty string.
 *
 * @param {string} url - The URL from which to extract the parameter value.
 * @param {string} paramName - The name of the query parameter to extract.
 * @returns {string} The value of the query parameter if it exists, otherwise an empty string.
 */
function getQueryParamValue(url, paramName) {
    var urlObj = new URL(url);
    var paramValue = urlObj.searchParams.get(paramName);
    return paramValue !== null ? paramValue : '';
}

module.exports = {
    sleep: sleep,
    randomInteger: randomInteger,
    setMixpanelToken: setMixpanelToken,
    sendMixpanelEvent: sendMixpanelEvent,
    waitForPuppeteerRequests: waitForPuppeteerRequests,
    getMixpanelLocalStorage: getMixpanelLocalStorage,
    getQueryParamValue: getQueryParamValue
};
