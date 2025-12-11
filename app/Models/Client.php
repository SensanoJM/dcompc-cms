<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    use HasFactory;

    protected $table = 'clients';
    protected $primaryKey = 'client_uuid'; // Actual DB PK
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'client_id',
        'name',
    ];

    // Scope: Search by name
    public function scopeSearch($query, $search)
    {
        return $query->where('name', 'LIKE', "%{$search}%");
    }

    // Relationships
    public function financialRecords()
    {
        // relationship logic: local_key on Client is 'client_id' (external), foreign_key on Record is 'client_id'
        return $this->hasMany(ClientFinancialRecord::class, 'client_id', 'client_id');
    }

    public function sessions()
    {
        return $this->belongsToMany(
            MediationSession::class,
            'session_clients',
            'client_id',
            'session_id',
            'client_id', // Local key on Client (external ID)
            'session_id'
        )->withPivot('assigned_at'); // No timestamps on pivot
    }

    // Get financial record for specific period
    public function getFinancialForPeriod($period)
    {
        return $this->financialRecords()->where('period', $period)->first();
    }

    // Get latest financial record
    public function latestFinancial()
    {
        return $this->financialRecords()->latest('uploaded_date')->first();
    }

    // Get financial records in period range
    public function financialsInRange($periods)
    {
        return $this->financialRecords()->whereIn('period', $periods)->get();
    }

    // Get all periods for this client
    public function getAllPeriods()
    {
        return $this->financialRecords()
            ->orderBy('uploaded_date')
            ->pluck('period')
            ->unique();
    }

    // Count total sessions across all periods
    public function getTotalSessionsAttribute(): int
    {
        return $this->sessions()->count();
    }
}