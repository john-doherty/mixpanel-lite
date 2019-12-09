# mixpanel-lite

A lightweight version of [mixpanel-js](https://github.com/mixpanel/mixpanel-js) with added offline support, weighing in at 5.3k _(2.2k gzipped)_.

mixpanel-lite uses the Mixpanel [HTTP API](https://developer.mixpanel.com/docs/http). Requests are saved to localStorage `mixpanel-lite` first and are only removed from localStorage once the API confirms receipt, allowing the device to go on/offline without losing events.

The small footprint and offline first nature make it a good fit for Hybrid and Progressive Web Apps.

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

// assign user info
mixpanel.people.set({
    $email: 'user@email.com' // only special properties need the $
});

// track an event
mixpanel.track('Your Event Name' {
    firstName: 'Optional event property 1',
    lastName: 'Optional event property 2'
});

// clear current identity
mixpanel.reset();
```

_We can build this out overtime, but it might be best we keep it _lite__

## Contributing

Pull requests are welcomed:

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

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