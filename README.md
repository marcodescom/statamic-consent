# Consent for Statamic

Cookie banner, Google Analytics 4 with Google Consent Mode v2 (strict opt-in) and two-click consent gates for YouTube, Vimeo and Google Maps. One Composer package, one Antlers tag in the layout, no build step in the site.

- **Strict opt-in.** Consent Mode defaults (everything denied, `ads_data_redaction`) are pushed first. `gtag.js` is not requested before the visitor accepts statistics.
- **Categories.** `necessary` (always on), `statistics` (GA4), `media` (external media). The banner only lists the categories a site actually uses.
- **Gates.** Embeds sit inside `<template>` until consent: nothing is requested from Google, YouTube or Vimeo before (no thumbnails from their CDNs either). "Einmal laden" loads one embed without storing anything, "Immer erlauben" stores the media consent and opens every gate on the page. Withdrawing consent puts the placeholders back.
- **No cookie of its own.** The choice lives in `localStorage` with version, decision time and the categories asked. It expires after 12 months, on a version change, or when its time lies more than 24 hours in the future. A category added later is asked on its own.
- **Static caching friendly.** The HTML is the same for every visitor; the banner starts hidden and the script shows it.
- **Accessible and fair.** `role="dialog"`, labelled, keyboard operable, focus moves in when opened from the footer and returns afterwards, Escape closes only once a choice exists. "Alle akzeptieren" and "Nur notwendige" look exactly the same.
- **Standalone.** `dist/consent.js` and `dist/consent.css` also work on plain HTML sites.

Requirements: PHP 8.2+, Laravel 12 or 13, Statamic 6.

## Installation

While the repository is private, add it as a VCS repository in the site's `composer.json`:

```json
"repositories": [
    { "type": "vcs", "url": "git@github.com:marcodescom/statamic-consent.git" }
]
```

Then:

```bash
composer require marcodes/statamic-consent
```

Once the package is on Packagist, the `repositories` entry is no longer needed.

The prebuilt assets are copied to `public/vendor/statamic-consent/` automatically: Statamic sites run `php artisan statamic:install` after every `composer install/update` (`post-autoload-dump`), which publishes addon assets. To publish them by hand:

```bash
php artisan vendor:publish --tag=statamic-consent --force
```

Set the measurement id in `.env` (optional; without it there is no statistics category):

```dotenv
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

Publish the config to adjust it:

```bash
php artisan vendor:publish --tag=statamic-consent-config
```

## Layout

```antlers
<head>
    ...
    {{ consent:head }}
</head>
<body>
    {{ consent:banner }}
    ...
    <footer>
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
        {{ consent:settings_link class="footer-link" }}
    </footer>
</body>
```

`{{ consent:head }}` adds the stylesheet, the Consent Mode defaults (inline, only with a measurement id) and the script (`<script type="module">`, so it never runs twice). Without it, `{{ consent:banner }}` and the gates add stylesheet and script themselves. All three tags render nothing when there is nothing to ask (no valid measurement id and media disabled).

## Tags

| Tag | Output |
| --- | --- |
| `{{ consent:head }}` | Stylesheet, Consent Mode defaults, script. Params: `nonce` (CSP, defaults to Laravel's `Vite::cspNonce()`), `defaults="false"` to skip the inline script. |
| `{{ consent:banner }}` | The banner. Include once, early in `<body>`. |
| `{{ consent:settings_link }}` | Button "Cookie-Einstellungen" that reopens the banner. Params: `class`, `text`. |
| `{{ consent:youtube id="..." }}` | YouTube gate on youtube-nocookie.com. `id` or `url` (watch, youtu.be, embed, shorts), `title`, `start` (seconds or `1m30s`). |
| `{{ consent:vimeo id="..." }}` | Vimeo gate with Do Not Track. `id` or `url`, `hash` (unlisted videos), `title`, `start`. |
| `{{ consent:map src="..." }}` | Google Maps gate for an embed URL (`https://www.google.com/maps/embed?pb=...`). |
| `{{ consent:map address="..." }}` | Google Maps gate for an address or query (`query` works too), `zoom` (1-21), `lang`. No API key needed. |
| `{{ consent:gate service="..." }}...{{ /consent:gate }}` | Wraps any embed markup. The content is rendered into a `<template>` and only inserted after consent; scripts inside run then. `service`: `youtube`, `vimeo`, `google_maps` or your own handle with `provider="Name"`. |

Common gate params: `ratio` (`16/9` default, `4:3`, `auto` for content with its own height), `poster` (a site-hosted image URL, never a provider thumbnail), `poster_alt`, `text` (placeholder text), `class`, `autoplay="false"` (by default the clicked YouTube or Vimeo embed starts playing; embeds opened by "Immer erlauben" never autoplay).

Other links can open the settings too: any element with `data-consent-open`, or a link ending with one of `open_hashes` (default `#consent-settings`), for example in the privacy policy text.

## Configuration

`config/statamic/consent.php`:

| Key | Default | Meaning |
| --- | --- | --- |
| `google_analytics_id` | `env('GOOGLE_ANALYTICS_ID')` | Validated against `^G-[A-Z0-9]{4,20}$`, anything else counts as empty. |
| `version` | `'1'` | Raise it when texts, purposes or services change: everybody is asked again. |
| `max_age_days` | `365` | Days until a choice expires. |
| `privacy_url` | `'/privacy'` | One URL, or a map per site handle or language (`['de' => '/datenschutz', 'en' => '/en/privacy', 'default' => ...]`). |
| `storage_key` | `'consent'` | localStorage key. |
| `legacy_storage_keys` | `[]` | Keys of earlier consent implementations to migrate, see below. |
| `categories.statistics` | `true` | Statistics category (needs a measurement id). |
| `categories.media` | `false` | External media category. When off, gates still work, but only with "Einmal laden". |
| `services.youtube/vimeo/google_maps` | `true` | A disabled service renders no gate and is not named in the banner. |
| `google_analytics.google_signals` | `true` | `allow_google_signals`; also grants `ad_storage` and `ad_user_data`, which Google signals need. The banner text changes with it. |
| `google_analytics.ad_personalization_signals` | `false` | `allow_ad_personalization_signals` and `ad_personalization` (remarketing). |
| `google_analytics.cookie_domain` | `'auto'` | Passed to `gtag.js` when set (e.g. `.example.com`) and cleaned up on withdrawal. |
| `open_hashes` | `['#consent-settings']` | Link targets that open the settings. |
| `assets.enabled` / `assets.url` | `true` / `null` | Switch off when the site bundles the files itself, or serve them from another URL. |

Consent Mode signals after "statistics" consent: `analytics_storage` granted; `ad_storage` and `ad_user_data` granted only with Google signals; `ad_personalization` granted only with ad personalisation signals. Without consent (none yet, expired, rejected, withdrawn) the script sets `ga-disable-<id>`, sends `denied` and deletes `_ga`, `_ga_*`, `_gid` and `_gat*` on the host and every parent domain.

## Texts

German and English ship with the addon (`lang/de`, `lang/en`: `banner.php`, `gate.php`, `services.php`). The language follows the current Statamic site. To change texts:

```bash
php artisan vendor:publish --tag=statamic-consent-translations
```

and edit `lang/vendor/statamic-consent/{de,en}/*.php`. Keep the texts in line with the privacy policy and raise `version` when the meaning changes.

The markup can be overridden as well (`--tag=statamic-consent-views`, Blade views in `resources/views/vendor/statamic-consent/`). Keep the `data-consent*` attributes, the script relies on them.

## Theming

Plain CSS with BEM classes (`.consent-banner__*`, `.consent-gate__*`, `.consent-settings-link`) and `font: inherit`. Set the custom properties in the site's CSS:

```css
:root {
    --consent-bg: #ffffff;
    --consent-fg: #0a0a0a;
    --consent-muted: #404040;
    --consent-border: #d4d4d4;
    --consent-button-bg: #0a0a0a;
    --consent-button-fg: #ffffff;
    --consent-button-hover-bg: #262626;
    --consent-focus: #2563eb;
    --consent-radius: 0;
    --consent-shadow: 0 12px 40px rgb(0 0 0 / 0.18);
    --consent-z: 1000;
    --consent-category-bg: #f5f5f5;     /* category boxes in the settings view */
    --consent-accent: #0a0a0a;          /* checkbox colour */
    --consent-gate-bg: #f5f5f5;
    --consent-gate-fg: #0a0a0a;
    --consent-gate-muted: #404040;
    --consent-gate-border: #d4d4d4;
    --consent-gate-overlay: rgb(255 255 255 / 0.88); /* text box over a poster */
    --consent-gate-radius: 0;
    --consent-gate-ratio: 16 / 9;       /* usually set per gate via ratio="" */
}
```

On phones the banner spans the bottom edge and its buttons stay visible while the text scrolls; from 768px it is a card in the lower left corner.

## JavaScript API and events

```js
window.Consent.has('statistics')   // true / false
window.Consent.get()               // { version, decidedAt, asked, statistics, media }
window.Consent.set({ statistics: true, media: false })
window.Consent.open()              // settings view
window.Consent.acceptAll()
window.Consent.rejectAll()
window.Consent.refresh()           // load gates added to the DOM later

document.addEventListener('consent:change', (event) => console.log(event.detail))
document.addEventListener('consent:ready', (event) => console.log(event.detail))
```

## Standalone use (without Statamic)

Copy `dist/consent.css` and `dist/consent.js` to the site and use the markup in [`examples/standalone.html`](examples/standalone.html): the banner `<section data-consent ...>` with its data attributes, gates with `data-consent-gate` and a `<template data-consent-gate-content>`, and a `data-consent-open` button in the footer. The script starts on its own:

```html
<link rel="stylesheet" href="/assets/consent.css">
<script type="module" src="/assets/consent.js"></script>
```

Banner attributes: `data-consent-version`, `data-consent-storage-key`, `data-consent-categories` (`statistics,media`), `data-consent-ga-id`, `data-consent-google-signals`, `data-consent-ad-personalization`, `data-consent-cookie-domain`, `data-consent-legacy-keys` (JSON list), `data-consent-open-hashes` (JSON list), optional `data-consent-max-age-days`.

## Migration from earlier consent implementations

List the old localStorage keys in `legacy_storage_keys`. On the first visit after the switch, the script takes the first valid old choice, stores it in the new format (keeping the original decision time, so it still expires on schedule) and removes the old keys. Recognised shapes:

| Old shape | Carried over |
| --- | --- |
| `{ version, analytics: true/false, decidedAt }` | statistics; media is asked |
| `{ v: 2, ts, c: ['analytics', 'maps'], analytics, maps }` | the categories in `c` (`analytics` to statistics, `maps` to media) |
| `{ v: 1, ts, maps }` | media only |
| `{ v, ts, analytics?, maps? }` | the categories present |

Expired or unreadable old choices are dropped (the key is still removed). Categories the old implementation never asked about are asked in the banner, with the carried-over answers preselected. When the new storage already holds a valid choice, old keys are only removed.

## Privacy policy template

German and English text blocks for the GA4, YouTube, Vimeo and Google Maps sections of a privacy policy:

```bash
php artisan vendor:publish --tag=statamic-consent-privacy
```

They land in `resources/privacy/statamic-consent/{de,en}.md`. **They are a template, not legal advice**: adapt them to the site, replace the `[placeholders]` and have them reviewed before publishing.

## Development

```bash
composer install
npm install
npm run build      # resources/js + resources/css -> dist/ (commit dist/)
npm test           # Vitest + jsdom
vendor/bin/phpunit # Orchestra Testbench + Statamic AddonTestCase
```

## Changelog

### Unreleased

- Banner with categories `necessary`, `statistics`, `media`, settings view, footer settings link.
- Google Analytics 4 with Consent Mode v2, strict opt-in, configurable Google signals and ad personalisation signals, cookie clean-up on all parent domains.
- Consent gates for YouTube (youtube-nocookie.com), Vimeo (Do Not Track), Google Maps (embed URL or address) and arbitrary markup.
- Migration of choices from earlier implementations.
- German and English texts, privacy policy template.
- Standalone build for non-Statamic sites.

## License

Not decided yet, see [LICENSE](LICENSE).
