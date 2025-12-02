<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class SessionMediator extends Pivot
{
    protected $table = 'session_mediators';
    protected $primaryKey = 'session_mediator_id';
    public $incrementing = true;

    protected $fillable = [
        'session_id',
        'mediator_user_id',
        'assigned_at',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
    ];

    // Relationships
    public function session()
    {
        return $this->belongsTo(MediationSession::class, 'session_id', 'session_id');
    }

    public function mediator()
    {
        return $this->belongsTo(User::class, 'mediator_user_id', 'user_id');
    }
}