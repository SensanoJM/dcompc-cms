import React, { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { clients } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import {
    DollarSign, Clock, Plus, History, Check, FilePenLine,
    TrendingUp, TrendingDown, Minus, Calendar as CalendarIcon, X, Trash2,
} from 'lucide-react';
import DeleteClientsModal from '@/components/DeleteClientsModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface ClientFinancialRecord {
    period: string;
    savings: number;
    fixed_deposit: number;
    loan_balance: number;
    arrears: number;
    fines: number;
    mortuary: number;
    assigned_mediator?: string;
    uploaded_date?: string;
}

interface Client {
    client_id: number;
    name: string;
    period?: string;
    savings?: number;
    fixed_deposit?: number;
    loan_balance?: number;
    arrears?: number;
    fines?: number;
    mortuary?: number;
    assigned_mediator?: string;
    financial_records?: ClientFinancialRecord[];
    total_financials?: {
        savings: number;
        fixed_deposit: number;
        loan_balance: number;
        arrears: number;
        fines: number;
        mortuary: number;
    };
}

interface Remark {
    id: number;
    date: string;
    text: string;
    author: string;
}

interface Props {
    client: Client;
}

const MOCK_REMARKS: Remark[] = [
    { id: 1, date: '2025-11-10', text: 'Initial intake completed.', author: 'Admin' },
    { id: 2, date: '2025-11-18', text: 'Follow-up call — scheduled session.', author: 'Mediator A' },
];

const formatCurrency = (value: number | undefined | null) => {
    const num = Number(value);
    if (isNaN(num)) return '₱0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(num);
};

export default function ClientShow({ client }: Props) {
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all_time');
    const [comparisonPeriod, setComparisonPeriod] = useState<string>('');
    const [mediator, setMediator] = useState<string>('');
    const [isEditingMediator, setIsEditingMediator] = useState(false);
    const [remarks, setRemarks] = useState<Remark[]>(MOCK_REMARKS);
    const [newRemark, setNewRemark] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Clients', href: clients().url },
        { title: client.name, href: '#' },
    ];

    const periods = useMemo(() => {
        if (!client?.financial_records) return [];
        return client.financial_records.map(r => r.period).filter(Boolean);
    }, [client]);

    const getRecordByPeriod = (period: string) =>
        client?.financial_records?.find(r => r.period === period) ?? null;

    const displayData = useMemo(() => {
        if (!client) return null;
        const sum = (a: unknown, b: unknown) => Number(a || 0) + Number(b || 0);

        if (selectedPeriod && selectedPeriod !== 'all_time') {
            const current = getRecordByPeriod(selectedPeriod);

            if (comparisonPeriod && comparisonPeriod !== 'no_comparison') {
                const compare = getRecordByPeriod(comparisonPeriod);
                const base = current ?? compare ?? {};
                return {
                    ...client, ...base,
                    savings: sum(current?.savings, compare?.savings),
                    fixed_deposit: sum(current?.fixed_deposit, compare?.fixed_deposit),
                    loan_balance: sum(current?.loan_balance, compare?.loan_balance),
                    arrears: sum(current?.arrears, compare?.arrears),
                    fines: sum(current?.fines, compare?.fines),
                    mortuary: sum(current?.mortuary, compare?.mortuary),
                    assigned_mediator: current?.assigned_mediator ?? compare?.assigned_mediator,
                };
            }

            if (current) return { ...client, ...current };
        } else {
            if (client.total_financials) {
                return {
                    ...client,
                    savings: Number(client.total_financials.savings || 0),
                    fixed_deposit: Number(client.total_financials.fixed_deposit || 0),
                    loan_balance: Number(client.total_financials.loan_balance || 0),
                    arrears: Number(client.total_financials.arrears || 0),
                    fines: Number(client.total_financials.fines || 0),
                    mortuary: Number(client.total_financials.mortuary || 0),
                    assigned_mediator: 'None',
                };
            }

            if (client.financial_records?.length) {
                const totals = client.financial_records.reduce(
                    (acc, r) => ({
                        savings: sum(acc.savings, r.savings),
                        fixed_deposit: sum(acc.fixed_deposit, r.fixed_deposit),
                        loan_balance: sum(acc.loan_balance, r.loan_balance),
                        arrears: sum(acc.arrears, r.arrears),
                        fines: sum(acc.fines, r.fines),
                        mortuary: sum(acc.mortuary, r.mortuary),
                    }),
                    { savings: 0, fixed_deposit: 0, loan_balance: 0, arrears: 0, fines: 0, mortuary: 0 }
                );
                return { ...client, ...totals, assigned_mediator: 'None' };
            }
        }

        return client;
    }, [client, selectedPeriod, comparisonPeriod]);

    useEffect(() => {
        if (displayData) setMediator(displayData.assigned_mediator ?? '');
    }, [displayData]);

    const comparisonData = useMemo(() => {
        if (!client || !comparisonPeriod || !selectedPeriod || selectedPeriod === 'all_time') return null;
        const current = getRecordByPeriod(selectedPeriod);
        const compare = getRecordByPeriod(comparisonPeriod);
        if (!current || !compare) return null;

        const calc = (cur: number, prev: number) => {
            const delta = cur - prev;
            if (prev === 0) return { delta, percentChange: delta === 0 ? 0 : Infinity };
            return { delta, percentChange: (delta / Math.abs(prev)) * 100 };
        };

        return {
            savings: calc(current.savings, compare.savings),
            fixed_deposit: calc(current.fixed_deposit, compare.fixed_deposit),
            loan_balance: calc(current.loan_balance, compare.loan_balance),
            arrears: calc(current.arrears, compare.arrears),
            fines: calc(current.fines, compare.fines),
            mortuary: calc(current.mortuary, compare.mortuary),
        };
    }, [client, selectedPeriod, comparisonPeriod]);

    const varianceLabel = (percent: number, delta: number) => {
        if (!Number.isFinite(percent)) return delta > 0 ? 'New' : 'Closed';
        if (delta === 0) return '0.0%';
        return `${Math.abs(percent).toFixed(1)}%`;
    };

    const handleAddRemark = () => {
        if (!newRemark.trim()) return;
        setRemarks([{
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            text: newRemark,
            author: 'Current User',
        }, ...remarks]);
        setNewRemark('');
    };

    type FinField = 'savings' | 'fixed_deposit' | 'loan_balance' | 'arrears' | 'fines' | 'mortuary';

    const FinancialCard = ({
        label,
        field,
        valueClass,
        invertTrend = false,
    }: {
        label: string;
        field: FinField;
        valueClass: string;
        invertTrend?: boolean;
    }) => {
        const value = displayData?.[field];
        const cmp = comparisonData?.[field];
        return (
            <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-bold ${valueClass}`}>{formatCurrency(value)}</p>
                {cmp && (
                    <div className="flex items-center gap-1 mt-1">
                        {cmp.delta > 0
                            ? <TrendingUp className={`h-3 w-3 ${invertTrend ? 'text-red-500' : 'text-green-500'}`} />
                            : cmp.delta < 0
                                ? <TrendingDown className={`h-3 w-3 ${invertTrend ? 'text-green-500' : 'text-red-500'}`} />
                                : <Minus className="h-3 w-3 text-gray-500" />}
                        <span className={`text-xs font-medium ${
                            cmp.delta === 0 ? 'text-gray-600'
                                : (cmp.delta > 0) !== invertTrend ? 'text-green-600' : 'text-red-600'
                        }`}>
                            {formatCurrency(Math.abs(cmp.delta))} ({varianceLabel(cmp.percentChange, cmp.delta)})
                        </span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={client.name} />
            <div className="flex h-full flex-1 flex-col gap-6 p-4 overflow-y-auto">

                {/* Page header */}
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
                    <p className="text-sm text-muted-foreground">ID: #{client.client_id}</p>
                </div>

                {/* Two-column layout */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                    {/* LEFT — period controls + financial overview */}
                    <div className="space-y-6">

                        {/* Period controls */}
                        <div className="flex flex-col gap-4 p-4 bg-muted/50 rounded-lg text-sm">
                            <div className="flex flex-col gap-1.5">
                                <span className="font-medium text-muted-foreground">Period:</span>
                                {periods.length > 0 ? (
                                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Filter by period" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all_time">Total (All Time)</SelectItem>
                                            {periods.map(p => (
                                                <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="p-2 border rounded text-muted-foreground">No periods available</div>
                                )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <span className="font-medium text-muted-foreground">Compare with:</span>
                                {periods.length > 0 ? (
                                    <Select
                                        value={comparisonPeriod || 'no_comparison'}
                                        onValueChange={val => setComparisonPeriod(val === 'no_comparison' ? '' : val)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select comparison period" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="no_comparison">None</SelectItem>
                                            {periods
                                                .filter(p => p !== selectedPeriod)
                                                .map(p => (
                                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="p-2 border rounded text-muted-foreground">No periods available</div>
                                )}
                            </div>
                        </div>

                        {/* Financial overview */}
                        <div>
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
                                <DollarSign className="h-4 w-4" />
                                {selectedPeriod && selectedPeriod !== 'all_time'
                                    ? (comparisonPeriod ? 'Combined Financial Overview' : 'Financial Overview')
                                    : 'Total Financial Overview (All Time)'}
                                {comparisonPeriod && selectedPeriod && selectedPeriod !== 'all_time' && (
                                    <span className="text-xs text-muted-foreground ml-auto">
                                        ({selectedPeriod} + {comparisonPeriod})
                                    </span>
                                )}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <FinancialCard label="Savings"       field="savings"       valueClass="text-green-600" />
                                <FinancialCard label="Fixed Deposit" field="fixed_deposit" valueClass="text-blue-600" />
                                <FinancialCard label="Loan Balance"  field="loan_balance"  valueClass="text-orange-600" invertTrend />
                                <FinancialCard label="Arrears"       field="arrears"       valueClass="text-red-600"    invertTrend />
                                <FinancialCard label="Fines"         field="fines"         valueClass="font-semibold"   invertTrend />
                                <FinancialCard label="Mortuary"      field="mortuary"      valueClass="font-semibold"   invertTrend />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT — mediator + stats + remarks */}
                    <div className="space-y-6">

                        {/* Quick actions */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button type="button" className="w-full gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                Schedule Session
                            </Button>
                            <Button type="button" variant="outline" className="w-full gap-2">
                                <History className="h-4 w-4" />
                                View Logs
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                className="col-span-2 w-full gap-2"
                                onClick={() => setDeleteModalOpen(true)}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Client
                            </Button>
                        </div>

                        {/* Assigned mediator */}
                        <div className="flex flex-col gap-1.5 text-sm p-4 bg-muted/50 rounded-lg">
                            <span className="font-medium text-muted-foreground">Assigned Mediator:</span>
                            {isEditingMediator ? (
                                <div className="flex items-center gap-2">
                                    <Select value={mediator} onValueChange={setMediator}>
                                        <SelectTrigger className="h-8 w-full">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ASVILLA">ASVILLA</SelectItem>
                                            <SelectItem value="MGENOVA">MGENOVA</SelectItem>
                                            <SelectItem value="RGERASTRA">RGERASTRA</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditingMediator(false)} className="h-8 w-8 p-0">
                                        <Check className="h-4 w-4 text-green-500" />
                                    </Button>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditingMediator(false)} className="h-8 w-8 p-0">
                                        <X className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between font-medium p-2 bg-background border rounded-md">
                                    <span>{mediator || 'None'}</span>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditingMediator(true)} className="h-6 w-6 p-0 ml-2">
                                        <FilePenLine className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Mediation stats */}
                        <div>
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
                                <Clock className="h-4 w-4" /> Mediation Stats
                            </h3>
                            <div className="flex items-center justify-between p-4 rounded-lg border border-dashed border-border">
                                <span className="text-sm text-muted-foreground">Times Scheduled</span>
                                <span className="text-xl font-bold">2</span>
                            </div>
                        </div>

                        {/* Remarks */}
                        <div>
                            <h3 className="text-sm font-medium mb-3 text-foreground">Remarks History</h3>
                            <div className="mb-4">
                                <div className="relative">
                                    <Input
                                        placeholder="Add a new remark..."
                                        value={newRemark}
                                        onChange={e => setNewRemark(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddRemark()}
                                        className="pr-10"
                                    />
                                    <button
                                        onClick={handleAddRemark}
                                        className="absolute right-2 top-2 text-primary hover:text-primary/80"
                                        aria-label="Add remark"
                                    >
                                        <Plus className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {remarks.map(remark => (
                                    <div key={remark.id} className="relative pl-4 border-l-2 border-border pb-1">
                                        <div className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-border" />
                                        <p className="text-xs text-muted-foreground mb-1">
                                            {remark.date} by{' '}
                                            <span className="font-medium text-foreground">{remark.author}</span>
                                        </p>
                                        <p className="text-sm bg-secondary/50 p-2 rounded-md">{remark.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
            <DeleteClientsModal
                isOpen={deleteModalOpen}
                clients={[{ id: client.client_id, name: client.name }]}
                mode="single"
                onClose={() => setDeleteModalOpen(false)}
            />
        </AppLayout>
    );
}
