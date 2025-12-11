<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClientFinancialRecord extends Model
{
    use HasFactory;

    protected $table = 'client_financial_records';
    protected $primaryKey = 'record_id';

    protected $fillable = [
        'client_id',
        'period',
        'fixed_deposit',
        'savings',
        'loan_balance',
        'arrears',
        'fines',
        'mortuary',
        'uploaded_date',
        'assigned_mediator',
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

    // Computed attributes
    public function getTotalAssetsAttribute(): float
    {
        return (float) ($this->fixed_deposit + $this->savings);
    }

    public function getTotalLiabilitiesAttribute(): float
    {
        return (float) ($this->loan_balance + $this->arrears + $this->fines);
    }

    public function getNetWorthAttribute(): float
    {
        return $this->total_assets - $this->total_liabilities;
    }

    // Scopes
    public function scopeByPeriod($query, $period)
    {
        return $query->where('period', $period);
    }

    public function scopeByPeriods($query, array $periods)
    {
        return $query->whereIn('period', $periods);
    }

    public function scopeWithArrears($query)
    {
        return $query->where('arrears', '>', 0);
    }

    public function scopeWithLoans($query)
    {
        return $query->where('loan_balance', '>', 0);
    }

    public function scopeByMediator($query, $mediatorName)
    {
        return $query->where('assigned_mediator', $mediatorName);
    }

    // Relationship
    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id', 'client_id');
    }

    // Compare with another period (calculate changes)
    public function compareWith(ClientFinancialRecord $otherRecord)
    {
        return [
            'fixed_deposit_change' => $this->fixed_deposit - $otherRecord->fixed_deposit,
            'savings_change' => $this->savings - $otherRecord->savings,
            'loan_balance_change' => $this->loan_balance - $otherRecord->loan_balance,
            'arrears_change' => $this->arrears - $otherRecord->arrears,
            'fines_change' => $this->fines - $otherRecord->fines,
            'mortuary_change' => $this->mortuary - $otherRecord->mortuary,
            'net_worth_change' => $this->net_worth - $otherRecord->net_worth,
        ];
    }
}