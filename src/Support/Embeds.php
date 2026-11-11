<?php

namespace Marcodes\Consent\Support;

/**
 * Builds and validates the embed URLs of the gated services. Anything that
 * does not match returns null, the tag then renders nothing.
 */
class Embeds
{
    /** YouTube video id from an id or a watch, share, embed or shorts URL. */
    public static function youtubeId(?string $value): ?string
    {
        $value = trim((string) $value);

        if (preg_match('/^[A-Za-z0-9_-]{11}$/', $value)) {
            return $value;
        }

        $patterns = [
            '#^https?://(?:www\.|m\.)?youtube(?:-nocookie)?\.com/(?:embed|shorts|live|v)/([A-Za-z0-9_-]{11})#i',
            '#^https?://(?:www\.|m\.)?youtube\.com/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})#i',
            '#^https?://youtu\.be/([A-Za-z0-9_-]{11})#i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $value, $match)) {
                return $match[1];
            }
        }

        return null;
    }

    /** Embed URL on youtube-nocookie.com. */
    public static function youtubeUrl(string $id, array $options = []): string
    {
        $query = array_filter([
            'start' => self::seconds($options['start'] ?? null),
            'rel' => '0',
            'hl' => $options['lang'] ?? null,
        ], fn ($value) => $value !== null && $value !== '');

        return 'https://www.youtube-nocookie.com/embed/'.$id.($query ? '?'.http_build_query($query) : '');
    }

    /**
     * Vimeo id and optional privacy hash (unlisted videos) from an id or a
     * vimeo.com / player.vimeo.com URL.
     *
     * @return array{0: string, 1: ?string}|null
     */
    public static function vimeoId(?string $value, ?string $hash = null): ?array
    {
        $value = trim((string) $value);
        $hash = self::vimeoHash($hash);

        if (preg_match('/^\d{1,12}$/', $value)) {
            return [$value, $hash];
        }

        if (preg_match('#^https?://player\.vimeo\.com/video/(\d{1,12})(?:\?(.*))?$#i', $value, $match)) {
            parse_str($match[2] ?? '', $query);

            return [$match[1], $hash ?? self::vimeoHash($query['h'] ?? null)];
        }

        if (preg_match('#^https?://(?:www\.)?vimeo\.com/(?:.*/)?(\d{1,12})(?:/([0-9a-f]{6,20}))?(?:[/?\#].*)?$#i', $value, $match)) {
            return [$match[1], $hash ?? self::vimeoHash($match[2] ?? null)];
        }

        return null;
    }

    /** Player URL with Do Not Track (no Vimeo cookies for tracking). */
    public static function vimeoUrl(string $id, ?string $hash = null, array $options = []): string
    {
        $query = array_filter([
            'h' => $hash,
            'dnt' => '1',
        ], fn ($value) => $value !== null && $value !== '');

        $url = 'https://player.vimeo.com/video/'.$id.'?'.http_build_query($query);
        $start = self::seconds($options['start'] ?? null);

        return $start ? $url.'#t='.$start.'s' : $url;
    }

    /** A Google Maps embed URL (https, Google host, /maps path) or null. */
    public static function mapUrl(?string $src): ?string
    {
        $src = trim(html_entity_decode((string) $src, ENT_QUOTES | ENT_HTML5));

        if (! preg_match('#^https://(?:www\.|maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?/maps(?:/embed)?(?:[/?].*)?$#i', $src)) {
            return null;
        }

        return $src;
    }

    /** Keyless Google Maps embed URL for an address or search query. */
    public static function mapQueryUrl(string $query, ?int $zoom = null, ?string $lang = null): ?string
    {
        $query = trim($query);

        if ($query === '') {
            return null;
        }

        return 'https://www.google.com/maps?'.http_build_query(array_filter([
            'q' => $query,
            'z' => $zoom && $zoom >= 1 && $zoom <= 21 ? $zoom : null,
            'hl' => $lang,
            'output' => 'embed',
        ], fn ($value) => $value !== null && $value !== ''));
    }

    /** "16/9", "16:9", "4 / 3" to "16 / 9"; "auto" or "none" to null; anything else to the default. */
    public static function ratio(?string $value, string $default = '16 / 9'): ?string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return $default;
        }

        if (in_array(strtolower($value), ['auto', 'none'], true)) {
            return null;
        }

        if (preg_match('#^(\d{1,4}(?:\.\d{1,3})?)\s*[/:x]\s*(\d{1,4}(?:\.\d{1,3})?)$#', $value, $match) && (float) $match[2] > 0) {
            return $match[1].' / '.$match[2];
        }

        return $default;
    }

    private static function vimeoHash(mixed $hash): ?string
    {
        $hash = trim((string) $hash);

        return preg_match('/^[0-9a-f]{6,20}$/i', $hash) ? $hash : null;
    }

    private static function seconds(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value) && (int) $value >= 0) {
            return (string) (int) $value;
        }

        // "1m30s", "90s", "1h2m3s"
        if (is_string($value) && preg_match('/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/', $value, $match) && $value !== '') {
            return (string) (((int) ($match[1] ?? 0)) * 3600 + ((int) ($match[2] ?? 0)) * 60 + (int) ($match[3] ?? 0));
        }

        return null;
    }
}
