<?php

// Banner texts. Override in lang/vendor/statamic-consent/de/banner.php
// (php artisan vendor:publish --tag=statamic-consent-translations) and keep
// them in line with the privacy policy.
//
// The banner text is built from parts, so it fits the categories in use:
// text_both / text_statistics / text_media + transfer + outro.
return [
    'title' => 'Datenschutz-Einstellungen',
    'text_both' => 'Wir nutzen :statistics und laden :media nur mit Ihrer Einwilligung.',
    'text_statistics' => 'Wir nutzen :statistics nur mit Ihrer Einwilligung.',
    'text_media' => 'Wir laden :media nur mit Ihrer Einwilligung.',
    'statistics_part' => 'Google Analytics für Statistiken',
    'media_part' => ':things von :services',
    'things_videos' => 'Videos',
    'things_maps' => 'Karten',
    'things_videos_maps' => 'Videos und Karten',
    'transfer' => 'Dabei können Daten in die USA übermittelt werden.',
    'outro' => 'Ihre Wahl können Sie jederzeit unter „:settings“ ändern.',
    'privacy_link' => 'Mehr in der Datenschutzerklärung',
    'accept' => 'Alle akzeptieren',
    'reject' => 'Alle ablehnen',
    'customize' => 'Einstellungen',
    'save' => 'Auswahl speichern',
    'settings_link' => 'Cookie-Einstellungen',
    'categories_legend' => 'Kategorien',
    'necessary_label' => 'Notwendig',
    'necessary_description' => 'Speichert Ihre Auswahl in diesem Browser. Immer aktiv.',
    'statistics_label' => 'Statistik',
    'statistics_description' => 'Google Analytics der Google Ireland Limited: Auswertung der Seitennutzung, Cookies „_ga“ und „_ga_*“. Daten können in die USA übermittelt werden.',
    'statistics_description_signals' => 'Google Analytics der Google Ireland Limited mit Google-Signalen: Auswertung der Seitennutzung mit zusammengefassten Angaben zu Alter, Geschlecht und Interessen. Sind Sie bei Google angemeldet, kann Google Ihre Besuche geräteübergreifend erkennen. Cookies „_ga“ und „_ga_*“, Daten können in die USA übermittelt werden.',
    'media_label' => 'Externe Medien',
    'media_description' => 'Lädt eingebettete Inhalte von :services. Dabei wird unter anderem Ihre IP-Adresse an den Anbieter übertragen, auch in die USA.',
    'and' => 'und',
];
