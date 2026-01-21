<?php

namespace App\Services\Backup\DTO;

/**
 * DTO to track mapping between public IDs and internal IDs during import.
 */
class ImportIdMapping
{
    /**
     * The mapping array: [entity_type => [public_id => internal_id]]
     */
    private array $map = [];

    /**
     * Set a mapping for an entity.
     */
    public function set(string $entityType, string $publicId, int $internalId): void
    {
        $this->map[$entityType][$publicId] = $internalId;
    }

    /**
     * Get the internal ID for a public ID.
     */
    public function get(string $entityType, string $publicId): ?int
    {
        return $this->map[$entityType][$publicId] ?? null;
    }

    /**
     * Get the internal ID or throw an exception if not found.
     */
    public function getOrFail(string $entityType, string $publicId): int
    {
        $id = $this->get($entityType, $publicId);
        
        if ($id === null) {
            throw new \RuntimeException("No mapping found for {$entityType}:{$publicId}");
        }

        return $id;
    }

    /**
     * Check if a mapping exists.
     */
    public function has(string $entityType, string $publicId): bool
    {
        return isset($this->map[$entityType][$publicId]);
    }

    /**
     * Get all mappings for an entity type.
     */
    public function getAllForType(string $entityType): array
    {
        return $this->map[$entityType] ?? [];
    }

    /**
     * Get the entire mapping array.
     */
    public function toArray(): array
    {
        return $this->map;
    }

    /**
     * Clear all mappings.
     */
    public function clear(): void
    {
        $this->map = [];
    }
}
