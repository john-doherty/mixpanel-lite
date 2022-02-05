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

module.exports = {
    sleep: sleep,
    randomInteger: randomInteger
};
