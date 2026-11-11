<?php

// Banner texts. Override in lang/vendor/statamic-consent/en/banner.php
// (php artisan vendor:publish --tag=statamic-consent-translations) and keep
// them in line with the privacy policy.
return [
    'title' => 'Privacy settings',
    'intro' => 'We use technically necessary storage so that this website works.',
    'statistics' => 'With your consent, we use Google Analytics to see how our pages are used. Google sets cookies for this, and data may be transferred to the USA.',
    'statistics_signals' => 'With your consent, we use Google Analytics with Google signals. This shows us how our pages are used and gives us aggregated information on age, gender and interests. If you are signed in to Google, Google can recognise your visits across devices. Google sets cookies for this, and data may be transferred to the USA.',
    'media' => 'We only load content from :services with your consent. Data such as your IP address is then transferred to the provider, also to the USA.',
    'outro' => 'Without consent, none of this is loaded. You can change your choice at any time via ":settings" at the bottom of the page.',
    'privacy_link' => 'More in the privacy policy',
    'accept' => 'Accept all',
    'reject' => 'Only necessary',
    'customize' => 'Settings',
    'save' => 'Save selection',
    'settings_link' => 'Cookie settings',
    'categories_legend' => 'Categories',
    'necessary_label' => 'Necessary',
    'necessary_description' => 'Stores your choice in this browser. Always active.',
    'statistics_label' => 'Statistics',
    'statistics_description' => 'Google Analytics by Google Ireland Limited: analysis of how the site is used, cookies "_ga" and "_ga_*". Data may be transferred to the USA.',
    'media_label' => 'External media',
    'media_description' => 'Loads embedded content from :services. Among other things, your IP address is transferred to the provider, also to the USA.',
    'and' => 'and',
];
