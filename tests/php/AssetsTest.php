<?php

namespace Marcodes\Consent\Tests;

use Illuminate\Support\Facades\File;
use Marcodes\Consent\Http\Middleware\InjectAssets;
use Marcodes\Consent\Support\Assets;
use PHPUnit\Framework\Attributes\Test;
use Statamic\View\View;

/**
 * Stylesheet and script always end up in <head> when the layout has
 * {{ consent:head }}, also when a gate in the page template renders first.
 */
class AssetsTest extends TestCase
{
    private string $views;

    protected function setUp(): void
    {
        parent::setUp();

        $this->views = __DIR__.'/../__fixtures__/pages';
        File::ensureDirectoryExists($this->views);
        view()->addLocation($this->views);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->views);

        parent::tearDown();
    }

    /** Renders a page template inside a layout like Statamic does: template first, then the layout. */
    private function page(string $template, string $layout): string
    {
        request()->attributes->remove(Assets::PRINTED);
        request()->attributes->remove(Assets::PENDING);

        File::put($this->views.'/page.antlers.html', $template);
        File::put($this->views.'/layout.antlers.html', $layout);

        return (new View)->template('page')->layout('layout')->render();
    }

    private function headOf(string $html): string
    {
        return preg_match('#<head>(.*?)</head>#s', $html, $match) ? $match[1] : '';
    }

    private function bodyOf(string $html): string
    {
        return preg_match('#<body>(.*?)</body>#s', $html, $match) ? $match[1] : '';
    }

    private const LAYOUT = '<html><head>{{ consent:head }}</head><body>{{ consent:banner }}{{ template_content }}</body></html>';

    #[Test]
    public function a_map_in_the_page_template_leaves_the_assets_to_the_head_tag(): void
    {
        config(['statamic.consent.google_analytics_id' => 'G-TEST000000', 'statamic.consent.categories.media' => true]);

        $html = $this->page('<figure>{{ consent:map address="Schloßstraße 19, 82031 Grünwald" }}</figure>', self::LAYOUT);

        $this->assertStringContainsString('consent.css?v=', $this->headOf($html));
        $this->assertStringContainsString('consent.js?v=', $this->headOf($html));
        $this->assertStringNotContainsString('consent.css', $this->bodyOf($html));
        $this->assertStringNotContainsString('consent.js', $this->bodyOf($html));
        $this->assertSame(1, substr_count($html, 'consent.js?v='));
    }

    #[Test]
    public function the_head_tag_prints_the_assets_for_gates_even_when_there_is_nothing_to_ask(): void
    {
        // No measurement id, media category off: no banner, gates offer "load once" only.
        $html = $this->page('{{ consent:youtube id="dQw4w9WgXcQ" }}', self::LAYOUT);

        $this->assertStringContainsString('consent.js?v=', $this->headOf($html));
        $this->assertStringNotContainsString('gtag', $html);
        $this->assertStringNotContainsString('data-consent ', $html);
    }

    #[Test]
    public function without_gates_and_without_anything_to_ask_the_head_stays_empty(): void
    {
        $html = $this->page('<p>Text</p>', self::LAYOUT);

        $this->assertSame('', trim($this->headOf($html)));
    }

    #[Test]
    public function the_head_tag_without_defaults_still_prints_the_assets_for_strict_csp_sites(): void
    {
        config(['statamic.consent.google_analytics_id' => 'G-TEST000000', 'statamic.consent.categories.media' => true]);

        $html = $this->page('{{ consent:vimeo id="76979871" }}', '<html><head>{{ consent:head defaults="false" }}</head><body>{{ template_content }}{{ consent:banner }}</body></html>');

        $this->assertStringNotContainsString('<script>', $html, 'no inline script');
        $this->assertStringNotContainsString('gtag(', $html);
        $this->assertStringContainsString('consent.js?v=', $this->headOf($html));
        $this->assertStringNotContainsString('consent.js', $this->bodyOf($html));
    }

    #[Test]
    public function a_gate_in_the_layout_after_the_head_tag_prints_nothing_extra(): void
    {
        config(['statamic.consent.categories.media' => true]);

        $html = $this->page('<p>Text</p>', '<html><head>{{ consent:head }}</head><body>{{ template_content }}<footer>{{ consent:map address="Marienplatz 1, München" }}</footer></body></html>');

        $this->assertSame(1, substr_count($html, 'consent.js?v='));
        $this->assertStringContainsString('consent.js?v=', $this->headOf($html));
        $this->assertStringNotContainsString(Assets::MARKER, $html);
    }

    /** Runs the page through the middleware like a Statamic frontend request. */
    private function throughMiddleware(callable $render, string $contentType = 'text/html; charset=UTF-8'): string
    {
        return app(InjectAssets::class)
            ->handle(request(), fn () => response($render(), 200, ['Content-Type' => $contentType]))
            ->getContent();
    }

    #[Test]
    public function the_middleware_runs_inside_the_static_cache(): void
    {
        $group = app('router')->getMiddlewareGroups()['statamic.web'];

        $this->assertContains(InjectAssets::class, $group);
        $this->assertGreaterThan(
            array_search(\Statamic\StaticCaching\Middleware\Cache::class, $group, true),
            array_search(InjectAssets::class, $group, true),
            'after Cache in the group = runs before it on the way out, so the cached HTML is final',
        );
    }

    #[Test]
    public function the_middleware_removes_the_markers_once_a_tag_printed_the_assets(): void
    {
        config(['statamic.consent.categories.media' => true]);

        $html = $this->throughMiddleware(fn () => $this->page('{{ consent:youtube id="dQw4w9WgXcQ" }}', self::LAYOUT));

        $this->assertStringNotContainsString(Assets::MARKER, $html);
        $this->assertSame(1, substr_count($html, 'consent.js?v='));
        $this->assertStringContainsString('consent.js?v=', $this->headOf($html));
    }

    #[Test]
    public function the_middleware_puts_the_assets_into_the_head_when_the_layout_has_no_consent_tags(): void
    {
        $html = $this->throughMiddleware(fn () => $this->page('{{ consent:map address="Marienplatz 1, München" }}', '<html><head><title>x</title></head><body>{{ template_content }}</body></html>'));

        $this->assertStringNotContainsString(Assets::MARKER, $html);
        $this->assertSame(1, substr_count($html, 'consent.js?v='));
        $this->assertSame(1, substr_count($html, 'consent.css?v='));
        $this->assertMatchesRegularExpression('#<title>x</title><link rel="stylesheet" href="[^"]+consent\.css\?v=[0-9a-f]{12}">\s*<script type="module" src="[^"]+consent\.js\?v=[0-9a-f]{12}"></script>\s*</head>#', $html);
    }

    #[Test]
    public function the_middleware_leaves_other_responses_alone(): void
    {
        $json = $this->throughMiddleware(fn () => json_encode(['text' => Assets::MARKER]), 'application/json');

        $this->assertStringContainsString('statamic-consent:assets', $json);
    }

    #[Test]
    public function inject_without_a_head_element_uses_the_first_marker(): void
    {
        config(['statamic.consent.categories.media' => true]);

        $html = Assets::inject('<div>'.Assets::MARKER.'</div><div>'.Assets::MARKER.'</div>', \Marcodes\Consent\Support\Settings::fromConfig());

        $this->assertMatchesRegularExpression('#^<div><link rel="stylesheet"[^>]+>\s*<script type="module"[^>]+></script>\s*</div><div></div>$#', $html);
    }
}
