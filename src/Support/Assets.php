<?php

namespace Marcodes\Consent\Support;

/**
 * Stylesheet and script of the addon, printed once per request and always in
 * <head> when the layout has {{ consent:head }}.
 *
 * Statamic renders the page template before the layout, so a gate in the page
 * template runs before {{ consent:head }}. A gate therefore never prints the
 * assets itself: it leaves a marker and notes that the page needs them.
 * {{ consent:head }} (or {{ consent:banner }}) then prints them, and the
 * InjectAssets middleware removes the markers. Only when no tag printed the
 * assets does the middleware insert them before </head>. The HTML is complete
 * before the static cache stores it, and no inline code is added (strict CSP).
 */
class Assets
{
    public const PRINTED = 'statamic-consent.assets';

    public const PENDING = 'statamic-consent.assets-pending';

    public const MARKER = '<!--statamic-consent:assets-->';

    /** The <link> and <script> tags, once per request; '' when already printed or switched off. */
    public static function once(Settings $settings): string
    {
        if (! $settings->assetsEnabled() || self::printed()) {
            return '';
        }

        request()->attributes->set(self::PRINTED, true);

        return self::tags($settings);
    }

    /** For gates: a marker instead of the tags, unless they are printed already. */
    public static function defer(Settings $settings): string
    {
        if (! $settings->assetsEnabled() || self::printed()) {
            return '';
        }

        request()->attributes->set(self::PENDING, true);

        return self::MARKER;
    }

    public static function printed(): bool
    {
        return (bool) request()->attributes->get(self::PRINTED);
    }

    /** True when a gate on this page asked for the assets and they are not printed yet. */
    public static function pending(): bool
    {
        return (bool) request()->attributes->get(self::PENDING) && ! self::printed();
    }

    /**
     * Removes the markers. When nothing printed the assets yet, inserts them
     * before </head>, or where the first marker was when there is no </head>.
     */
    public static function inject(string $html, Settings $settings): string
    {
        if (! str_contains($html, self::MARKER)) {
            return $html;
        }

        $tags = self::once($settings);

        if ($tags !== '') {
            $head = stripos($html, '</head>');
            $html = $head !== false
                ? substr_replace($html, $tags, $head, 0)
                : preg_replace('/'.preg_quote(self::MARKER, '/').'/', $tags, $html, 1);
        }

        return str_replace(self::MARKER, '', $html);
    }

    public static function tags(Settings $settings): string
    {
        return view('statamic-consent::assets', [
            'css' => $settings->assetUrl('consent.css'),
            'js' => $settings->assetUrl('consent.js'),
        ])->render();
    }
}
