# mixpanel-lite

[![Build Status](https://github.com/john-doherty/mixpanel-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/john-doherty/mixpanel-lite/actions/workflows/ci.yml)

A lightweight _(2.9k)_ alternative to [mixpanel-js](https://github.com/mixpanel/mixpanel-js) with offline support for Hybrid and Progressive Web Apps.

Events are written to localStorage first and are only removed once the Mixpanel [HTTP API](https://developer.mixpanel.com/docs/http) confirms receipt, thus allowing the device to go offline without losing events.

## Usage

Add [mixpanel-lite.min.js](dist/mixpanel-lite.min.js) to your project:

```html
<script src="mixpanel-lite.min.js"></script>
```

At present only the following methods are supported:

```js
// setup mixpanel
mixpanel.init('your-token-here'); // pass { mute: true } to mute by default

// assign all future events to a user
mixpanel.identify('user@email.com');

// register 'Gender' as a super property
mixpanel.register({'Gender': 'Female'});

// assign user info
mixpanel.people.set({
    $email: 'user@email.com' // only special properties need the $
});

// track an event
mixpanel.track('Your Event Name' {
    firstName: 'Optional event property 1',
    lastName: 'Optional event property 2'
});

// get super property
mixpanel.getProperty('distinct_id');

// clear current identity
mixpanel.reset();

// stop sending data to mixpanel (calls to track, identify etc are ignored)
mixpanel.mute();

// resume sending data to mixpanel
mixpanel.unmute();

// check if mixpanel is muted
if (mixpanel.muted) {
    console.log('Mixpanel is disabled');
}
```

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
