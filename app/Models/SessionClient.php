<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class SessionClient extends Pivot
{
    protected $table = 'session_clients';
    protected $primaryKey = 'session_client_id';
    public $incrementing = true;

    protected $fillable = [
        'session_id',
        'client_id',
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

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id', 'client_id');
    }
}