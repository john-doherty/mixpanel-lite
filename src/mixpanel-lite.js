/*!
 * mixpanel-lite.js - v@version@
 * Lightweight version of mixpanel-js with offline support
 * https://github.com/john-doherty/mixpanel-lite
 * @author John Doherty <www.johndoherty.info>
 * @license MIT
 */
(function (window, document) {

    'use strict';

    if (!window.localStorage) {
        console.warn('mixpanel-lite: localStorage not supported');
        return;
    }

    if (!window.Promise) {
        console.warn('mixpanel-lite: Promise not supported (try adding a polyfill)');
        return;
    }

    var _trackingUrl = 'https://api.mixpanel.com/track?ip=1&verbose=1&data=';
    var _engageUrl = 'https://api.mixpanel.com/engage?ip=1&verbose=1&data=';
    var _token = null;
    var _debugging = false;

    // holds a copy of current request properties
    var _properties = {};

    /**
     * Sets up in memory properties to be sent with each request
     * @param {string} token - mixpanel token
     * @param {object} opts - options { debug: true }
     * @returns {void}
     */
    function init(token, opts) {

        token = String(token || '');

        if (token === '') {
            console.warn('mixpanel.init: Invalid token');
            return;
        }

        _token = token;
        _debugging = ((opts || {}).debug === true);

        var uuid = getNewUUID();

        // params -> https://help.mixpanel.com/hc/en-us/articles/115004613766-Default-Properties-Collected-by-Mixpanel
        _properties = {
            token: token,
            $os: getOS(),
            $browser: getBrowser(),
            $browser_version: getBrowserVersion(),
            $device: getDevice(),
            $screen_height: screen.height,
            $screen_width: screen.width,
            $referrer: document.referrer,
            $referring_domain: getReferringDomain(),
            distinct_id: uuid,
            $device_id: uuid,
            mp_lib: 'mixpanel-lite',
            $lib_version: '1.0.5'
        };

        // only track page URL's
        if (String(window.location.protocol).indexOf('http') === 0) {
            _properties.$current_url = window.location.href;
        }

        if (window.device) {

            if (window.device.manufacturer) {
                _properties.$manufacturer = window.device.manufacturer;
            }

            if (window.device.model) {
                _properties.$model = window.device.model;
            }

            if (window.device.version) {
                _properties.$os_version = window.device.version;
            }
        }

        // attempt to resolve connection type
        _properties.connectionType = getConnectionType();

        // listen for connection change events (only available in w3c implementation)
        var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

        if (connection && connection.addEventListener) {

            // update connection when it changes
            connection.addEventListener('change', function() {
                _properties.connectionType = getConnectionType();
            });
        }

        if (_debugging) {
            console.log('mixpanel.init(\'' + _token + '\')');
        }

        return true;
    }

    /**
     * Attempt to get the network connection type from w3c NetworkInformation or cordova-plugin-network-information
     * @returns {string} connection type or empty
     */
    function getConnectionType() {
        var connection = (navigator.connection || navigator.mozConnection || navigator.webkitConnection || {});

        return connection.effectiveType || connection.type || '';
    }

    /**
    * Clears super properties and generates a new random distinct_id for this instance.
    * Useful for clearing data when a user logs out.
    */
    function reset() {
        init(_token);

        if (_debugging) {
            console.log('mixpanel.reset()');
        }
    }

    /**
    * Track an event.
     * @param {String} eventName The name of the event. This can be anything the user does - 'Button Click', 'Sign Up', 'Item Purchased', etc.
     * @param {Object} [data] A set of properties to include with the event you're sending. These describe the user who did the event or details about the event itself.
     * @returns {void}
    */
    function track(eventName, data) {

        if (!_token) {
            console.warn('mixpanel.track: You must call mixpanel.init(token) first');
            return;
        }

        if (!eventName || eventName === '') {
            console.warn('mixpanel.track: Invalid eventName');
            return;
        }

        if (data && typeof data !== 'object') {
            console.warn('mixpanel.track: Data param must be an object');
            return;
        }

        // user does not want to be tracked, exit
        if (navigator.doNotTrack == 1) return;

        var eventData = {
            event: eventName,
            properties: cloneObject(_properties)
        };

        // add custom event data
        Object.keys(data || {}).forEach(function (key) {
            eventData.properties[key] = data[key];
        });

        // remove empty properties
        Object.keys(eventData.properties).forEach(function (key) {
            if (eventData.properties[key] === null || eventData.properties[key] === '') {
                delete eventData.properties[key];
            }
        });

        // save the event
        transactions.add(eventData);

        // attempt to send
        send();

        if (_debugging) {
            if (data) {
                console.log('mixpanel.track(\'' + eventName + '\',' + JSON.stringify(data || {}) + ')');
            }
            else {
                console.log('mixpanel.track(\'' + eventName + '\')');
            }
            console.dir(eventData);
        }
    }

    /**
     * Identify a user with a unique ID instead of a Mixpanel randomly generated distinct_id.
     * If the method is never called, unique visitors will be identified by a UUID generated the first time they visit the site.
     * @param {String} [id] A string that uniquely identifies a user. If not provided, the distinct_id from localStorage is used.
     * @returns {void}
     */
    function identify(id) {

        if (!id || id.trim() === '') {
            console.warn('mixpanel.identify: Invalid id');
            return;
        }

        if (_debugging) {
            console.log('mixpanel.identify(\'' + id + '\')');
        }

        // send identity request with old distinct id
        track('$identify', {
            $anon_distinct_id: _properties.distinct_id,
            distinct_id: id,
            $user_id: id
        });

        // change values for future requests
        _properties.distinct_id = id;
        _properties.$user_id = id;
    }

    /**
     * set properties on an user record in engage
     * @param {object} data - properties to set
     * @returns {void}
     */
    function setPeople(data) {

        if (!data || typeof data !== 'object') {
            console.warn('mixpanel.setPeople: Invalid data param, must be an object');
            return;
        }

        // user does not want to be tracked, exit
        if (navigator.doNotTrack == 1) return;

        var eventData = {
            $token: _token,
            $distinct_id: _properties.distinct_id,
            $set: {}
        };

        // add custom event data
        Object.keys(data || {}).forEach(function (key) {
            eventData.$set[key] = data[key];
        });

        // remove empty properties
        Object.keys(eventData.$set).forEach(function (key) {
            if (eventData.$set[key] === null || eventData.$set[key] === '') {
                delete eventData.$set[key];
            }
        });

        // save the event
        transactions.add(eventData);

        // attempt to send
        send();

        if (_debugging) {
            console.log('mixpanel.people.set(' + JSON.stringify(data || {}) + ')');
            console.dir(eventData);
        }
    }

    /**
    * Sends pending events to Mixpanel API
    */
    function send() {

        var items = transactions.all();

        // convert each pending transaction into a request promise
        var requests = items.map(function (item) {

            // we have to return a function to execute in sequence, otherwise they'll execute immediately
            return function () {

                // depending on the update type, change the API URL (hacky)
                var url = (item.$set) ? _engageUrl : _trackingUrl;

                // encode the data so it can be sent via a HTTP GET (avoids preflight headers)
                var dataToSend = base64Encode(JSON.stringify(item));

                // generate mixpanel URL (add timestamp to make it unique)
                url += encodeURIComponent(dataToSend) + '&_=' + new Date().getTime();

                // mark item as not complete, in case it fails
                item.__completed = false;

                // execute the request
                return httpGet(url).then(function () {

                    // mark item as completed
                    item.__completed = true;
                });
            };
        });

        // execute requests in order, if any fail, stop executing as we need transactions to be in order
        return promisesInSequence(requests).then(function () {

            // remove completed requests
            var incompleteRequests = items.filter(function (item) {
                return !item.__completed;
            });

            // save incomplete requests for next time
            transactions.reset(incompleteRequests);
        });
    }

    /* #region Helpers */

    function cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Executes an array of function that return a promise in sequence
     * @param {Array} promises - array of functions that return a promise
     * @returns {Promise} executes .then if all resolve otherwise .catch
     */
    function promisesInSequence(promises) {
        var result = Promise.resolve();

        promises.forEach(function (promise) {
            result = result.then(promise);
        });

        return result;
    }

    /**
     * local storage helper for saving transactions in order
     */
    var transactions = {

        _key: 'mixpanel-lite',

        // returns a list of all transactions or emmpty array
        all: function () {
            return JSON.parse(localStorage.getItem(transactions._key) || '[]');
        },

        // adds an item to the transaction log
        add: function (data) {

            // get existing transactions
            var existing = transactions.all();

            // add latest to end of stack
            existing.push(data);

            // save changes
            localStorage.setItem(transactions._key, JSON.stringify(existing));
        },

        // clears any pending transactions
        clear: function () {
            localStorage.setItem(transactions._key, JSON.stringify([]));
        },

        // replaces all transactions with new items
        reset: function (items) {
            localStorage.setItem(transactions._key, JSON.stringify(items || []));
        }
    };

    /**
     * Gets the device type iPad, iPhone etc
     */
    function getDevice() {

        var ua = navigator.userAgent;

        if (/Windows Phone/i.test(ua) || /WPDesktop/.test(ua)) return 'Windows Phone';
        if (/iPad/.test(ua)) return 'iPad';
        if (/iPod/.test(ua)) return 'iPod Touch';
        if (/iPhone/.test(ua)) return 'iPhone';
        if (/(BlackBerry|PlayBook|BB10)/i.test(ua)) return 'BlackBerry';
        if (/Android/.test(ua)) return 'Android';
        return '';
    }

    /**
     * Gets the Operating System
     */
    function getOS() {

        var ua = navigator.userAgent;

        if (/Windows/i.test(ua)) return (/Phone/.test(ua) || /WPDesktop/.test(ua)) ? 'Windows Phone' : 'Windows';
        if (/(iPhone|iPad|iPod)/.test(ua)) return 'iOS';
        if (/Android/.test(ua)) return 'Android';
        if (/(BlackBerry|PlayBook|BB10)/i.test(ua)) return 'BlackBerry';
        if (/Mac/i.test(ua)) return 'Mac OS X';
        if (/Linux/.test(ua)) return 'Linux';
        if (/CrOS/.test(ua)) return 'Chrome OS';
        return '';
    }

    /**
     * This function detects which browser is running this script.
     * The order of the checks are important since many user agents
     * include key words used in later checks.
     */
    function getBrowser() {

        var ua = navigator.userAgent;
        var vendor = navigator.vendor || ''; // vendor is undefined for at least IE9
        var opera = window.opera;

        // internal helper
        function includes(str, needle) {
            return str.indexOf(needle) !== -1;
        }

        if (opera || includes(ua, ' OPR/')) return (includes(ua, 'Mini')) ? 'Opera Mini' : 'Opera';
        if (/(BlackBerry|PlayBook|BB10)/i.test(ua)) return 'BlackBerry';
        if (includes(ua, 'IEMobile') || includes(ua, 'WPDesktop')) return 'Internet Explorer Mobile';
        if (includes(ua, 'Edge')) return 'Microsoft Edge';
        if (includes(ua, 'FBIOS')) return 'Facebook Mobile';
        if (includes(ua, 'Chrome')) return 'Chrome';
        if (includes(ua, 'CriOS')) return 'Chrome iOS';
        if (includes(ua, 'UCWEB') || includes(ua, 'UCBrowser')) return 'UC Browser';
        if (includes(ua, 'FxiOS')) return 'Firefox iOS';
        if (includes(vendor, 'Apple')) return (includes(ua, 'Mobile')) ? 'Mobile Safari' : 'Safari';
        if (includes(ua, 'Android')) return 'Android Mobile';
        if (includes(ua, 'Konqueror')) return 'Konqueror';
        if (includes(ua, 'Firefox')) return 'Firefox';
        if (includes(ua, 'MSIE') || includes(ua, 'Trident/')) return 'Internet Explorer';
        if (includes(ua, 'Gecko')) return 'Mozilla';
        return '';
    }

    /**
     * This function detects which browser version is running this script,
     * parsing major and minor version (e.g., 42.1). User agent strings from:
     * http://www.useragentstring.com/pages/useragentstring.php
     */
    function getBrowserVersion() {

        var browser = getBrowser();
        var ua = navigator.userAgent;

        var versionRegexs = {
            'Internet Explorer Mobile': /rv:(\d+(\.\d+)?)/,
            'Microsoft Edge': /Edge\/(\d+(\.\d+)?)/,
            'Chrome': /Chrome\/(\d+(\.\d+)?)/,
            'Chrome iOS': /CriOS\/(\d+(\.\d+)?)/,
            'UC Browser': /(UCBrowser|UCWEB)\/(\d+(\.\d+)?)/,
            'Safari': /Version\/(\d+(\.\d+)?)/,
            'Mobile Safari': /Version\/(\d+(\.\d+)?)/,
            'Opera': /(Opera|OPR)\/(\d+(\.\d+)?)/,
            'Firefox': /Firefox\/(\d+(\.\d+)?)/,
            'Firefox iOS': /FxiOS\/(\d+(\.\d+)?)/,
            'Konqueror': /Konqueror:(\d+(\.\d+)?)/,
            'BlackBerry': /BlackBerry (\d+(\.\d+)?)/,
            'Android Mobile': /android\s(\d+(\.\d+)?)/,
            'Internet Explorer': /(rv:|MSIE )(\d+(\.\d+)?)/,
            'Mozilla': /rv:(\d+(\.\d+)?)/
        };
        var regex = versionRegexs[browser];
        if (regex === undefined) {
            return null;
        }
        var matches = ua.match(regex);
        if (!matches) {
            return null;
        }
        return parseFloat(matches[matches.length - 2]);
    }

    /**
     * Gets the referring domain
     */
    function getReferringDomain() {
        var split = String(document.referrer || '').split('/');
        if (split.length >= 3) {
            return split[2];
        }
        return '';
    }

    /**
     * Executes a HTTP GET request within a promise
     * @param {string} url - url to get
     * @returns {Promise} executes .then if successful otherwise .catch
     */
    function httpGet(url) {

        return new Promise(function (resolve, reject) {

            var xhr = new XMLHttpRequest();

            xhr.open('GET', url);
            xhr.withCredentials = true;
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText !== '')) {
                        resolve({
                            url: url,
                            status: 200,
                            body: xhr.responseText || ''
                        })
                    }
                    else {
                        reject({
                            url: url,
                            status: xhr.status,
                            body: xhr.responseText || ''
                        });
                    }
                }
            };

            xhr.send();
        });
    }

    /**
     * Generates a new distinct_id (code lifted from Mixpanel js)
     * @returns {string} new UUID (example 16ee796360f641-0900a3aecd5282-3963720f-13c680-16ee7963610a3a)
     */
    function getNewUUID() {

        // Time/ticks information
        // 1*new Date() is a cross browser version of Date.now()
        var T = function () {
            var d = 1 * new Date(),
                i = 0;

            // this while loop figures how many browser ticks go by
            // before 1*new Date() returns a new number, ie the amount
            // of ticks that go by per millisecond
            while (d == 1 * new Date()) {
                i++;
            }

            return d.toString(16) + i.toString(16);
        };

        // Math.Random entropy
        var R = function () {
            return Math.random().toString(16).replace('.', '');
        };

        // User agent entropy
        // This function takes the user agent string, and then xors
        // together each sequence of 8 bytes.  This produces a final
        // sequence of 8 bytes which it returns as hex.
        var UA = function () {
            var ua = navigator.userAgent,
                i, ch, buffer = [],
                ret = 0;

            function xor(result, byte_array) {
                var j, tmp = 0;
                for (j = 0; j < byte_array.length; j++) {
                    tmp |= (buffer[j] << j * 8);
                }
                return result ^ tmp;
            }

            for (i = 0; i < ua.length; i++) {
                ch = ua.charCodeAt(i);
                buffer.unshift(ch & 0xFF);
                if (buffer.length >= 4) {
                    ret = xor(ret, buffer);
                    buffer = [];
                }
            }

            if (buffer.length > 0) {
                ret = xor(ret, buffer);
            }

            return ret.toString(16);
        };

        var se = (screen.height * screen.width).toString(16);
        return (T() + '-' + R() + '-' + UA() + '-' + se + '-' + T());
    }

    /**
     * Base 64 encodes a string using btoa
     * @param {string} str - string to encode
     * @returns {string} containing padded base64 value
     */
    function base64Encode(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    }

    /* #endregion */

    // if we are running in cordova use ondeviceready otherwise onload
    window.addEventListener((window.cordova) ? 'deviceready' : 'load', send, { passive: true });

    // always send pending request when the connection comes back online
    window.addEventListener('online', send, { passive: true });

    /**
     * No operation (does nothing other than log to the console that mixpanel is muted)
     * @returns {void}
     */
    function noop() {
        console.warn('mixpanel muted');
    }

    // no operation interface, exposes method that do nothing
    var mutedInterface = {
        init: noop,
        track: noop,
        reset: noop,
        identify: noop,
        people: {
            set: noop
        },
        mute: noop,
        unmute: unmute
    };

    // operational interface, exposes methods that talk to mixpanel
    var unmutedInterface = {
        init: init,
        track: track,
        reset: reset,
        identify: identify,
        people: {
            set: setPeople
        },
        mute: mute,
        unmute: noop
    };

    /**
     * Mutes mixpanel by overriding public methods with empty functions
     * @returns {void}
     */
    function mute() {
        window.mixpanel = mutedInterface;
    }

    /**
     * Restores mixpanel function after a call to mixpanel.mute allowing data to be sent to mixpanel
     * @returns {void}
     */
    function unmute() {
        window.mixpanel = unmutedInterface;
    }

    // expose mixpanel methods
    window.mixpanel = unmutedInterface;

}(this, document));
