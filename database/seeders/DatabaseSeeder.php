<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ...existing code...
        $this->createDefaultUsers();
        // ...existing code...
    }

    private function createDefaultUsers(): void
    {
        // Create default admin user
        User::create([
            'name' => 'Admin User',
            'email' => 'admin@mediation.local',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'position' => 'System Administrator',
        ]);

        // Create sample mediator
        User::create([
            'name' => 'John Mediator',
            'email' => 'mediator@mediation.local',
            'password' => Hash::make('password'),
            'role' => 'mediator',
            'position' => 'Senior Mediator',
        ]);
    }
}