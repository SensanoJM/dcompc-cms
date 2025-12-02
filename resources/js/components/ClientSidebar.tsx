import React, { useState } from 'react';
import { X, Calendar, DollarSign, Clock, Plus, History } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

// Local frontend types for Client and Remark. These are intentionally minimal
// and mirror the fields used by this component. If you have a shared types
// file for frontend types, move these definitions there and import them.
export interface Client {
    client_id: number;
    first_name: string;
    last_name: string;
    period: string;
    savings: number;
    fixed_deposit: number;
    loan_balance: number;
    arrears: number;
    fines: number;
    mortuary: number;
}

export interface Remark {
    id: number;
    date: string; // ISO date or human readable
    text: string;
    author: string;
}

interface ClientSidebarProps {
    client: Client | null;
    isOpen: boolean;
    onClose: () => void;
}

const MOCK_REMARKS: Remark[] = [
    { id: 1, date: '2025-11-10', text: 'Initial intake completed.', author: 'Admin' },
    { id: 2, date: '2025-11-18', text: 'Follow-up call — scheduled session.', author: 'Mediator A' },
];

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
};

export default function ClientSidebar({ client, isOpen, onClose }: ClientSidebarProps) {
    const [remarks, setRemarks] = useState<Remark[]>(MOCK_REMARKS);
    const [newRemark, setNewRemark] = useState('');

    const handleAddRemark = () => {
        if (!newRemark.trim()) return;
        const remark: Remark = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            text: newRemark,
            author: 'Current User'
        };
        setRemarks([remark, ...remarks]);
        setNewRemark('');
    };

    return (
        <div
            className={`fixed inset-y-0 right-0 z-50 w-[400px] bg-background shadow-2xl transition-transform duration-300 ease-in-out border-l border-border flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
        >
            {client ? (
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-border">
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight">{client.first_name} {client.last_name}</h2>
                            <p className="text-sm text-muted-foreground">ID: #{client.client_id} • Period: {client.period}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button className="w-full gap-2">
                                <Calendar className="h-4 w-4" />
                                Schedule Session
                            </Button>
                            <Button variant="outline" className="w-full gap-2">
                                <History className="h-4 w-4" />
                                View Logs
                            </Button>
                        </div>

                        {/* Financial Overview */}
                        <div>
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
                                <DollarSign className="h-4 w-4" /> Financial Overview
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Savings</p>
                                    <p className="text-lg font-bold text-green-600">{formatCurrency(client.savings)}</p>
                                </div>
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Fixed Deposit</p>
                                    <p className="text-lg font-bold text-blue-600">{formatCurrency(client.fixed_deposit)}</p>
                                </div>
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Loan Balance</p>
                                    <p className="text-lg font-bold text-orange-600">{formatCurrency(client.loan_balance)}</p>
                                </div>
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Arrears</p>
                                    <p className="text-lg font-bold text-red-600">{formatCurrency(client.arrears)}</p>
                                </div>
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Fines</p>
                                    <p className="font-semibold">{formatCurrency(client.fines)}</p>
                                </div>
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Mortuary</p>
                                    <p className="font-semibold">{formatCurrency(client.mortuary)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Session Stats */}
                        <div>
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
                                <Clock className="h-4 w-4" /> Mediation Stats
                            </h3>
                            <div className="flex items-center justify-between p-4 rounded-lg border border-dashed border-border">
                                <span className="text-sm text-muted-foreground">Times Scheduled</span>
                                <span className="text-xl font-bold">2</span>
                            </div>
                        </div>

                        {/* Remarks History */}
                        <div>
                            <h3 className="text-sm font-medium mb-3 text-foreground">Remarks History</h3>

                            <div className="mb-4 space-y-2">
                                <div className="relative">
                                    <Input
                                        placeholder="Add a new remark..."
                                        value={newRemark}
                                        onChange={(e) => setNewRemark(e.target.value)}
                                        className="pr-10"
                                    />
                                    <button
                                        onClick={handleAddRemark}
                                        className="absolute right-2 top-2 text-primary hover:text-primary/80"
                                    >
                                        <Plus className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {remarks.map((remark) => (
                                    <div key={remark.id} className="relative pl-4 border-l-2 border-border pb-1">
                                        <div className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-border" />
                                        <p className="text-xs text-muted-foreground mb-1">
                                            {remark.date} by <span className="font-medium text-foreground">{remark.author}</span>
                                        </p>
                                        <p className="text-sm bg-secondary/50 p-2 rounded-md">
                                            {remark.text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-border bg-secondary/10">
                        <Button variant="secondary" className="w-full" onClick={onClose}>Close Sidebar</Button>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                    <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-4">
                        <span className="text-2xl">👋</span>
                    </div>
                    <p>Select a client to view details</p>
                </div>
            )}
        </div>
    );
}
