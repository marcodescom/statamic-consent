<?php

namespace Marcodes\Consent\Tests;

use PHPUnit\Framework\Attributes\Test;

class TagsTest extends TestCase
{
    private function withAnalytics(): void
    {
        config(['statamic.consent.google_analytics_id' => 'G-TEST000000']);
    }

    private function withMedia(): void
    {
        config(['statamic.consent.categories.media' => true]);
    }

    #[Test]
    public function without_id_and_without_media_there_is_no_banner_no_link_no_assets_and_no_google_code(): void
    {
        $html = $this->antlers('{{ consent:head }}{{ consent:banner }}{{ consent:settings_link }}');

        $this->assertSame('', trim($html));
    }

    #[Test]
    public function with_an_id_the_banner_asks_about_statistics_only(): void
    {
        $this->withAnalytics();
        $this->useLanguage('de');

        $html = $this->antlers('{{ consent:banner }}');

        $this->assertMatchesRegularExpression('/<section[^>]*data-consent[\s>]/', $html);
        $this->assertStringContainsString('data-consent-ga-id="G-TEST000000"', $html);
        $this->assertStringContainsString('data-consent-categories="statistics"', $html);
        $this->assertStringContainsString('data-consent-version="1"', $html);
        $this->assertMatchesRegularExpression('/role="dialog"[\s\S]*aria-labelledby="consent-title"[\s\S]*hidden\s*>/', $html, 'starts hidden, JavaScript shows it');
        $this->assertStringContainsString('Alle akzeptieren', $html);
        $this->assertStringContainsString('Nur notwendige', $html);
        $this->assertStringContainsString('Google Analytics mit Google-Signalen', $html);
        $this->assertStringNotContainsString('Externe Medien', $html);
        $this->assertStringNotContainsString('data-consent-customize', $html, 'one category: accept and reject are enough');
        $this->assertStringContainsString('href="/privacy"', $html);
    }

    #[Test]
    public function the_html_never_contains_google_code_before_consent(): void
    {
        $this->withAnalytics();
        $this->withMedia();

        $html = $this->antlers('{{ consent:head }}{{ consent:banner }}{{ consent:youtube id="dQw4w9WgXcQ" }}{{ consent:map query="Marienplatz 1, München" }}');

        $this->assertStringNotContainsString('googletagmanager.com', $html);
        $this->assertStringNotContainsString('google-analytics.com', $html);
        $this->assertStringNotContainsString('<iframe', $this->withoutTemplates($html));
        $this->assertStringNotContainsString('ytimg.com', $html, 'no YouTube thumbnails');
    }

    #[Test]
    public function with_media_only_the_banner_asks_about_external_media(): void
    {
        $this->withMedia();
        $this->useLanguage('de');

        $html = $this->antlers('{{ consent:banner }}{{ consent:settings_link }}');

        $this->assertStringContainsString('data-consent-categories="media"', $html);
        $this->assertStringNotContainsString('data-consent-ga-id', $html);
        $this->assertStringContainsString('YouTube, Vimeo und Google Maps', $html);
        $this->assertStringNotContainsString('Google Analytics', $html);
        $this->assertMatchesRegularExpression('/<button[^>]*data-consent-open[^>]*>Cookie-Einstellungen<\/button>/', $html);
    }

    #[Test]
    public function both_categories_get_a_settings_view_with_checkboxes(): void
    {
        $this->withAnalytics();
        $this->withMedia();
        config(['statamic.consent.services.vimeo' => false]);

        $html = $this->antlers('{{ consent:banner }}');

        $this->assertStringContainsString('data-consent-categories="statistics,media"', $html);
        $this->assertMatchesRegularExpression('/<input type="checkbox" id="consent-necessary"[^>]*checked disabled/', $html);
        $this->assertStringContainsString('name="statistics"', $html);
        $this->assertStringContainsString('name="media"', $html);
        $this->assertStringContainsString('data-consent-customize', $html);
        $this->assertStringContainsString('data-consent-save', $html);
        $this->assertStringContainsString('YouTube and Google Maps', $html);
    }

    #[Test]
    public function the_banner_passes_the_options_to_the_script(): void
    {
        $this->withAnalytics();
        config([
            'statamic.consent.version' => '2026-11',
            'statamic.consent.storage_key' => 'site_consent',
            'statamic.consent.legacy_storage_keys' => ['old_consent', 'fg-consent'],
            'statamic.consent.google_analytics.google_signals' => false,
            'statamic.consent.google_analytics.cookie_domain' => '.example.com',
            'statamic.consent.privacy_url' => ['en' => '/en/privacy', 'de' => '/datenschutz'],
        ]);

        $html = $this->antlers('{{ consent:banner }}');

        $this->assertStringContainsString('data-consent-version="2026-11"', $html);
        $this->assertStringContainsString('data-consent-storage-key="site_consent"', $html);
        $this->assertStringContainsString('data-consent-legacy-keys="[&quot;old_consent&quot;,&quot;fg-consent&quot;]"', $html);
        $this->assertStringContainsString('data-consent-google-signals="false"', $html);
        $this->assertStringContainsString('data-consent-ad-personalization="false"', $html);
        $this->assertStringContainsString('data-consent-cookie-domain=".example.com"', $html);
        $this->assertStringContainsString('href="/en/privacy"', $html);
        $this->assertStringNotContainsString('Google signals', $html, 'text without signals');
    }

    #[Test]
    public function head_renders_the_defaults_and_the_assets_once(): void
    {
        $this->withAnalytics();

        $html = $this->antlers('{{ consent:head nonce="abc" }}{{ consent:banner }}{{ consent:youtube id="dQw4w9WgXcQ" }}');

        $this->assertStringContainsString('<script nonce="abc">', $html);
        $this->assertStringContainsString("gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'})", $html);
        $this->assertStringContainsString("gtag('set','ads_data_redaction',true)", $html);
        $this->assertSame(1, substr_count($html, 'consent.css?v='));
        $this->assertSame(1, substr_count($html, 'consent.js?v='));
        $this->assertMatchesRegularExpression('#<script type="module" src="[^"]*/vendor/statamic-consent/consent\.js\?v=[0-9a-f]{12}"></script>#', $html);
    }

    #[Test]
    public function head_without_statistics_has_no_inline_gtag(): void
    {
        $this->withMedia();

        $html = $this->antlers('{{ consent:head }}');

        $this->assertStringNotContainsString('gtag', $html);
        $this->assertStringContainsString('consent.js', $html);
    }

    #[Test]
    public function assets_can_be_switched_off_or_moved(): void
    {
        $this->withAnalytics();

        config(['statamic.consent.assets.url' => 'https://cdn.example.com/consent/']);
        $this->assertStringContainsString('src="https://cdn.example.com/consent/consent.js?v=', $this->antlers('{{ consent:banner }}'));

        config(['statamic.consent.assets.enabled' => false]);
        $this->assertStringNotContainsString('consent.js', $this->antlers('{{ consent:head }}{{ consent:banner }}'));
    }

    #[Test]
    public function youtube_gate_uses_youtube_nocookie_inside_a_template(): void
    {
        $this->withMedia();
        $this->useLanguage('de');

        $html = $this->antlers('{{ consent:youtube url="https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5" title="Imagefilm" start="90" }}');

        $this->assertStringContainsString('data-consent-gate="youtube"', $html);
        $this->assertStringContainsString('data-consent-gate-category="media"', $html);
        $this->assertStringContainsString('data-consent-gate-autoplay="autoplay=1"', $html);
        $this->assertMatchesRegularExpression('#<template data-consent-gate-content><iframe src="https://www\.youtube-nocookie\.com/embed/dQw4w9WgXcQ\?start=90&amp;rel=0" title="Imagefilm"#', $html);
        $this->assertStringNotContainsString('<iframe', $this->withoutTemplates($html));
        $this->assertStringContainsString('Einmal laden', $html);
        $this->assertStringContainsString('Immer erlauben', $html);
        $this->assertStringContainsString('von YouTube eingebunden', $html);
        $this->assertStringContainsString('style="--consent-gate-ratio: 16 / 9"', $html);
        $this->assertStringContainsString('href="/privacy"', $html);
    }

    #[Test]
    public function gates_without_the_media_category_only_offer_load_once(): void
    {
        $html = $this->antlers('{{ consent:vimeo id="76979871" }}');

        $this->assertStringContainsString('data-consent-gate-load', $html);
        $this->assertStringNotContainsString('data-consent-gate-allow', $html);
        $this->assertStringContainsString('consent.js', $html, 'the gate brings the script itself');
    }

    #[Test]
    public function vimeo_gate_uses_do_not_track_and_keeps_the_privacy_hash(): void
    {
        $html = $this->antlers('{{ consent:vimeo url="https://vimeo.com/76979871/abc123def0" ratio="4:3" poster="/img/poster.jpg" poster_alt="Poster" }}');

        $this->assertStringContainsString('src="https://player.vimeo.com/video/76979871?h=abc123def0&amp;dnt=1"', $html);
        $this->assertStringContainsString('--consent-gate-ratio: 4 / 3', $html);
        $this->assertStringContainsString('<img class="consent-gate__poster" src="/img/poster.jpg" alt="Poster"', $html);
        $this->assertStringContainsString('consent-gate--poster', $html);
    }

    #[Test]
    public function map_gate_accepts_an_embed_url_or_an_address(): void
    {
        $this->useLanguage('de');

        $src = $this->antlers('{{ consent:map src="https://www.google.com/maps/embed?pb=!1m18!1m12" }}');
        $this->assertStringContainsString('data-consent-gate="google_maps"', $src);
        $this->assertStringContainsString('src="https://www.google.com/maps/embed?pb=!1m18!1m12"', $src);
        $this->assertStringContainsString('referrerpolicy="no-referrer-when-downgrade"', $src);

        $query = $this->antlers('{{ consent:map address="Marienplatz 1, 80331 München" zoom="15" }}');
        $this->assertStringContainsString('src="https://www.google.com/maps?q=Marienplatz+1%2C+80331+M%C3%BCnchen&amp;z=15&amp;hl=de&amp;output=embed"', $query);
        $this->assertStringContainsString('Karte von Google Maps', $query);
    }

    #[Test]
    public function invalid_or_disabled_embeds_render_nothing(): void
    {
        $this->assertSame('', trim($this->antlers('{{ consent:youtube id="not a video" }}')));
        $this->assertSame('', trim($this->antlers('{{ consent:vimeo id="abc" }}')));
        $this->assertSame('', trim($this->antlers('{{ consent:map src="https://evil.example.com/maps?q=x" }}')));
        $this->assertSame('', trim($this->antlers('{{ consent:map src="javascript:alert(1)" }}')));

        config(['statamic.consent.services.youtube' => false]);
        $this->assertSame('', trim($this->antlers('{{ consent:youtube id="dQw4w9WgXcQ" }}')));
    }

    #[Test]
    public function the_generic_gate_puts_arbitrary_markup_into_a_template(): void
    {
        $this->withMedia();

        $html = $this->antlers(
            '{{ consent:gate service="google_maps" ratio="auto" }}<iframe src="https://www.google.com/maps/embed?pb={{ pb }}"></iframe><script>initMap()</script>{{ /consent:gate }}',
            ['pb' => 'abc'],
        );

        $this->assertStringContainsString('data-consent-gate="google_maps"', $html);
        $this->assertStringContainsString('<template data-consent-gate-content><iframe src="https://www.google.com/maps/embed?pb=abc"></iframe><script>initMap()</script></template>', $html);
        $this->assertStringNotContainsString('<iframe', $this->withoutTemplates($html));
        $this->assertStringNotContainsString('<script>initMap', $this->withoutTemplates($html));
        $this->assertStringNotContainsString('--consent-gate-ratio', $html);
        $this->assertStringNotContainsString('consent-gate--ratio', $html);
    }

    #[Test]
    public function the_generic_gate_supports_other_providers_and_cannot_be_broken_out_of(): void
    {
        $html = $this->antlers('{{ consent:gate service="calendly" provider="Calendly" }}<iframe src="https://calendly.com/x"></iframe></template><iframe src="https://evil.test"></iframe>{{ /consent:gate }}');

        $this->assertStringContainsString('Hier wird ein Inhalt von Calendly eingebunden', $this->antlersDe($html));
        $this->assertSame(1, substr_count($html, '</template>'));
        $this->assertStringNotContainsString('<iframe', $this->withoutTemplates($html));

        $this->assertSame('', trim($this->antlers('{{ consent:gate service="calendly" }}<iframe></iframe>{{ /consent:gate }}')), 'unknown service needs a provider name');
        $this->assertSame('', trim($this->antlers('{{ consent:gate service="youtube" }}{{ /consent:gate }}')), 'empty content');
    }

    #[Test]
    public function gate_ids_are_unique_per_page(): void
    {
        $html = $this->antlers('{{ consent:youtube id="dQw4w9WgXcQ" }}{{ consent:youtube id="dQw4w9WgXcQ" }}');

        $this->assertStringContainsString('id="consent-gate-1-text"', $html);
        $this->assertStringContainsString('id="consent-gate-2-text"', $html);
    }

    #[Test]
    public function the_settings_link_takes_classes_and_a_label(): void
    {
        $this->withAnalytics();

        $html = $this->antlers('{{ consent:settings_link class="footer-link" text="Privacy choices" }}');

        $this->assertSame('<button type="button" class="consent-settings-link footer-link" data-consent-open aria-haspopup="dialog">Privacy choices</button>', trim($html));
    }

    #[Test]
    public function english_texts_are_used_for_english_sites(): void
    {
        $this->withAnalytics();
        $this->useLanguage('en');

        $html = $this->antlers('{{ consent:banner }}{{ consent:settings_link }}');

        $this->assertStringContainsString('Accept all', $html);
        $this->assertStringContainsString('Only necessary', $html);
        $this->assertStringContainsString('Cookie settings', $html);
    }

    #[Test]
    public function the_privacy_template_is_publishable_and_marked_as_a_template(): void
    {
        foreach (['de', 'en'] as $lang) {
            $file = __DIR__."/../../stubs/privacy/{$lang}.md";
            $this->assertFileExists($file);
            $text = file_get_contents($file);
            $this->assertMatchesRegularExpression('/(TEMPLATE|VORLAGE)/', $text);
            foreach (['Google Analytics', 'YouTube', 'Vimeo', 'Google Maps'] as $section) {
                $this->assertStringContainsString($section, $text);
            }
            $this->assertDoesNotMatchRegularExpression('/[\x{2013}\x{2014}]/u', $text);
        }
    }

    private function antlersDe(string $html): string
    {
        // Rendered in the default (English) site above; check the German text too.
        $this->useLanguage('de');

        return $html.$this->antlers('{{ consent:gate service="calendly" provider="Calendly" }}<iframe src="https://calendly.com/x"></iframe>{{ /consent:gate }}');
    }
}
