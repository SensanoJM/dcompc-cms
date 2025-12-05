<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    use HasFactory;

    protected $table = 'clients';
    protected $primaryKey = 'client_id';

    protected $fillable = [
        'client_id',
        'name',
        'fixed_deposit',
        'savings',
        'loan_balance',
        'arrears',
        'fines',
        'mortuary',
        'uploaded_date',
        'period',
    ];

    protected $casts = [
        'fixed_deposit' => 'decimal:2',
        'savings' => 'decimal:2',
        'loan_balance' => 'decimal:2',
        'arrears' => 'decimal:2',
        'fines' => 'decimal:2',
        'mortuary' => 'decimal:2',
        'uploaded_date' => 'date',
    ];

    // Accessor for full name
    public function getFullNameAttribute(): string
    {
        return $this->name;
    }

    // Accessor for total assets
    public function getTotalAssetsAttribute(): float
    {
        return (float) ($this->fixed_deposit + $this->savings);
    }

    // Accessor for total liabilities
    public function getTotalLiabilitiesAttribute(): float
    {
        return (float) ($this->loan_balance + $this->arrears + $this->fines);
    }

    // Accessor for net worth
    public function getNetWorthAttribute(): float
    {
        return $this->total_assets - $this->total_liabilities;
    }

    // Scope: Search by name
    public function scopeSearch($query, $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('name', 'LIKE', "%{$search}%")
              ->orWhere('client_id', $search)
              ->orWhere('period', 'LIKE', "%{$search}%");
        });
    }

    // Scope: Filter by period
    public function scopeByPeriod($query, $period)
    {
        return $query->where('period', $period);
    }

    // Scope: Filter by date range
    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('uploaded_date', [$startDate, $endDate]);
    }

    // Scope: Clients with arrears
    public function scopeWithArrears($query)
    {
        return $query->where('arrears', '>', 0);
    }

    // Scope: Clients with loans
    public function scopeWithLoans($query)
    {
        return $query->where('loan_balance', '>', 0);
    }

    // Relationships
    public function sessions()
    {
        return $this->belongsToMany(
            MediationSession::class,
            'session_clients',
            'client_id',
            'session_id',
            'client_id',
            'session_id'
        )->withTimestamps('assigned_at');
    }

    // Get latest session
    public function latestSession()
    {
        return $this->sessions()->latest('session_date')->first();
    }

    // Count total sessions
    public function getTimesScheduledAttribute(): int
    {
        return $this->sessions()->count();
    }
}