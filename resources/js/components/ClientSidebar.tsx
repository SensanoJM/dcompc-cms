import React, { useState, useMemo, useEffect } from 'react';
import { X, Calendar as CalendarIcon, DollarSign, Clock, Plus, History, User, Check, FilePenLine, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import axios from 'axios';

// Extended Client type to include financial history
export interface ClientFinancialRecord {
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

export interface Client {
    client_id: number;
    name: string;
    period: string; // Current/Latest period
    savings: number;
    fixed_deposit: number;
    loan_balance: number;
    arrears: number;
    fines: number;
    mortuary: number;
    assigned_mediator?: string;
    financial_records?: ClientFinancialRecord[];
}

export interface Remark {
    id: number;
    date: string;
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

const formatCurrency = (value: number | undefined | null) => {
    const num = Number(value);
    if (isNaN(num)) return '₱0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'PHP',
    }).format(num);
};

export default function ClientSidebar({ client: initialClient, isOpen, onClose }: ClientSidebarProps) {
    const [client, setClient] = useState<Client | null>(initialClient);
    const [isLoading, setIsLoading] = useState(false);
    const [remarks, setRemarks] = useState<Remark[]>(MOCK_REMARKS);
    const [newRemark, setNewRemark] = useState('');

    // Period filtering state
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [comparisonPeriod, setComparisonPeriod] = useState<string>('');

    // State for local edits
    const [mediator, setMediator] = useState<string>('');
    const [isEditingMediator, setIsEditingMediator] = useState(false);

    // Fetch full client details when opened
    useEffect(() => {
        // Immediate update to show partial data while fetching
        if (isOpen && initialClient) {
            setClient(prev => {
                // If we are already looking at this client (and maybe have full data), don't overwrite with partial unless IDs mismatch
                if (prev?.client_id === initialClient.client_id && prev?.financial_records) {
                    return prev;
                }
                return initialClient;
            });

            // Set default period from initialClient if valid
            if (initialClient.period) {
                setSelectedPeriod(initialClient.period);
            }
        }

        const fetchClientDetails = async () => {
            if (initialClient?.client_id && isOpen) {
                setIsLoading(true);
                try {
                    console.log(`Fetching details for client ${initialClient.client_id}...`);
                    const response = await axios.get(`/api/clients/${initialClient.client_id}`);
                    console.log("Sidebar API Response:", response.data);

                    if (response.data.success) {
                        const fullClient = response.data.data;
                        setClient(fullClient);

                        // Update period selection intelligently
                        // If we already have a selected period (from initialClient), keep it if it exists in records
                        // Otherwise default to latest/current
                        const hasCurrentSelection = fullClient.financial_records?.some((r: any) => r.period === initialClient.period);
                        const defaultPeriod = hasCurrentSelection ? initialClient.period : (fullClient.financial_records?.[0]?.period || '');

                        if (defaultPeriod) setSelectedPeriod(defaultPeriod);
                    }
                } catch (error) {
                    console.error("Failed to fetch client details", error);
                } finally {
                    setIsLoading(false);
                }
            } else if (!isOpen) {
                // Reset when closed or no client
                // setClient(null); // Optional: keep last view or clear
            }
        };

        fetchClientDetails();
    }, [initialClient, isOpen]);

    // Helper to find record by period
    const getRecordByPeriod = (period: string) => {
        if (!client?.financial_records) return null;
        return client.financial_records.find(r => r.period === period);
    };

    // Calculate displayed data based on selectedPeriod
    const displayData = useMemo(() => {
        if (!client) return null;

        if (selectedPeriod) {
            const record = getRecordByPeriod(selectedPeriod);
            if (record) {
                return {
                    ...client,
                    ...record, // Overwrite base fields with record specific ones
                    assigned_mediator: record.assigned_mediator // Ensure mediator is from record
                };
            }
        }

        // Fallback to client base data
        return client;
    }, [client, selectedPeriod]);

    // Update mediator state when displayData changes
    useEffect(() => {
        if (displayData) {
            setMediator(displayData.assigned_mediator || '');
        }
    }, [displayData]);

    // Calculate comparison data
    const comparisonData = useMemo(() => {
        if (!client || !comparisonPeriod || !selectedPeriod) return null;

        const currentRecord = getRecordByPeriod(selectedPeriod);
        const compareRecord = getRecordByPeriod(comparisonPeriod);

        if (!currentRecord || !compareRecord) return null;

        const calculateChange = (current: number, previous: number) => {
            const delta = current - previous;
            if (previous === 0) {
                if (delta === 0) return { delta, percentChange: 0 };
                return { delta, percentChange: Infinity };
            }
            const percentChange = (delta / Math.abs(previous)) * 100;
            return { delta, percentChange };
        };

        return {
            savings: calculateChange(currentRecord.savings, compareRecord.savings),
            fixed_deposit: calculateChange(currentRecord.fixed_deposit, compareRecord.fixed_deposit),
            loan_balance: calculateChange(currentRecord.loan_balance, compareRecord.loan_balance),
            arrears: calculateChange(currentRecord.arrears, compareRecord.arrears),
            fines: calculateChange(currentRecord.fines, compareRecord.fines),
            mortuary: calculateChange(currentRecord.mortuary, compareRecord.mortuary),
        };
    }, [client, selectedPeriod, comparisonPeriod]);

    const getVarianceLabel = (percent: number, delta: number) => {
        if (!Number.isFinite(percent)) {
            return delta > 0 ? "New" : "Closed";
        }
        if (delta === 0) return "0.0%";
        return `${Math.abs(percent).toFixed(1)}%`;
    };

    const handleSaveMediator = async () => {
        if (!client) return;

        try {
            // Update mediator for the specific period logic
            // We need to know which record to update.
            // If we are strictly updating the record for 'selectedPeriod':

            await axios.put(`/api/clients/${client.client_id}`, {
                ...client,
                period: selectedPeriod, // Important: Tell backend which period record to update
                assigned_mediator: mediator
            });

            setIsEditingMediator(false);

            // Re-fetch or locally update
            if (client.financial_records) {
                const updatedRecords = client.financial_records.map(r =>
                    r.period === selectedPeriod ? { ...r, assigned_mediator: mediator } : r
                );
                setClient({ ...client, financial_records: updatedRecords, assigned_mediator: mediator });
            }

        } catch (error) {
            console.error("Failed to update mediator", error);
        }
    };

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

    // Get unique periods for dropdown
    const periods = useMemo(() => {
        if (!client?.financial_records) return [];
        return client.financial_records.map(r => r.period).filter(p => p);
    }, [client]);

    return (
        <div
            className={`fixed inset-y-0 right-0 z-50 w-[400px] bg-background shadow-2xl transition-transform duration-300 ease-in-out border-l border-border flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
        >
            {client && displayData ? (
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-border">
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight">{client.name}</h2>
                            <p className="text-sm text-muted-foreground">ID: #{client.client_id}</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Period Calendar Filter and Assign Mediator column */}
                    <div className="flex flex-col gap-4 text-sm m-4 p-4 bg-muted/50 rounded-lg">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-muted-foreground font-medium">Period:</span>
                            {periods.length > 0 ? (
                                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {periods.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="text-sm text-muted-foreground p-2 border rounded">No periods available</div>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <span className="text-muted-foreground font-medium">Compare with:</span>
                            {periods.length > 0 ? (
                                <Select
                                    value={comparisonPeriod || "no_comparison"}
                                    onValueChange={(val) => setComparisonPeriod(val === "no_comparison" ? "" : val)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select comparison period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="no_comparison">None</SelectItem>
                                        {periods
                                            .filter(p => p !== selectedPeriod)
                                            .map((p) => (
                                                <SelectItem key={p} value={p}>
                                                    {p}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="text-sm text-muted-foreground p-2 border rounded">No periods available</div>
                            )
                            }
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <span className="text-muted-foreground font-medium">Assigned Mediator:</span>
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
                                    <Button type="button" size="sm" variant="ghost" onClick={handleSaveMediator} className="h-8 w-8 p-0">
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
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {isLoading && <div className="text-center text-sm text-muted-foreground">Loading details...</div>}

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button type="button" className="w-full gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                Schedule Session
                            </Button>
                            <Button type="button" variant="outline" className="w-full gap-2">
                                <History className="h-4 w-4" />
                                View Logs
                            </Button>
                        </div>

                        {/* Financial Overview */}
                        <div>
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
                                <DollarSign className="h-4 w-4" /> Financial Overview
                                {comparisonPeriod && <span className="text-xs text-muted-foreground ml-auto">vs {comparisonPeriod}</span>}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {/* Savings (Asset) */}
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Savings</p>
                                    <p className="text-lg font-bold text-green-600">{formatCurrency(displayData.savings)}</p>
                                    {comparisonData?.savings && (
                                        <div className="flex items-center gap-1 mt-1">
                                            {comparisonData.savings.delta > 0 ? (
                                                <TrendingUp className="h-3 w-3 text-green-500" />
                                            ) : comparisonData.savings.delta < 0 ? (
                                                <TrendingDown className="h-3 w-3 text-red-500" />
                                            ) : (
                                                <Minus className="h-3 w-3 text-gray-500" />
                                            )}
                                            <span className={`text-xs font-medium ${comparisonData.savings.delta > 0 ? 'text-green-600' : comparisonData.savings.delta < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                {formatCurrency(Math.abs(comparisonData.savings.delta))} ({getVarianceLabel(comparisonData.savings.percentChange, comparisonData.savings.delta)})
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Fixed Deposit (Asset) */}
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Fixed Deposit</p>
                                    <p className="text-lg font-bold text-blue-600">{formatCurrency(displayData.fixed_deposit)}</p>
                                    {comparisonData?.fixed_deposit && (
                                        <div className="flex items-center gap-1 mt-1">
                                            {comparisonData.fixed_deposit.delta > 0 ? (
                                                <TrendingUp className="h-3 w-3 text-green-500" />
                                            ) : comparisonData.fixed_deposit.delta < 0 ? (
                                                <TrendingDown className="h-3 w-3 text-red-500" />
                                            ) : (
                                                <Minus className="h-3 w-3 text-gray-500" />
                                            )}
                                            <span className={`text-xs font-medium ${comparisonData.fixed_deposit.delta > 0 ? 'text-green-600' : comparisonData.fixed_deposit.delta < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                {formatCurrency(Math.abs(comparisonData.fixed_deposit.delta))} ({getVarianceLabel(comparisonData.fixed_deposit.percentChange, comparisonData.fixed_deposit.delta)})
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Loan Balance (Liability) */}
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Loan Balance</p>
                                    <p className="text-lg font-bold text-orange-600">{formatCurrency(displayData.loan_balance)}</p>
                                    {comparisonData?.loan_balance && (
                                        <div className="flex items-center gap-1 mt-1">
                                            {comparisonData.loan_balance.delta > 0 ? (
                                                <TrendingUp className="h-3 w-3 text-red-500" />
                                            ) : comparisonData.loan_balance.delta < 0 ? (
                                                <TrendingDown className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <Minus className="h-3 w-3 text-gray-500" />
                                            )}
                                            <span className={`text-xs font-medium ${comparisonData.loan_balance.delta > 0 ? 'text-red-600' : comparisonData.loan_balance.delta < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                                {formatCurrency(Math.abs(comparisonData.loan_balance.delta))} ({getVarianceLabel(comparisonData.loan_balance.percentChange, comparisonData.loan_balance.delta)})
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Arrears (Liability) */}
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Arrears</p>
                                    <p className="text-lg font-bold text-red-600">{formatCurrency(displayData.arrears)}</p>
                                    {comparisonData?.arrears && (
                                        <div className="flex items-center gap-1 mt-1">
                                            {comparisonData.arrears.delta > 0 ? (
                                                <TrendingUp className="h-3 w-3 text-red-500" />
                                            ) : comparisonData.arrears.delta < 0 ? (
                                                <TrendingDown className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <Minus className="h-3 w-3 text-gray-500" />
                                            )}
                                            <span className={`text-xs font-medium ${comparisonData.arrears.delta > 0 ? 'text-red-600' : comparisonData.arrears.delta < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                                {formatCurrency(Math.abs(comparisonData.arrears.delta))} ({getVarianceLabel(comparisonData.arrears.percentChange, comparisonData.arrears.delta)})
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Fines (Liability) */}
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Fines</p>
                                    <p className="font-semibold">{formatCurrency(displayData.fines)}</p>
                                    {comparisonData?.fines && (
                                        <div className="flex items-center gap-1 mt-1">
                                            {comparisonData.fines.delta > 0 ? (
                                                <TrendingUp className="h-3 w-3 text-red-500" />
                                            ) : comparisonData.fines.delta < 0 ? (
                                                <TrendingDown className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <Minus className="h-3 w-3 text-gray-500" />
                                            )}
                                            <span className={`text-xs font-medium ${comparisonData.fines.delta > 0 ? 'text-red-600' : comparisonData.fines.delta < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                                {formatCurrency(Math.abs(comparisonData.fines.delta))} ({getVarianceLabel(comparisonData.fines.percentChange, comparisonData.fines.delta)})
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Mortuary (Liability) */}
                                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground">Mortuary</p>
                                    <p className="font-semibold">{formatCurrency(displayData.mortuary)}</p>
                                    {comparisonData?.mortuary && (
                                        <div className="flex items-center gap-1 mt-1">
                                            {comparisonData.mortuary.delta > 0 ? (
                                                <TrendingUp className="h-3 w-3 text-red-500" />
                                            ) : comparisonData.mortuary.delta < 0 ? (
                                                <TrendingDown className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <Minus className="h-3 w-3 text-gray-500" />
                                            )}
                                            <span className={`text-xs font-medium ${comparisonData.mortuary.delta > 0 ? 'text-red-600' : comparisonData.mortuary.delta < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                                {formatCurrency(Math.abs(comparisonData.mortuary.delta))} ({getVarianceLabel(comparisonData.mortuary.percentChange, comparisonData.mortuary.delta)})
                                            </span>
                                        </div>
                                    )}
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
                        <Button type="button" variant="secondary" className="w-full" onClick={onClose}>Close Sidebar</Button>
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
