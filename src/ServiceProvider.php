<?php

namespace Marcodes\Consent;

use Marcodes\Consent\Tags\Consent;
use Statamic\Providers\AddonServiceProvider;

class ServiceProvider extends AddonServiceProvider
{
    protected $tags = [
        Consent::class,
    ];

    /*
     * dist/consent.js and dist/consent.css are copied to
     * public/vendor/statamic-consent/ by "php artisan statamic:install", which
     * Statamic sites run after every "composer install/update"
     * (publishAfterInstall). Manually: php artisan vendor:publish --tag=statamic-consent --force
     */
    protected $publishables = [
        __DIR__.'/../dist' => '',
    ];

    // The config lives under statamic.consent, not under the addon slug.
    protected $config = false;

    public function register()
    {
        parent::register();

        $this->mergeConfigFrom(__DIR__.'/../config/consent.php', 'statamic.consent');
    }

    public function bootAddon()
    {
        $this->publishes([
            __DIR__.'/../config/consent.php' => config_path('statamic/consent.php'),
        ], 'statamic-consent-config');

        $this->publishes([
            __DIR__.'/../resources/views' => resource_path('views/vendor/statamic-consent'),
        ], 'statamic-consent-views');

        $this->publishes([
            __DIR__.'/../stubs/privacy' => resource_path('privacy/statamic-consent'),
        ], 'statamic-consent-privacy');
    }
}
