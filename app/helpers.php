<?php

if (!function_exists('tenant')) {
    /**
     * Get the current tenant instance from the service container
     * 
     * @return \App\Models\Tenant|null
     */
    function tenant(): ?\App\Models\Tenant
    {
        return app()->bound('currentTenant') ? app('currentTenant') : null;
    }
}
