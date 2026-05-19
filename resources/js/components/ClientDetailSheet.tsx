import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    Calendar as CalendarIcon,
    Minus,
    Trash2,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';

interface ClientFinancialRecord {
    period: string;
    savings: number;
    fixed_deposit: number;
    loan_balance: number;
    arrears: number;
    fines: number;
    mortuary: number;
    assigned_mediator?: string;
}

interface ClientDetail {
    client_id: number;
    name: string;
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

interface Props {
    clientId: number | null;
    clientName: string;
    periods: string[];
    defaultPeriod?: string;
    onClose: () => void;
    onSchedule: (ids: number[]) => void;
    onDelete: (clients: { id: number; name: string }[]) => void;
}

type FinField = 'savings' | 'fixed_deposit' | 'loan_balance' | 'arrears' | 'fines' | 'mortuary';

const formatCurrency = (value: number | undefined | null) => {
    const num = Number(value);
    if (isNaN(num)) return '₱0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(num);
};

export default function ClientDetailSheet({
    clientId,
    clientName,
    defaultPeriod,
    onClose,
    onSchedule,
    onDelete,
}: Props) {
    const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all_time');
    const [comparisonPeriod, setComparisonPeriod] = useState<string>('');

    useEffect(() => {
        if (!clientId) {
            setClientDetail(null);
            return;
        }
        setLoading(true);
        setSelectedPeriod(defaultPeriod && defaultPeriod !== '' ? defaultPeriod : 'all_time');
        setComparisonPeriod('');
        fetch(`/api/clients/${clientId}`)
            .then((r) => r.json())
            .then((json) => setClientDetail(json.data))
            .finally(() => setLoading(false));
    }, [clientId]);

    const availablePeriods = useMemo(() => {
        if (!clientDetail?.financial_records) return [];
        return clientDetail.financial_records.map((r) => r.period).filter(Boolean);
    }, [clientDetail]);

    const getRecord = (period: string) =>
        clientDetail?.financial_records?.find((r) => r.period === period) ?? null;

    const sum = (a: unknown, b: unknown) => Number(a || 0) + Number(b || 0);

    const displayData = useMemo(() => {
        if (!clientDetail) return null;

        if (selectedPeriod && selectedPeriod !== 'all_time') {
            const current = getRecord(selectedPeriod);

            if (comparisonPeriod && comparisonPeriod !== 'no_comparison') {
                const compare = getRecord(comparisonPeriod);
                return {
                    ...clientDetail,
                    ...(current ?? compare ?? {}),
                    savings: sum(current?.savings, compare?.savings),
                    fixed_deposit: sum(current?.fixed_deposit, compare?.fixed_deposit),
                    loan_balance: sum(current?.loan_balance, compare?.loan_balance),
                    arrears: sum(current?.arrears, compare?.arrears),
                    fines: sum(current?.fines, compare?.fines),
                    mortuary: sum(current?.mortuary, compare?.mortuary),
                };
            }

            if (current) return { ...clientDetail, ...current };
        } else {
            if (clientDetail.total_financials) {
                return {
                    ...clientDetail,
                    savings: Number(clientDetail.total_financials.savings || 0),
                    fixed_deposit: Number(clientDetail.total_financials.fixed_deposit || 0),
                    loan_balance: Number(clientDetail.total_financials.loan_balance || 0),
                    arrears: Number(clientDetail.total_financials.arrears || 0),
                    fines: Number(clientDetail.total_financials.fines || 0),
                    mortuary: Number(clientDetail.total_financials.mortuary || 0),
                };
            }

            if (clientDetail.financial_records?.length) {
                const totals = clientDetail.financial_records.reduce(
                    (acc, r) => ({
                        savings: sum(acc.savings, r.savings),
                        fixed_deposit: sum(acc.fixed_deposit, r.fixed_deposit),
                        loan_balance: sum(acc.loan_balance, r.loan_balance),
                        arrears: sum(acc.arrears, r.arrears),
                        fines: sum(acc.fines, r.fines),
                        mortuary: sum(acc.mortuary, r.mortuary),
                    }),
                    { savings: 0, fixed_deposit: 0, loan_balance: 0, arrears: 0, fines: 0, mortuary: 0 },
                );
                return { ...clientDetail, ...totals };
            }
        }

        return clientDetail;
    }, [clientDetail, selectedPeriod, comparisonPeriod]);

    const comparisonData = useMemo(() => {
        if (!clientDetail || !comparisonPeriod || selectedPeriod === 'all_time') return null;
        const current = getRecord(selectedPeriod);
        const compare = getRecord(comparisonPeriod);
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
    }, [clientDetail, selectedPeriod, comparisonPeriod]);

    const netPosition = useMemo(() => {
        if (!displayData) return null;
        const d = displayData as Record<string, unknown>;
        const assets = Number(d.savings || 0) + Number(d.fixed_deposit || 0);
        const liabilities =
            Number(d.loan_balance || 0) +
            Number(d.arrears || 0) +
            Number(d.fines || 0) +
            Number(d.mortuary || 0);
        return { assets, liabilities, netWorth: assets - liabilities };
    }, [displayData]);

    const varianceLabel = (percent: number, delta: number) => {
        if (!Number.isFinite(percent)) return delta > 0 ? 'New' : 'Closed';
        if (delta === 0) return '0%';
        return `${Math.abs(percent).toFixed(1)}%`;
    };

    const StatRow = ({
        label,
        field,
        invertTrend = false,
    }: {
        label: string;
        field: FinField;
        invertTrend?: boolean;
    }) => {
        const d = displayData as Record<string, unknown> | null;
        const value = d?.[field] as number | undefined;
        const cmp = comparisonData?.[field];

        const isImprovement =
            !cmp || cmp.delta === 0 ? null : (cmp.delta > 0) !== invertTrend;
        const trendColor =
            isImprovement === null
                ? 'text-muted-foreground'
                : isImprovement
                  ? 'text-emerald-600'
                  : 'text-destructive';

        return (
            <div className="flex items-center gap-2 py-2.5">
                <span className="flex-1 truncate text-sm text-muted-foreground">{label}</span>
                <span className="w-[120px] text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(value)}
                </span>
                <div
                    className={`flex w-16 shrink-0 items-center justify-end gap-0.5 text-xs font-medium ${trendColor}`}
                >
                    {cmp ? (
                        cmp.delta === 0 ? (
                            <>
                                <Minus className="h-3 w-3" />
                                <span>0%</span>
                            </>
                        ) : (
                            <>
                                {cmp.delta > 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                ) : (
                                    <TrendingDown className="h-3 w-3" />
                                )}
                                <span>{varianceLabel(cmp.percentChange, cmp.delta)}</span>
                            </>
                        )
                    ) : (
                        <span>—</span>
                    )}
                </div>
            </div>
        );
    };

    const periodSubtitle =
        selectedPeriod === 'all_time'
            ? 'All periods combined'
            : comparisonPeriod
              ? `${selectedPeriod} vs ${comparisonPeriod}`
              : selectedPeriod;

    return (
        <Sheet open={clientId !== null} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="flex w-full flex-col p-0 md:w-[480px]">
                {/* Header — name and ID only */}
                <SheetHeader className="shrink-0 border-b px-6 pb-5 pt-6">
                    <SheetTitle className="text-xl font-bold leading-tight">{clientName}</SheetTitle>
                    <div className="mt-1.5">
                        <span className="rounded border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                            #{clientId}
                        </span>
                    </div>
                </SheetHeader>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto">
                    {/* Primary action */}
                    <div className="px-6 pb-4 pt-5">
                        <Button
                            className="w-full gap-2"
                            onClick={() => clientId && onSchedule([clientId])}
                        >
                            <CalendarIcon className="h-4 w-4" />
                            Schedule Session
                        </Button>
                    </div>

                    {/* Financial overview */}
                    <div className="border-t px-6 py-5">
                        {/* Section heading */}
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-foreground">Financial Overview</h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">{periodSubtitle}</p>
                        </div>

                        {/* Period selectors */}
                        {availablePeriods.length > 0 && (
                            <div className="mb-5 grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <p className="text-xs text-muted-foreground">Period</p>
                                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                        <SelectTrigger className="h-8 w-full text-xs">
                                            <SelectValue placeholder="Period" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all_time">All Time</SelectItem>
                                            {availablePeriods.map((p) => (
                                                <SelectItem key={p} value={p}>
                                                    {p}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-xs text-muted-foreground">Compare with</p>
                                    <Select
                                        value={comparisonPeriod || 'no_comparison'}
                                        onValueChange={(val) =>
                                            setComparisonPeriod(val === 'no_comparison' ? '' : val)
                                        }
                                        disabled={selectedPeriod === 'all_time'}
                                    >
                                        <SelectTrigger className="h-8 w-full text-xs">
                                            <SelectValue placeholder="Compare" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="no_comparison">None</SelectItem>
                                            {availablePeriods
                                                .filter((p) => p !== selectedPeriod)
                                                .map((p) => (
                                                    <SelectItem key={p} value={p}>
                                                        {p}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {/* Data rows */}
                        {loading ? (
                            <div className="animate-pulse space-y-3">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div
                                            className="h-3.5 rounded bg-muted"
                                            style={{ width: `${35 + (i % 5) * 8}%` }}
                                        />
                                        <div className="ml-auto h-3.5 w-24 rounded bg-muted" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Assets */}
                                <div>
                                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                        Assets
                                    </p>
                                    <div className="divide-y divide-border/60">
                                        <StatRow label="Savings" field="savings" />
                                        <StatRow label="Fixed Deposit" field="fixed_deposit" />
                                    </div>
                                </div>

                                {/* Liabilities */}
                                <div>
                                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                        Liabilities
                                    </p>
                                    <div className="divide-y divide-border/60">
                                        <StatRow label="Loan Balance" field="loan_balance" invertTrend />
                                        <StatRow label="Arrears" field="arrears" invertTrend />
                                        <StatRow label="Fines" field="fines" invertTrend />
                                        <StatRow label="Mortuary" field="mortuary" invertTrend />
                                    </div>
                                </div>

                                {/* Net position summary */}
                                {netPosition && (
                                    <div className="rounded-lg border bg-muted/30 px-4 py-3.5">
                                        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                            Net Position
                                        </p>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Total Assets</span>
                                                <span className="font-medium tabular-nums text-emerald-600">
                                                    {formatCurrency(netPosition.assets)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Total Liabilities</span>
                                                <span className="font-medium tabular-nums text-destructive">
                                                    {formatCurrency(netPosition.liabilities)}
                                                </span>
                                            </div>
                                            <div className="my-1 h-px bg-border" />
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold">Net Worth</span>
                                                <span
                                                    className={`text-sm font-bold tabular-nums ${
                                                        netPosition.netWorth >= 0
                                                            ? 'text-emerald-600'
                                                            : 'text-destructive'
                                                    }`}
                                                >
                                                    {formatCurrency(netPosition.netWorth)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Danger zone — sticky at the bottom, never scrolls away */}
                <div className="shrink-0 border-t bg-background px-6 py-5">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-destructive/60">
                        Danger Zone
                    </p>
                    <Button
                        variant="outline"
                        className="w-full gap-2 border-destructive/40 text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => clientId && onDelete([{ id: clientId, name: clientName }])}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete Client
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
