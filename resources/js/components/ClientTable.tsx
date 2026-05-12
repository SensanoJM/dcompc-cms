import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Filters } from '@/pages/clients/index';
import { Link, router } from '@inertiajs/react';
import { Calendar, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Client = {
    client_id: number;
    name: string;
    period: string;
    savings: number;
    loan_balance: number;
    arrears: number;
    fines: number;
    assigned_mediator: string | null;
};

type Pagination = {
    total: number;
    currentPage: number;
    lastPage: number;
    perPage: number;
};

type ClientTableProps = {
    clients: Client[];
    pagination: Pagination;
    periods: string[];
    mediators: string[];
    filters: Filters;
    currentUserName: string;
    onBatchSchedule: (ids: number[]) => void;
    onBatchDelete: (clients: { id: number; name: string }[]) => void;
};

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(
        isNaN(Number(value)) ? 0 : Number(value),
    );

const buildParams = (filters: Filters, overrides: Partial<Filters & { page: number }> = {}) => {
    const merged = { ...filters, page: 1, ...overrides };
    const p: Record<string, string> = {};
    if (merged.search) p.search = merged.search;
    if (merged.period && merged.period !== 'all') p.period = merged.period;
    if (merged.with_arrears) p.with_arrears = '1';
    if (merged.mediator) p.mediator = merged.mediator;
    if (merged.sort_by && merged.sort_by !== 'name') p.sort_by = merged.sort_by;
    if (merged.sort_order && merged.sort_order !== 'desc') p.sort_order = merged.sort_order;
    if (merged.per_page && merged.per_page !== 20) p.per_page = String(merged.per_page);
    const page = (merged as Record<string, unknown>).page as number | undefined;
    if (page && page > 1) p.page = String(page);
    return p;
};

export default function ClientTable({
    clients,
    pagination,
    periods,
    mediators,
    filters,
    currentUserName,
    onBatchSchedule,
    onBatchDelete,
}: ClientTableProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [searchValue, setSearchValue] = useState(filters.search);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        setSearchValue(filters.search);
    }, [filters.search]);

    // Clear selection on every page data change (page turn or live reload)
    useEffect(() => {
        setSelectedIds(new Set());
    }, [clients]);

    const applyFilter = (overrides: Partial<Filters>) => {
        router.get('/clients', buildParams(filters, overrides), { preserveState: true });
    };

    const handleSearch = (value: string) => {
        setSearchValue(value);
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        searchDebounce.current = setTimeout(() => {
            router.get('/clients', buildParams(filters, { search: value }), { preserveState: true });
        }, 350);
    };

    const goToPage = (page: number) => {
        router.get('/clients', buildParams(filters, { page } as Partial<Filters & { page: number }>), {
            preserveState: false,
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const fd = new FormData();
        fd.append('file', f);
        router.post('/clients/import', fd, {
            forceFormData: true,
            onFinish: () => {
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    };

    const allPageIds = clients.map((c) => c.client_id);
    const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));

    const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(allPageIds));

    const toggleRow = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSort = (key: 'name' | 'savings' | 'loan_balance' | 'arrears') => {
        if (filters.sort_by === key) {
            applyFilter({ sort_order: filters.sort_order === 'asc' ? 'desc' : 'asc' });
        } else {
            applyFilter({ sort_by: key, sort_order: 'asc' });
        }
    };

    const SortIcon = ({ col }: { col: string }) => {
        if (filters.sort_by !== col) return null;
        return filters.sort_order === 'asc' ? (
            <ChevronUp className="ml-1 inline-block h-4 w-4" />
        ) : (
            <ChevronDown className="ml-1 inline-block h-4 w-4" />
        );
    };

    const { total, currentPage, lastPage, perPage } = pagination;
    const showingFrom = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
    const showingTo = Math.min(currentPage * perPage, total);
    const isMediatorDisabled = !filters.period || filters.period === 'all';

    return (
        <div className="w-full space-y-4">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
                aria-label="Import Excel file"
                title="Import Excel file"
            />

            {/* Toolbar */}
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/10 p-2">
                    <Input
                        placeholder="Search clients..."
                        value={searchValue}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full sm:w-48"
                        aria-label="Search clients"
                    />

                    <Select
                        value={filters.period || 'all'}
                        onValueChange={(v) => applyFilter({ period: v, mediator: '' })}
                    >
                        <SelectTrigger className="w-[150px] cursor-pointer">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            {periods.map((p) => (
                                <SelectItem key={p} value={p}>
                                    {p}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        className="cursor-pointer"
                        variant={filters.with_arrears ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => applyFilter({ with_arrears: !filters.with_arrears })}
                    >
                        Has Arrears
                    </Button>

                    <Select
                        value={filters.mediator || '_all'}
                        onValueChange={(v) => applyFilter({ mediator: v === '_all' ? '' : v })}
                        disabled={isMediatorDisabled}
                    >
                        <SelectTrigger className="w-[180px] cursor-pointer">
                            <SelectValue placeholder="Assigned Mediator" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_all">All Mediators</SelectItem>
                            {currentUserName && (
                                <SelectItem value={currentUserName}>My Clients</SelectItem>
                            )}
                            {mediators
                                .filter((m) => m !== currentUserName)
                                .map((m) => (
                                    <SelectItem key={m} value={m}>
                                        {m}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>

                    <Button
                        className="cursor-pointer"
                        variant="ghost"
                        size="sm"
                        onClick={() => router.get('/clients', {}, { preserveState: false })}
                    >
                        Reset
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Select
                        value={String(filters.per_page || 20)}
                        onValueChange={(v) => applyFilter({ per_page: Number(v) })}
                    >
                        <SelectTrigger className="w-[95px] cursor-pointer">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="20">20 / pg</SelectItem>
                            <SelectItem value="50">50 / pg</SelectItem>
                            <SelectItem value="100">100 / pg</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button className="cursor-pointer" onClick={() => fileInputRef.current?.click()}>Import Data</Button>
                </div>
            </div>

            {/* Batch action bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
                    <span className="text-sm font-medium">
                        {selectedIds.size} client{selectedIds.size > 1 ? 's' : ''} selected
                    </span>
                    <Button className="cursor-pointer" size="sm" onClick={() => onBatchSchedule(Array.from(selectedIds))}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule Session
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() =>
                            onBatchDelete(
                                clients
                                    .filter((c) => selectedIds.has(c.client_id))
                                    .map((c) => ({ id: c.client_id, name: c.name })),
                            )
                        }
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </Button>
                    <Button variant="ghost" className="cursor-pointer" size="sm" onClick={() => setSelectedIds(new Set())}>
                        Clear
                    </Button>
                </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-md border text-sm">
                <table className="w-full table-auto">
                    <thead>
                        <tr className="bg-muted/10 text-left">
                            <th className="w-10 px-4 py-2">
                                <Checkbox
                                    className="cursor-pointer"
                                    checked={allSelected}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label="Select all on this page"
                                />
                            </th>
                            <th className="cursor-pointer px-4 py-2" onClick={() => toggleSort('name')}>
                                Name <SortIcon col="name" />
                            </th>
                            <th className="px-4 py-2">Mediator</th>
                            <th className="px-4 py-2">Period</th>
                            <th className="cursor-pointer px-4 py-2 text-right" onClick={() => toggleSort('savings')}>
                                Savings <SortIcon col="savings" />
                            </th>
                            <th
                                className="cursor-pointer px-4 py-2 text-right"
                                onClick={() => toggleSort('loan_balance')}
                            >
                                Loan Balance <SortIcon col="loan_balance" />
                            </th>
                            <th
                                className="cursor-pointer px-4 py-2 text-right"
                                onClick={() => toggleSort('arrears')}
                            >
                                Arrears <SortIcon col="arrears" />
                            </th>
                            <th className="px-4 py-2 text-right">Fines</th>
                            <th className="px-4 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {clients.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                    No clients found for this period.
                                </td>
                            </tr>
                        ) : (
                            clients.map((c) => (
                                <tr
                                    key={`${c.client_id}-${c.period}`}
                                    onClick={() => router.visit(`/clients/${c.client_id}`)}
                                    className="cursor-pointer border-t border-border hover:bg-muted/10"
                                >
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            className="cursor-pointer"
                                            checked={selectedIds.has(c.client_id)}
                                            onCheckedChange={() => toggleRow(c.client_id)}
                                            aria-label={`Select ${c.name}`}
                                        />
                                    </td>
                                    <td className="px-4 py-3 font-medium">{c.name}</td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {c.assigned_mediator ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{c.period}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(c.savings)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(c.loan_balance)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {c.arrears > 0 ? (
                                                <Badge variant="destructive" className="text-xs">
                                                    {formatCurrency(c.arrears)}
                                                </Badge>
                                            ) : (
                                                <span>{formatCurrency(c.arrears)}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(c.fines)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                href={`/clients/${c.client_id}`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Button type="button" size="sm" variant="outline" asChild>
                                                    <span>View</span>
                                                </Button>
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Showing {showingFrom}–{showingTo} of {total}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        className="cursor-pointer"
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        Prev
                    </Button>
                    <div className="text-sm">
                        Page {currentPage} / {lastPage}
                    </div>
                    <Button
                        className="cursor-pointer"
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === lastPage}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
