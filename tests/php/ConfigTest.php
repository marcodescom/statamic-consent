<?php

namespace Marcodes\Consent\Tests;

use Marcodes\Consent\Support\Settings;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;

class ConfigTest extends TestCase
{
    public static function measurementIds(): array
    {
        return [
            'valid' => ['G-ABC123XYZ9', 'G-ABC123XYZ9'],
            'trimmed and upper-cased' => [' g-abc123xyz9 ', 'G-ABC123XYZ9'],
            'empty' => ['', null],
            'universal analytics' => ['UA-1234-1', null],
            'too short' => ['G-AB1', null],
            'markup' => ['G-"><script>', null],
        ];
    }

    #[Test]
    #[DataProvider('measurementIds')]
    public function the_measurement_id_from_the_environment_is_validated(string $env, ?string $expected): void
    {
        putenv("GOOGLE_ANALYTICS_ID=$env");
        $_ENV['GOOGLE_ANALYTICS_ID'] = $_SERVER['GOOGLE_ANALYTICS_ID'] = $env;

        try {
            $config = require __DIR__.'/../../config/consent.php';
            $this->assertSame($expected, $config['google_analytics_id']);
        } finally {
            putenv('GOOGLE_ANALYTICS_ID');
            unset($_ENV['GOOGLE_ANALYTICS_ID'], $_SERVER['GOOGLE_ANALYTICS_ID']);
        }
    }

    #[Test]
    #[DataProvider('measurementIds')]
    public function the_measurement_id_is_validated_again_at_runtime(string $value, ?string $expected): void
    {
        $this->assertSame($expected, (new Settings(['google_analytics_id' => $value]))->measurementId());
    }

    #[Test]
    public function the_config_is_merged_under_statamic_consent(): void
    {
        $this->assertSame('consent', config('statamic.consent.storage_key'));
        $this->assertTrue(config('statamic.consent.categories.statistics'));
        $this->assertSame(['youtube' => true, 'vimeo' => true, 'google_maps' => true], config('statamic.consent.services'));
    }

    #[Test]
    public function categories_in_use_depend_on_the_id_and_the_media_switch(): void
    {
        $this->assertSame([], (new Settings([]))->categories());
        $this->assertSame(['statistics'], (new Settings(['google_analytics_id' => 'G-TEST000000', 'categories' => ['statistics' => true]]))->categories());
        $this->assertSame([], (new Settings(['google_analytics_id' => 'G-TEST000000', 'categories' => ['statistics' => false]]))->categories());
        $this->assertSame(['media'], (new Settings(['categories' => ['media' => true]]))->categories());
        $this->assertSame([], (new Settings(['categories' => ['media' => true], 'services' => ['youtube' => false, 'vimeo' => false, 'google_maps' => false]]))->categories());
        $this->assertSame(['statistics', 'media'], (new Settings(['google_analytics_id' => 'G-TEST000000', 'categories' => ['statistics' => true, 'media' => true]]))->categories());
    }

    #[Test]
    public function the_privacy_url_can_be_a_map_per_site_or_language(): void
    {
        $this->useLanguage('de');
        $this->assertSame('/datenschutz', (new Settings(['privacy_url' => ['en' => '/privacy', 'de' => '/datenschutz']]))->privacyUrl());
        $this->assertSame('/privacy', (new Settings(['privacy_url' => ['default' => '/privacy']]))->privacyUrl());
        $this->assertSame('/a', (new Settings(['privacy_url' => ['fr' => '/a']]))->privacyUrl());
        $this->assertSame('https://example.com/privacy', (new Settings(['privacy_url' => 'https://example.com/privacy']))->privacyUrl());
    }

    #[Test]
    public function unsafe_or_empty_values_fall_back(): void
    {
        $settings = new Settings([
            'privacy_url' => 'javascript:alert(1)',
            'version' => '',
            'storage_key' => ' ',
            'max_age_days' => -5,
            'google_analytics' => ['cookie_domain' => 'bad domain"'],
            'legacy_storage_keys' => ['old', '', 5, ' other '],
        ]);

        $this->assertNull($settings->privacyUrl());
        $this->assertSame('1', $settings->version());
        $this->assertSame('consent', $settings->storageKey());
        $this->assertSame(365, $settings->maxAgeDays());
        $this->assertSame('auto', $settings->cookieDomain());
        $this->assertSame(['old', 'other'], $settings->legacyStorageKeys());
        $this->assertSame('.example.com', (new Settings(['google_analytics' => ['cookie_domain' => '.Example.com']]))->cookieDomain());
    }

    #[Test]
    public function texts_have_no_long_dashes_and_no_gendered_forms(): void
    {
        $files = glob(__DIR__.'/../../lang/*/*.php');
        $this->assertNotEmpty($files);

        foreach ($files as $file) {
            foreach (require $file as $key => $text) {
                $this->assertDoesNotMatchRegularExpression('/[\x{2013}\x{2014}]/u', $text, basename(dirname($file)).'/'.basename($file).": $key");
                $this->assertDoesNotMatchRegularExpression('/(:innen|\*innen|Innen\b|Nutzende|Besuchende)/u', $text, "$file: $key");
            }
        }
    }

    #[Test]
    public function german_and_english_have_the_same_keys(): void
    {
        foreach (glob(__DIR__.'/../../lang/de/*.php') as $file) {
            $en = __DIR__.'/../../lang/en/'.basename($file);
            $this->assertFileExists($en);
            $this->assertSame(array_keys(require $file), array_keys(require $en), basename($file));
        }
    }
}
