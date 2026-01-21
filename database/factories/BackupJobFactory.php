<?php

namespace Database\Factories;

use App\Models\BackupJob;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\BackupJob>
 */
class BackupJobFactory extends Factory
{
    protected $model = BackupJob::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'user_id' => User::factory(),
            'type' => $this->faker->randomElement([BackupJob::TYPE_EXPORT, BackupJob::TYPE_IMPORT]),
            'status' => $this->faker->randomElement([
                BackupJob::STATUS_PENDING,
                BackupJob::STATUS_PROCESSING,
                BackupJob::STATUS_COMPLETED,
                BackupJob::STATUS_FAILED,
            ]),
            'progress_percent' => $this->faker->numberBetween(0, 100),
            'current_step' => $this->faker->optional()->sentence(3),
            'options' => [],
            'public_id' => (string) Str::uuid(),
        ];
    }

    /**
     * Indicate that the job is pending.
     */
    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => BackupJob::STATUS_PENDING,
            'progress_percent' => 0,
            'current_step' => null,
        ]);
    }

    /**
     * Indicate that the job is processing.
     */
    public function processing(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => BackupJob::STATUS_PROCESSING,
            'progress_percent' => $this->faker->numberBetween(10, 90),
            'started_at' => now(),
        ]);
    }

    /**
     * Indicate that the job is completed.
     */
    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => BackupJob::STATUS_COMPLETED,
            'progress_percent' => 100,
            'started_at' => now()->subMinutes(5),
            'completed_at' => now(),
            'file_path' => 'backups/' . Str::random(20) . '.zip',
            'file_size' => $this->faker->numberBetween(1024, 1024 * 1024 * 100),
            'checksum' => hash('sha256', Str::random(100)),
            'stats' => [
                'invoices' => $this->faker->numberBetween(0, 50),
                'contacts' => $this->faker->numberBetween(0, 100),
                'products' => $this->faker->numberBetween(0, 200),
            ],
        ]);
    }

    /**
     * Indicate that the job failed.
     */
    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => BackupJob::STATUS_FAILED,
            'progress_percent' => $this->faker->numberBetween(10, 90),
            'started_at' => now()->subMinutes(2),
            'error_message' => $this->faker->sentence(),
            'error_details' => ['exception' => 'RuntimeException'],
        ]);
    }

    /**
     * Indicate that the job is an export.
     */
    public function export(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => BackupJob::TYPE_EXPORT,
        ]);
    }

    /**
     * Indicate that the job is an import.
     */
    public function import(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => BackupJob::TYPE_IMPORT,
        ]);
    }
}
