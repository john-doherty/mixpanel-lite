# mixpanel-lite

This is a lightweight version of [mixpanel-js](https://github.com/mixpanel/mixpanel-js) with offline support, weighing in at 6k _(2.6k gzipped)_.

## How offline works

mixpanel-lite uses the Mixpanel [HTTP API](https://developer.mixpanel.com/docs/http). Requests are saved to localStorage `mixpanel-lite` first and are only removed from localStorage once the API confirms receipt, allowing the device to go on/offline without losing events.

## Usage

Add [mixpanel-lite.min.js](dist/mixpanel-lite.min.js) to your project:

```html
<script src="mixpanel-lite.min.js"></script>
```

At present only the following methods are supported:

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

_We can build this out overtime, but it might be best we keep it _lite__

### Dependencies

mixpanel-lite uses `window.localStorage` and `window.Promise` which should exist in all modern browsers.

### Update .min files

To generate a new [mixpanel-lite.min.js](dist/mixpanel-lite.min.js) from source, tweak the version number in `package.json` and run:

```bash
npm run build
```

## Star the repo

Star the repo if you find this useful as it helps me prioritize which bugs I should tackle first.

## History

For change-log, check [releases](https://github.com/john-doherty/mixpanel-lite/releases).

## License

Licensed under [MIT License](LICENSE) &copy; [John Doherty](https://twitter.com/mrJohnDoherty)