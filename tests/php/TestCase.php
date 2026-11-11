<?php

namespace Marcodes\Consent\Tests;

use Marcodes\Consent\ServiceProvider;
use Illuminate\Support\Facades\File;
use Statamic\Facades\Site;
use Statamic\Testing\AddonTestCase;

abstract class TestCase extends AddonTestCase
{
    protected string $addonServiceProvider = ServiceProvider::class;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'statamic.consent.google_analytics_id' => null,
            'statamic.consent.categories.media' => false,
        ]);
    }

    protected function antlers(string $template, array $context = []): string
    {
        // Every render is a new page: reset the once-per-request flags.
        request()->attributes->remove('statamic-consent.assets');
        request()->attributes->remove('statamic-consent.assets-pending');
        request()->attributes->remove('statamic-consent.gates');

        // Rendered as a template file like a site's layout (Antlers::parse()
        // would treat the string as user content, where tags are not allowed).
        $directory = __DIR__.'/../__fixtures__/views';
        File::ensureDirectoryExists($directory);
        $file = $directory.'/'.md5($template.microtime()).'.antlers.html';
        File::put($file, $template);

        try {
            return view()->file($file, $context)->render();
        } finally {
            File::delete($file);
        }
    }

    protected function useLanguage(string $lang): void
    {
        Site::setSites([
            'default' => ['name' => 'Site', 'locale' => $lang === 'de' ? 'de_DE' : 'en_US', 'lang' => $lang, 'url' => '/'],
        ]);
    }

    /** The HTML with every <template> element removed. */
    protected function withoutTemplates(string $html): string
    {
        return preg_replace('#<template\b[^>]*>.*?</template>#is', '', $html);
    }
}
