<?php

// Banner texts. Override in lang/vendor/statamic-consent/en/banner.php
// (php artisan vendor:publish --tag=statamic-consent-translations) and keep
// them in line with the privacy policy.
//
// The banner text is built from parts, so it fits the categories in use:
// text_both / text_statistics / text_media + transfer + outro.
return [
    'title' => 'Privacy settings',
    'text_both' => 'We use :statistics and load :media only with your consent.',
    'text_statistics' => 'We use :statistics only with your consent.',
    'text_media' => 'We load :media only with your consent.',
    'statistics_part' => 'Google Analytics for statistics',
    'media_part' => ':things from :services',
    'things_videos' => 'videos',
    'things_maps' => 'maps',
    'things_videos_maps' => 'videos and maps',
    'transfer' => 'Data may be transferred to the USA.',
    'outro' => 'You can change your choice at any time under ":settings".',
    'privacy_link' => 'More in the privacy policy',
    'accept' => 'Accept all',
    'reject' => 'Reject all',
    'customize' => 'Settings',
    'save' => 'Save selection',
    'settings_link' => 'Cookie settings',
    'categories_legend' => 'Categories',
    'necessary_label' => 'Necessary',
    'always_active' => 'Always active',
    'necessary_description' => 'Stores your choice in this browser. Always active.',
    'statistics_label' => 'Statistics',
    'statistics_description' => 'Google Analytics by Google Ireland Limited: analysis of how the site is used, cookies "_ga" and "_ga_*". Data may be transferred to the USA.',
    'statistics_description_signals' => 'Google Analytics by Google Ireland Limited with Google signals: analysis of how the site is used, with aggregated information on age, gender and interests. If you are signed in to Google, Google can recognise your visits across devices. Cookies "_ga" and "_ga_*", data may be transferred to the USA.',
    'media_label' => 'External media',
    'media_description' => 'Loads embedded content from :services. Among other things, your IP address is transferred to the provider, also to the USA.',
    'and' => 'and',
];
