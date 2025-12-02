<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MediationSession extends Model
{
    use HasFactory;

    protected $table = 'mediation_sessions';
    protected $primaryKey = 'session_id';

    protected $fillable = [
        'session_number',
        'session_date',
        'times_scheduled',
        'remarks',
        'created_by_user_id',
    ];

    protected $casts = [
        'session_date' => 'date',
        'times_scheduled' => 'integer',
    ];

    // Boot method to auto-generate session number
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($session) {
            if (empty($session->session_number)) {
                $session->session_number = self::generateSessionNumber();
            }
        });
    }

    // Generate unique session number
    public static function generateSessionNumber(): string
    {
        $date = now()->format('Ymd');
        $count = self::whereDate('created_at', today())->count() + 1;
        return "MED-{$date}-" . str_pad($count, 4, '0', STR_PAD_LEFT);
    }

    // Scope: Upcoming sessions
    public function scopeUpcoming($query)
    {
        return $query->where('session_date', '>=', now()->toDateString())
                     ->orderBy('session_date', 'asc');
    }

    // Scope: Past sessions
    public function scopePast($query)
    {
        return $query->where('session_date', '<', now()->toDateString())
                     ->orderBy('session_date', 'desc');
    }

    // Scope: Today's sessions
    public function scopeToday($query)
    {
        return $query->whereDate('session_date', today());
    }

    // Scope: By date range
    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('session_date', [$startDate, $endDate]);
    }

    // Relationships
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by_user_id', 'user_id');
    }

    public function clients()
    {
        return $this->belongsToMany(
            Client::class,
            'session_clients',
            'session_id',
            'client_id',
            'session_id',
            'client_id'
        )->withTimestamps('assigned_at');
    }

    public function mediators()
    {
        return $this->belongsToMany(
            User::class,
            'session_mediators',
            'session_id',
            'mediator_user_id',
            'session_id',
            'user_id'
        )->withTimestamps('assigned_at');
    }

    // Get client count
    public function getClientCountAttribute(): int
    {
        return $this->clients()->count();
    }

    // Get mediator count
    public function getMediatorCountAttribute(): int
    {
        return $this->mediators()->count();
    }

    // Check if session is today
    public function isTodayAttribute(): bool
    {
        return $this->session_date->isToday();
    }

    // Check if session is upcoming
    public function isUpcomingAttribute(): bool
    {
        return $this->session_date->isFuture();
    }

    // Check if session is past
    public function isPastAttribute(): bool
    {
        return $this->session_date->isPast();
    }
}