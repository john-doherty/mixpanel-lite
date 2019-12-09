/*!
 * mixpanel-lite.js - v@version@
 * Lightweight version of mixpanel-js with offline support
 * https://github.com/john-doherty/mixpanel-lite
 * @author John Doherty <www.johndoherty.info>
 * @license MIT
 */
(function (window, document) {

    'use strict';

    if (!window.localStorage) throw new Error('localStorage not supported');
    if (!window.Promise) throw new Error('Promise not supported (try adding a polyfill)');

    var _trackingUrl = 'https://api.mixpanel.com/track/?data=';
    var _token = null;

    // holds a copy of current request properties
    var _properties = {};

    function init(token) {

        if (!token || token.trim() === '') throw new Error('Invalid Mixpanel token');

        _token = token;

        var uuid = getNewUUID();

        _properties = {
            token: token,
            $current_url: window.location.href,
            $os: getOS(),
            $browser: getBrowser(),
            $browser_version: getBrowserVersion(),
            $device: getDevice(),
            $screen_height: screen.height,
            $screen_width: screen.width,
            $referrer: document.referrer,
            $referring_domain: getReferringDomain(),
            distinct_id: uuid,
            $device_id: uuid
        };

        console.log('Mixpanel.init(\'' + _token + '\')');
    }

    // clear all properties but token
    function reset() {
        init(_token);
        console.log('Mixpanel.reset()');
    }

    /**
    * Classic Mixpanel.track method
    * @param {string} eventName - name of the event
    * @param {object} data - additional data to send with the event
    */
    function track(eventName, data) {

        if (!_token) throw new Error('You must call Mixpanel.init(token) first');
        if (!eventName || eventName === '') throw new Error('Invalid eventName');
        if (data && typeof data !== 'object') throw new Error('Data param must be an object');

        // user does not want to be tracked, exit
        if (navigator.doNotTrack == 1) return;

        var eventData = {
            event: eventName,
            properties: cloneObject(_properties)
        };

        // add custom event data
        Object.keys(data || {}).forEach(function(key) {
            eventData.properties[key] = data[key];
        });

        // add epoch time in seconds
        eventData.properties.time = Date.now() / 1000;

        // remove empty properties
        Object.keys(eventData.properties).forEach(function(key) {
            if (!eventData.properties[key] || eventData.properties[key] === '') {
                delete eventData.properties[key];
            }
        });

        // save the event
        transactions.add(eventData);

        // attempt to send
        send();

        if (data) {
            console.log('Mixpanel.track(\'' + eventName + '\',' + JSON.stringify(data || {}) + ')');
        }
        else {
            console.log('Mixpanel.track(\'' + eventName + '\')');
        }
    }

    /**
     * Assigns a user an identify (use this when the user has logged in)
     * @param {string} id - user identity in your system, could be email address
     */
    function identify(id) {

        if (!id || id.trim() === '') throw new Error('Invalid id');

        track('$identify', {
            distinct_id: id,
            $anon_distinct_id: _properties.distinct_id
        });

        // change the value for future requests
        _properties.distinct_id = id;

        console.log('Mixpanel.identify(\'' + id + '\')');
    }

    /**
    * Sends pending events to Mixpanel API
    */
    function send() {

        var items = transactions.all();

        // convert each pending transaction into a request promise
        var requests = items.map(function(item) {

            // we have to return a function to execute in sequence, otherwise they'll execute immediately
            return function() {

                // generate mixpanel URL
                var url = _trackingUrl + base64Encode(JSON.stringify(item)) + '&ip=1&_' + new Date().getTime();

                // mark item as not complete, in case it fails
                item.__completed = false;

                // execute the request
                return httpGet(url).then(function() {

                    // mark item as completed
                    item.__completed = true;
                })
                .catch(function(err) {
                    // failed, ensure it's not marked as complete
                    delete item.__completed;
                });
            };
        });

        // execute requests in order, if any fail, stop executing as we need transactions to be in order
        return promisesInSequence(requests).then(function() {

            // remove completed requests
            var incompleteRequests = items.filter(function(item) {
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
        all: function() {
            return JSON.parse(localStorage.getItem(transactions._key) || '[]');
        },

        // adds an item to the transaction log
        add: function(data) {

            // get existing transactions
            var existing = transactions.all();

            // add latest to end of stack
            existing.push(data);

            // save changes
            localStorage.setItem(transactions._key, JSON.stringify(existing));
        },

        // clears any pending transactions
        clear: function() {
            localStorage.setItem(transactions._key, JSON.stringify([]));
        },

        // replaces all transactions with new items
        reset: function(items) {
            localStorage.setItem(transactions._key, JSON.stringify(items || []));
        }
    };

    /**
     * Gets the device type iPad, iPhone etc
     */
    function getDevice() {

        var ua = navigator.userAgent;

        if (/Windows Phone/i.test(ua) || /WPDesktop/.test(ua)) {
            return 'Windows Phone';
        } else if (/iPad/.test(ua)) {
            return 'iPad';
        } else if (/iPod/.test(ua)) {
            return 'iPod Touch';
        } else if (/iPhone/.test(ua)) {
            return 'iPhone';
        } else if (/(BlackBerry|PlayBook|BB10)/i.test(ua)) {
            return 'BlackBerry';
        } else if (/Android/.test(ua)) {
            return 'Android';
        } else {
            return '';
        }
    }

    /**
     * Gets the Operating System
     */
    function getOS() {

        var ua = navigator.userAgent;

        if (/Windows/i.test(ua)) {
            if (/Phone/.test(ua) || /WPDesktop/.test(ua)) {
                return 'Windows Phone';
            }
            return 'Windows';
        } else if (/(iPhone|iPad|iPod)/.test(ua)) {
            return 'iOS';
        } else if (/Android/.test(ua)) {
            return 'Android';
        } else if (/(BlackBerry|PlayBook|BB10)/i.test(ua)) {
            return 'BlackBerry';
        } else if (/Mac/i.test(ua)) {
            return 'Mac OS X';
        } else if (/Linux/.test(ua)) {
            return 'Linux';
        } else if (/CrOS/.test(ua)) {
            return 'Chrome OS';
        } else {
            return '';
        }
    }

    /**
     * This function detects which browser is running this script.
     * The order of the checks are important since many user agents
     * include key words used in later checks.
     */
    function getBrowser() {

        var ua = navigator.userAgent;
        var vendor = navigator.vendor;
        var opera = window.opera;

        function includes(str, needle) {
            return str.indexOf(needle) !== -1;
        };
        
        vendor = vendor || ''; // vendor is undefined for at least IE9
        if (opera || includes(ua, ' OPR/')) {
            if (includes(ua, 'Mini')) {
                return 'Opera Mini';
            }
            return 'Opera';
        } else if (/(BlackBerry|PlayBook|BB10)/i.test(ua)) {
            return 'BlackBerry';
        } else if (includes(ua, 'IEMobile') || includes(ua, 'WPDesktop')) {
            return 'Internet Explorer Mobile';
        } else if (includes(ua, 'Edge')) {
            return 'Microsoft Edge';
        } else if (includes(ua, 'FBIOS')) {
            return 'Facebook Mobile';
        } else if (includes(ua, 'Chrome')) {
            return 'Chrome';
        } else if (includes(ua, 'CriOS')) {
            return 'Chrome iOS';
        } else if (includes(ua, 'UCWEB') || includes(ua, 'UCBrowser')) {
            return 'UC Browser';
        } else if (includes(ua, 'FxiOS')) {
            return 'Firefox iOS';
        } else if (includes(vendor, 'Apple')) {
            if (includes(ua, 'Mobile')) {
                return 'Mobile Safari';
            }
            return 'Safari';
        } else if (includes(ua, 'Android')) {
            return 'Android Mobile';
        } else if (includes(ua, 'Konqueror')) {
            return 'Konqueror';
        } else if (includes(ua, 'Firefox')) {
            return 'Firefox';
        } else if (includes(ua, 'MSIE') || includes(ua, 'Trident/')) {
            return 'Internet Explorer';
        } else if (includes(ua, 'Gecko')) {
            return 'Mozilla';
        } else {
            return '';
        }
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
            'UC Browser' : /(UCBrowser|UCWEB)\/(\d+(\.\d+)?)/,
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

        return new Promise(function(resolve, reject) {

            var xhr = new XMLHttpRequest();

            xhr.open('GET', url);
            xhr.withCredentials = true;
            xhr.onreadystatechange = function() {
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
        var T = function() {
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
        var R = function() {
            return Math.random().toString(16).replace('.', '');
        };

        // User agent entropy
        // This function takes the user agent string, and then xors
        // together each sequence of 8 bytes.  This produces a final
        // sequence of 8 bytes which it returns as hex.
        var UA = function() {
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
     * Converts a string to base64
     * @param {string} data - value to base64 encode
     * @returns {string} base64 encoded string
     */
    function base64Encode(data) {
        var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
            ac = 0,
            enc = '',
            tmp_arr = [];

        if (!data) {
            return data;
        }

        data = utf8Encode(data);

        do { // pack three octets into four hexets
            o1 = data.charCodeAt(i++);
            o2 = data.charCodeAt(i++);
            o3 = data.charCodeAt(i++);

            bits = o1 << 16 | o2 << 8 | o3;

            h1 = bits >> 18 & 0x3f;
            h2 = bits >> 12 & 0x3f;
            h3 = bits >> 6 & 0x3f;
            h4 = bits & 0x3f;

            // use hexets to index into b64, and append result to encoded string
            tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
        } while (i < data.length);

        enc = tmp_arr.join('');

        switch (data.length % 3) {
            case 1:
                enc = enc.slice(0, -2) + '==';
                break;
            case 2:
                enc = enc.slice(0, -1) + '=';
                break;
        }

        return enc;
    };

    function utf8Encode(string) {
        string = (string + '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        var utftext = '',
            start,
            end;
        var stringl = 0,
            n;

        start = end = 0;
        stringl = string.length;

        for (n = 0; n < stringl; n++) {
            var c1 = string.charCodeAt(n);
            var enc = null;

            if (c1 < 128) {
                end++;
            } else if ((c1 > 127) && (c1 < 2048)) {
                enc = String.fromCharCode((c1 >> 6) | 192, (c1 & 63) | 128);
            } else {
                enc = String.fromCharCode((c1 >> 12) | 224, ((c1 >> 6) & 63) | 128, (c1 & 63) | 128);
            }
            if (enc !== null) {
                if (end > start) {
                    utftext += string.substring(start, end);
                }
                utftext += enc;
                start = end = n + 1;
            }
        }

        if (end > start) {
            utftext += string.substring(start, string.length);
        }

        return utftext;
    }

    /* #endregion */

    // if we are running in cordova use ondeviceready otherwise onload
    window.addEventListener((window.cordova) ? 'deviceready': 'load', send, { passive: true });

    // always send pending request when the connection comes back online
    window.addEventListener('online', send, { passive: true });

    // expose mixpanel methods
    window.mixpanel = {
        init: init,
        track: track,
        reset: reset,
        identify: identify
    };

})(this, document);
