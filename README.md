# mixpanel-lite

This is a lightweight version of [mixpanel-js](https://github.com/mixpanel/mixpanel-js) with offline support. It weighs in at at 5.2k _(2.2k gzipped)_.

## How offline works

mixpanel-lite uses the Mixpanel [HTTP API](https://developer.mixpanel.com/docs/http). Requests are saved to localStorage `mixpanel-lite` first and are only removed from localStorage once the API confirms receipt.

This allows the device to go on/offline without losing events.

## Usage

I've only added the methods I need, we can tweak this overtime but it might be best to keep it _lite_

```js
// setup mixpanel
mixpanel.init('your-token-here');

// assign all future events to a user
mixpanel.identify('user@email.com');

// track an event
mixpanel.track('Your Event Name' {
    firstName: 'Optional event property 1',
    lastName: 'Optional event property 2'
});

// clear current identity
mixpanel.reset();
```

### Dependencies

mixpanel-lite requires `window.localStorage` and `window.Promise`, these should exist in all modern browsers. An error will be thrown if they do not exist.

### Update .min files

To create a new version of the minified [mixpanel-lite.min.js](dist/mixpanel-lite.min.js) file from source, tweak the version number in `package.json` and run:

```bash
npm run build
```

## Star the repo

Star the repo if you find this useful as it helps me prioritize which bugs I should tackle first.

## History

For change-log, check [releases](https://github.com/john-doherty/mixpanel-lite/releases).

## License

Licensed under [MIT License](LICENSE) &copy; [John Doherty](https://twitter.com/mrJohnDoherty)