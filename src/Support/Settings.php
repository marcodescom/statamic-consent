<?php

namespace Marcodes\Consent\Support;

use Statamic\Facades\Site;

/**
 * Validated view of config("statamic.consent"). Every value that reaches the
 * HTML passes through here, so a broken config never produces broken markup
 * or loads Google code by accident.
 */
class Settings
{
    public const GA_ID_PATTERN = '/^G-[A-Z0-9]{4,20}$/';

    public const SERVICES = ['youtube', 'vimeo', 'google_maps'];

    public function __construct(private array $config = [])
    {
    }

    public static function fromConfig(): self
    {
        return new self((array) config('statamic.consent', []));
    }

    public static function validMeasurementId(mixed $value): ?string
    {
        $id = strtoupper(trim((string) $value));

        return preg_match(self::GA_ID_PATTERN, $id) ? $id : null;
    }

    public function measurementId(): ?string
    {
        return self::validMeasurementId($this->config['google_analytics_id'] ?? null);
    }

    public function version(): string
    {
        $version = trim((string) ($this->config['version'] ?? '1'));

        return $version === '' ? '1' : $version;
    }

    public function maxAgeDays(): int
    {
        $days = (int) ($this->config['max_age_days'] ?? 365);

        return $days > 0 ? $days : 365;
    }

    public function storageKey(): string
    {
        $key = trim((string) ($this->config['storage_key'] ?? 'consent'));

        return $key === '' ? 'consent' : $key;
    }

    /** @return list<string> */
    public function legacyStorageKeys(): array
    {
        return $this->stringList($this->config['legacy_storage_keys'] ?? []);
    }

    /** @return list<string> */
    public function openHashes(): array
    {
        return $this->stringList($this->config['open_hashes'] ?? ['#consent-settings']);
    }

    public function categoryEnabled(string $category): bool
    {
        return (bool) ($this->config['categories'][$category] ?? false);
    }

    public function statisticsInUse(): bool
    {
        return $this->categoryEnabled('statistics') && $this->measurementId() !== null;
    }

    public function mediaInUse(): bool
    {
        return $this->categoryEnabled('media') && $this->enabledServices() !== [];
    }

    /**
     * Categories the banner asks about, in display order.
     *
     * @return list<string>
     */
    public function categories(): array
    {
        return array_values(array_filter([
            $this->statisticsInUse() ? 'statistics' : null,
            $this->mediaInUse() ? 'media' : null,
        ]));
    }

    /** True when there is anything to ask: otherwise no banner and no settings link. */
    public function active(): bool
    {
        return $this->categories() !== [];
    }

    public function serviceEnabled(string $service): bool
    {
        return in_array($service, self::SERVICES, true) && (bool) ($this->config['services'][$service] ?? true);
    }

    /** @return list<string> */
    public function enabledServices(): array
    {
        return array_values(array_filter(self::SERVICES, fn ($service) => $this->serviceEnabled($service)));
    }

    public function googleSignals(): bool
    {
        return (bool) ($this->config['google_analytics']['google_signals'] ?? true);
    }

    public function adPersonalizationSignals(): bool
    {
        return (bool) ($this->config['google_analytics']['ad_personalization_signals'] ?? false);
    }

    /** "auto" or a plain domain like ".example.com". */
    public function cookieDomain(): string
    {
        $domain = strtolower(trim((string) ($this->config['google_analytics']['cookie_domain'] ?? 'auto')));

        if ($domain === 'auto' || $domain === '') {
            return 'auto';
        }

        return preg_match('/^\.?[a-z0-9-]+(\.[a-z0-9-]+)+$/', $domain) ? $domain : 'auto';
    }

    /**
     * Privacy URL for the current site: by site handle, then language, then
     * locale, then "default", then the first entry.
     */
    public function privacyUrl(): ?string
    {
        $value = $this->config['privacy_url'] ?? null;

        if (is_array($value)) {
            $site = Site::current();
            $candidates = $site ? [$site->handle(), $site->lang(), $site->locale(), 'default'] : ['default'];
            $url = null;
            foreach ($candidates as $key) {
                if (is_string($key) && isset($value[$key])) {
                    $url = $value[$key];
                    break;
                }
            }
            $value = $url ?? (reset($value) ?: null);
        }

        $value = is_string($value) ? trim($value) : '';

        // Relative paths, anchors and http(s) only: no "javascript:" and friends.
        if ($value === '' || ! preg_match('#^(/|\#|https?://)#i', $value)) {
            return null;
        }

        return $value;
    }

    public const POSITIONS = ['bottom-left', 'bottom-center', 'bottom-right', 'center', 'bar'];

    public function position(): string
    {
        $position = strtolower(trim((string) ($this->config['position'] ?? 'bottom-left')));

        return in_array($position, self::POSITIONS, true) ? $position : 'bottom-left';
    }

    public function theme(): string
    {
        return ($this->config['theme'] ?? 'auto') === 'manual' ? 'manual' : 'auto';
    }

    public function themeAccentSelector(): ?string
    {
        $selector = trim((string) ($this->config['theme_accent_selector'] ?? ''));

        return $selector === '' ? null : $selector;
    }

    public function assetsEnabled(): bool
    {
        return (bool) ($this->config['assets']['enabled'] ?? true);
    }

    public function assetUrl(string $file): string
    {
        $base = $this->config['assets']['url'] ?? null;
        $base = is_string($base) && $base !== '' ? rtrim($base, '/') : rtrim(asset('vendor/statamic-consent'), '/');
        $path = dirname(__DIR__, 2).'/dist/'.$file;
        $version = is_file($path) ? substr(md5_file($path), 0, 12) : '0';

        return "{$base}/{$file}?v={$version}";
    }

    /** @return list<string> */
    private function stringList(mixed $value): array
    {
        return array_values(array_filter(
            array_map(fn ($item) => is_string($item) ? trim($item) : '', (array) $value),
            fn ($item) => $item !== ''
        ));
    }
}
