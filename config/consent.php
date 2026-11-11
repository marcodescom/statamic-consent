<?php

/*
 * Consent banner, Google Analytics 4 with Google Consent Mode v2 and consent
 * gates for external media. Published to config/statamic/consent.php.
 *
 * Everything happens in the browser, so the same statically cached HTML works
 * for every visitor. Without a valid measurement id and without the media
 * category there is no banner, no settings link and no Google code at all.
 */

$measurementId = strtoupper(trim((string) env('GOOGLE_ANALYTICS_ID', '')));

return [

    /*
     * GA4 measurement id of this domain's web stream, e.g. "G-ABC123XYZ9".
     * Anything that does not look like a GA4 id counts as empty: no statistics
     * category, no Google Analytics.
     */
    'google_analytics_id' => preg_match('/^G-[A-Z0-9]{4,20}$/', $measurementId) ? $measurementId : null,

    /*
     * Version of the consent question. Raise it whenever the banner text, the
     * purposes or the services change: every visitor is asked again.
     */
    'version' => '1',

    /*
     * Days until a choice expires and the visitor is asked again.
     */
    'max_age_days' => 365,

    /*
     * Privacy policy linked from the banner and the gates. Either one URL or a
     * map per site handle or language, e.g. ['de' => '/datenschutz', 'en' => '/en/privacy'].
     * A "default" entry is used when nothing else matches.
     */
    'privacy_url' => '/privacy',

    /*
     * localStorage key of the choice (no cookie is set).
     */
    'storage_key' => 'consent',

    /*
     * Choices stored by an earlier consent implementation, e.g. ['my_consent'].
     * The statistics decision (and maps as media where present) is carried over
     * once, then the old key is removed. See README "Migration".
     */
    'legacy_storage_keys' => [],

    /*
     * Categories besides "necessary" (always on). The banner only lists the
     * categories in use: statistics needs a measurement id, media must be enabled
     * here. With media disabled, gates still work, but only with "load once".
     */
    'categories' => [
        'statistics' => true,
        'media' => false,
    ],

    /*
     * External media services. A disabled service renders no gate and is not
     * named in the banner.
     */
    'services' => [
        'youtube' => true,
        'vimeo' => true,
        'google_maps' => true,
    ],

    /*
     * Google Analytics options sent with the "statistics" consent.
     *
     * google_signals: allow_google_signals; also grants ad_storage and
     *   ad_user_data, which Google signals need. Mention it in the banner text
     *   and privacy policy (the default lang files do).
     * ad_personalization_signals: allow_ad_personalization_signals and
     *   ad_personalization (remarketing, personalised ads). Keep off unless needed.
     * cookie_domain: "auto" lets gtag.js choose the top-most domain. A domain
     *   such as ".example.com" is passed to gtag.js and also cleaned up on revoke.
     */
    'google_analytics' => [
        'google_signals' => true,
        'ad_personalization_signals' => false,
        'cookie_domain' => 'auto',
    ],

    /*
     * Where the banner appears from 600px width: "bottom-left", "bottom-center",
     * "bottom-right", "bar" (full-width bottom bar) or "center" (modal dialog
     * with a dimmed backdrop and focus trap). Below 600px every position except
     * "center" becomes a full-width bottom sheet.
     */
    'position' => 'bottom-left',

    /*
     * "auto" takes background, text colour, font, accent colour and radius from
     * the site (body and the first visible element matching
     * theme_accent_selector). "manual" uses only the --consent-* variables and
     * the defaults. In both modes --consent-* variables set by the site win.
     */
    'theme' => 'auto',

    'theme_accent_selector' => '.btn-primary, .button-primary, .btn, .button, button[type="submit"], main a, a',

    /*
     * Links whose href ends with one of these also open the settings, e.g. a
     * link in the privacy policy text: <a href="#consent-settings">.
     */
    'open_hashes' => ['#consent-settings'],

    /*
     * Prebuilt assets (dist/), published to public/vendor/statamic-consent on
     * "composer install/update" (statamic:install). Set enabled to false when
     * the site bundles resources/js/index.js and the CSS itself, or set url to
     * serve them from elsewhere.
     */
    'assets' => [
        'enabled' => true,
        'url' => null,
    ],

];
