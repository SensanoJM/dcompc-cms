import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import ClientSidebar from './ClientSidebar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import axios from 'axios';

type Client = {
    client_id: number;
    name: string;
    period: string;
    savings: number;
    fixed_deposit: number;
    loan_balance: number;
    arrears: number;
    fines: number;
    mortuary: number;
    assigned_mediator?: string;
    // financial_records will be present when fetching single client details
    financial_records?: any[];
};

type SortKey = 'name' | 'period' | 'savings' | 'loan_balance' | 'arrears';

const PAGE_SIZE = 20;

const formatCurrency = (value: number) => {
    const num = Number(value);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(isNaN(num) ? 0 : num);
};

export default function ClientTable() {
    const [clients, setClients] = useState<Client[]>([]); // page items
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Period filtering
    const [periods, setPeriods] = useState<string[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const openFilePicker = () => fileInputRef.current?.click();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', f);

            const res = await axios.post('/api/excel/import', fd, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (res.data.success) {
                window.alert(`Import finished. Imported: ${res.data.data.imported || 0}, Failed: ${res.data.data.failed || 0}`);
                setPage(1);
                fetchClients(); // Refresh list
            } else {
                console.error('Import failed', res.data);
                window.alert(res.data.message || 'Import failed');
            }
        } catch (err: any) {
            console.error(err);
            window.alert(err.response?.data?.message || 'Import error');
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const fetchClients = async () => {
        setLoading(true);
        try {
            // map frontend sort keys to server columns
            const sortMap: Record<string, string> = {
                client_id: 'client_id',
                name: 'name',
                period: 'period',
                savings: 'savings',
                loan_balance: 'loan_balance',
                arrears: 'arrears',
            };

            const params = new URLSearchParams();
            if (query.trim()) params.append('search', query.trim());
            if (selectedPeriod) params.append('period', selectedPeriod);

            params.append('page', String(page));
            params.append('per_page', String(PAGE_SIZE));
            params.append('sort_by', sortMap[sortKey] || 'created_at');
            params.append('sort_order', sortDir);

            const res = await axios.get(`/api/clients?${params.toString()}`);
            console.log("ClientTable API Response:", res.data); // Debug log

            setClients(res.data.data || []);
            setTotalCount(res.data.total || 0);

            // Update periods list if provided
            if (res.data.periods) {
                setPeriods(res.data.periods);
                // If no period selected and we have periods, maybe select the server's selected one?
                if (!selectedPeriod && res.data.selected_period) {
                    setSelectedPeriod(res.data.selected_period);
                }
            }
        } catch (err) {
            console.error(err);
            setClients([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, sortKey, sortDir, selectedPeriod]);

    // debounce search
    useEffect(() => {
        const t = setTimeout(() => { setPage(1); fetchClients(); }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handleRowClick = (c: Client) => {
        setSelectedClient(c);
        setIsSidebarOpen(true);
    };

    return (
        <div className="w-full">
            {/* hidden file input for import */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
                aria-label="Import Excel file"
                title="Import Excel file"
            />
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
                <div className="flex items-center gap-2 w-full max-w-2xl bg-muted/10 p-2 rounded-lg">
                    <Input
                        placeholder="Search clients..."
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                        className="w-full sm:w-64"
                        aria-label="Search clients"
                    />

                    {/* Period Filter with Shadcn Select */}
                    <Select value={selectedPeriod} onValueChange={(value) => { setSelectedPeriod(value); setPage(1); }}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Period" />
                        </SelectTrigger>
                        <SelectContent>
                            {periods.map((period) => (
                                <SelectItem key={period} value={period}>
                                    {period}
                                </SelectItem>
                            ))}
                            {/* Fallback if no periods */}
                            {periods.length === 0 && <SelectItem value="loading" disabled>Loading periods...</SelectItem>}
                        </SelectContent>
                    </Select>

                    <Button variant="ghost" onClick={() => { setQuery(''); setSelectedPeriod(periods[0] || ''); setPage(1); }}>Reset</Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={openFilePicker} disabled={loading}>Import Data</Button>
                </div>
            </div>

            <div className="overflow-hidden rounded-md border text-sm">
                <table className="w-full table-auto">
                    <thead>
                        <tr className="bg-muted/10 text-left">
                            <th className="px-4 py-2 cursor-pointer" onClick={() => toggleSort('name')}>Name
                                {sortKey === 'name' ? (sortDir === 'asc' ? <ChevronUp className="inline-block ml-1 w-4 h-4" /> : <ChevronDown className="inline-block ml-1 w-4 h-4" />) : null}
                            </th>
                            <th className="px-4 py-2 cursor-pointer" onClick={() => toggleSort('period')}>Period
                                {sortKey === 'period' ? (sortDir === 'asc' ? <ChevronUp className="inline-block ml-1 w-4 h-4" /> : <ChevronDown className="inline-block ml-1 w-4 h-4" />) : null}
                            </th>
                            <th className="px-4 py-2 text-right cursor-pointer" onClick={() => toggleSort('savings')}>Savings
                                {sortKey === 'savings' ? (sortDir === 'asc' ? <ChevronUp className="inline-block ml-1 w-4 h-4" /> : <ChevronDown className="inline-block ml-1 w-4 h-4" />) : null}
                            </th>
                            <th className="px-4 py-2 text-right">Loan Balance</th>
                            <th className="px-4 py-2 text-right cursor-pointer" onClick={() => toggleSort('arrears')}>Arrears
                                {sortKey === 'arrears' ? (sortDir === 'asc' ? <ChevronUp className="inline-block ml-1 w-4 h-4" /> : <ChevronDown className="inline-block ml-1 w-4 h-4" />) : null}
                            </th>
                            <th className="px-4 py-2 text-right">Fines</th>
                            <th className="px-4 py-2"> </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i} className="animate-pulse border-t border-border">
                                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-32" /></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20" /></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20 ml-auto" /></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20 ml-auto" /></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-12 ml-auto" /></td>
                                    <td className="px-4 py-3"></td>
                                    <td className="px-4 py-3"></td>
                                </tr>
                            ))
                        ) : clients.length ? (
                            clients.map((c) => (
                                <tr
                                    key={`${c.client_id}-${c.period}`}
                                    onClick={() => handleRowClick(c)}
                                    className={`cursor-pointer hover:bg-muted/10 border-t border-border ${selectedClient?.client_id === c.client_id ? 'bg-muted/20' : ''}`}
                                >
                                    <td className="px-4 py-3 font-medium">{c.name}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{c.period}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(c.savings)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(c.loan_balance)}</td>
                                    <td className={`px-4 py-3 text-right ${c.arrears > 0 ? 'text-red-500 font-bold' : ''}`}>{formatCurrency(c.arrears)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(c.fines)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2 justify-end">
                                            <Button type="button" size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleRowClick(c); }}>View</Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No clients found for this period.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">Showing {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}</div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                    <div className="text-sm">Page {page} / {totalPages}</div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                </div>
            </div>

            {/* Sidebar */}
            <ClientSidebar client={selectedClient} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </div>
    );
}
