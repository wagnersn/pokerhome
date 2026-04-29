import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { fmtBRL, fmtDateTime, apiErr } from "@/lib/format";
import { Wallet, Banknote, CreditCard, AlertTriangle, Coins, ReceiptText, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Cashier() {
    const [pending, setPending] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [players, setPlayers] = useState([]);
    const [tab, setTab] = useState("pending");

    const load = async () => {
        const [a, b, c, d] = await Promise.all([
            api.get("/cashier/pending"),
            api.get("/cashier/debtors"),
            api.get("/cashier/transactions?limit=100"),
            api.get("/players"),
        ]);
        setPending(a.data); setDebtors(b.data); setTransactions(c.data); setPlayers(d.data);
    };
    useEffect(() => { load(); }, []);

    const pay = async (chargeId, method) => {
        try {
            await api.post(`/cashier/charges/${chargeId}/pay?method=${method}`);
            toast.success(method === "debt" ? "Adicionado à conta do jogador" : "Pagamento registrado");
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <div className="mb-8">
                <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Financeiro</div>
                <h1 className="text-4xl font-heading font-bold tracking-tight">Caixa</h1>
                <p className="text-sm text-muted-foreground mt-1">Receba pagamentos, controle dívidas e venda fichas direto na operação.</p>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="bg-surface border border-white/5">
                    <TabsTrigger value="pending" data-testid="tab-pending">Pendentes ({pending.length})</TabsTrigger>
                    <TabsTrigger value="by-player" data-testid="tab-by-player">Por Jogador</TabsTrigger>
                    <TabsTrigger value="debt" data-testid="tab-debt">Dívidas ({debtors.length})</TabsTrigger>
                    <TabsTrigger value="cash" data-testid="tab-cash">Venda de Fichas</TabsTrigger>
                    <TabsTrigger value="history" data-testid="tab-history">Histórico</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6">
                    <PendingPanel pending={pending} pay={pay} />
                </TabsContent>

                <TabsContent value="by-player" className="mt-6">
                    <PlayerChargesPanel players={players} pay={pay} />
                </TabsContent>

                <TabsContent value="debt" className="mt-6">
                    <DebtPanel debtors={debtors} reload={load} />
                </TabsContent>

                <TabsContent value="cash" className="mt-6">
                    <CashSalePanel players={players} reload={load} />
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <HistoryPanel transactions={transactions} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

const PendingPanel = ({ pending, pay }) => (
    <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-heading text-lg font-semibold flex items-center gap-2"><ReceiptText className="size-4 text-primary" /> Cobranças pendentes</h3>
            <div className="text-sm font-mono">Total: <span className="font-semibold">{fmtBRL(pending.reduce((s, c) => s + c.amount, 0))}</span></div>
        </div>
        <table className="w-full text-sm">
            <thead>
                <tr className="bg-surface-elevated text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="text-left py-3 px-4">Jogador</th>
                    <th className="text-left py-3 px-4 hidden md:table-cell">Torneio / Origem</th>
                    <th className="text-left py-3 px-4 hidden lg:table-cell">Descrição</th>
                    <th className="text-right py-3 px-4">Valor</th>
                    <th className="text-right py-3 px-4">Quitar</th>
                </tr>
            </thead>
            <tbody>
                {pending.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Nenhuma cobrança pendente.</td></tr>}
                {pending.map((c) => (
                    <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-medium">{c.player_name}</td>
                        <td className="py-3 px-4 font-semibold text-primary">{c.tournament_name || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{c.description || c.type} · <span className="text-xs">{fmtDateTime(c.created_at)}</span></td>
                        <td className="py-3 px-4 text-right font-mono font-semibold">{fmtBRL(c.amount)}</td>
                        <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                                <PayBtn label="Dinheiro" icon={Banknote} onClick={() => pay(c.id, "cash")} />
                                <PayBtn label="PIX" icon={Coins} onClick={() => pay(c.id, "pix")} />
                                <PayBtn label="Cartão" icon={CreditCard} onClick={() => pay(c.id, "card")} />
                                <PayBtn label="Fiado" icon={AlertTriangle} onClick={() => pay(c.id, "debt")} accent="warning" />
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const PlayerChargesPanel = ({ players, pay }) => {
    const [selectedPid, setSelectedPid] = useState("");
    const [playerCharges, setPlayerCharges] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedPid) {
            setPlayerCharges([]);
            return;
        }
        const loadPlayerCharges = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/cashier/players/${selectedPid}/charges`);
                setPlayerCharges(res.data);
            } catch (e) {
                toast.error("Erro ao buscar cobranças do jogador");
            } finally {
                setLoading(false);
            }
        };
        loadPlayerCharges();
    }, [selectedPid]);

    const handlePay = async (cid, method) => {
        await pay(cid, method);
        // Refresh local list
        const res = await api.get(`/cashier/players/${selectedPid}/charges`);
        setPlayerCharges(res.data);
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl bg-surface border border-white/5 p-6 max-w-xl">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Selecionar Jogador</Label>
                <Select value={selectedPid} onValueChange={setSelectedPid}>
                    <SelectTrigger className="bg-surface-elevated border-white/10 h-12 text-lg"><SelectValue placeholder="Busque o jogador..." /></SelectTrigger>
                    <SelectContent>
                        {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {selectedPid && (
                <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden animate-fade-in">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between bg-primary/5">
                        <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                            <ReceiptText className="size-4 text-primary" /> 
                            Contas de {players.find(p => p.id === selectedPid)?.name}
                        </h3>
                        <div className="text-sm font-mono bg-surface px-3 py-1 rounded-full border border-white/5">
                            Subtotal: <span className="font-bold text-primary">{fmtBRL(playerCharges.reduce((s, c) => s + c.amount, 0))}</span>
                        </div>
                    </div>
                    
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-surface-elevated text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                <th className="text-left py-3 px-4">Torneio / Origem</th>
                                <th className="text-left py-3 px-4">Descrição</th>
                                <th className="text-left py-3 px-4">Status</th>
                                <th className="text-right py-3 px-4">Valor</th>
                                <th className="text-right py-3 px-4">Quitar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>}
                            {!loading && playerCharges.length === 0 && (
                                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Nenhuma conta pendente para este jogador.</td></tr>
                            )}
                            {playerCharges.map((c) => (
                                <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-4 font-semibold text-primary">{c.tournament_name || "—"}</td>
                                    <td className="py-3 px-4 text-muted-foreground">
                                        {c.description || c.type} <br/>
                                        <span className="text-[10px] opacity-50">{fmtDateTime(c.created_at)}</span>
                                    </td>
                                    <td className="py-3 px-4">
                                        {c.payment_status === "on_debt" ? (
                                            <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-bold uppercase">FIADO</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded bg-warning/10 text-warning text-[10px] font-bold uppercase">PENDENTE</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-semibold">{fmtBRL(c.amount)}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-end gap-1 flex-wrap">
                                            <PayBtn label="Dinheiro" icon={Banknote} onClick={() => handlePay(c.id, "cash")} />
                                            <PayBtn label="PIX" icon={Coins} onClick={() => handlePay(c.id, "pix")} />
                                            <PayBtn label="Cartão" icon={CreditCard} onClick={() => handlePay(c.id, "card")} />
                                            {c.payment_status !== "on_debt" && (
                                                <PayBtn label="Fiado" icon={AlertTriangle} onClick={() => handlePay(c.id, "debt")} accent="warning" />
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const DebtPanel = ({ debtors, reload }) => {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState("cash");

    const settle = async () => {
        try {
            await api.post("/cashier/transactions", {
                type: "debt_payment", player_id: selected.id, amount: Number(amount), payment_method: method,
                description: `Pagamento de dívida — ${selected.name}`,
            });
            toast.success("Dívida quitada parcial/totalmente");
            setOpen(false); setSelected(null); setAmount("");
            reload();
        } catch (e) { toast.error(apiErr(e)); }
    };

    return (
        <>
            <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
                <div className="p-5 border-b border-white/5">
                    <h3 className="font-heading text-lg font-semibold flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" /> Jogadores devedores</h3>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-surface-elevated text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <th className="text-left py-3 px-4">Jogador</th>
                            <th className="text-right py-3 px-4">Saldo devedor</th>
                            <th className="text-right py-3 px-4"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {debtors.length === 0 && <tr><td colSpan={3} className="text-center py-12 text-muted-foreground">Nenhum jogador devedor.</td></tr>}
                        {debtors.map((p) => (
                            <tr key={p.id} className="border-t border-white/5">
                                <td className="py-3 px-4 font-medium">
                                    {p.name}
                                    {p.last_session_result !== undefined && (
                                        <div className="text-[10px] text-muted-foreground mt-0.5">
                                            Última sessão: <span className={p.last_session_result >= 0 ? "text-primary" : "text-destructive"}>
                                                {p.last_session_result >= 0 ? "+" : ""}{fmtBRL(p.last_session_result)}
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-semibold text-destructive">{fmtBRL(p.debt_balance)}</td>
                                <td className="py-3 px-4 text-right">
                                    <Button data-testid={`pay-debt-${p.id}`} size="sm" onClick={() => { setSelected(p); setAmount(p.debt_balance); setOpen(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90">
                                        Receber
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="bg-surface border-white/10 max-w-sm">
                    <DialogHeader><DialogTitle>Receber pagamento · {selected?.name}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div className="text-sm">Saldo: <span className="font-mono text-destructive font-semibold">{fmtBRL(selected?.debt_balance || 0)}</span></div>
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Valor</Label>
                            <Input data-testid="settle-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-surface-elevated border-white/10 font-mono" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Método</Label>
                            <Select value={method} onValueChange={setMethod}>
                                <SelectTrigger data-testid="settle-method" className="bg-surface-elevated border-white/10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Dinheiro</SelectItem>
                                    <SelectItem value="pix">PIX</SelectItem>
                                    <SelectItem value="card">Cartão</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={settle} data-testid="confirm-settle-button" className="bg-primary text-primary-foreground hover:bg-primary/90">Quitar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

const CashSalePanel = ({ players, reload }) => {
    const [pid, setPid] = useState("");
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState("cash");

    const sell = async () => {
        if (!amount) return;
        try {
            await api.post("/cashier/transactions", {
                type: "cash_chip_sale", player_id: pid || null, amount: Number(amount), payment_method: method,
                description: "Venda de fichas — Cash Game",
            });
            toast.success("Venda registrada");
            setAmount("");
            reload();
        } catch (e) { toast.error(apiErr(e)); }
    };

    return (
        <div className="rounded-2xl bg-surface border border-white/5 p-6 max-w-xl">
            <h3 className="font-heading text-lg font-semibold flex items-center gap-2 mb-4"><Coins className="size-4 text-primary" /> Vender fichas (Cash Game)</h3>
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Jogador (opcional)</Label>
                    <Select value={pid} onValueChange={setPid}>
                        <SelectTrigger data-testid="sell-player-select" className="bg-surface-elevated border-white/10"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                            {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Valor</Label>
                        <Input data-testid="sell-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-surface-elevated border-white/10 font-mono" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Método</Label>
                        <Select value={method} onValueChange={setMethod}>
                            <SelectTrigger data-testid="sell-method" className="bg-surface-elevated border-white/10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Dinheiro</SelectItem>
                                <SelectItem value="pix">PIX</SelectItem>
                                <SelectItem value="card">Cartão</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Button onClick={sell} data-testid="confirm-sell-button" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="size-4" /> Registrar venda
                </Button>
            </div>
        </div>
    );
};

const HistoryPanel = ({ transactions }) => (
    <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
            <thead>
                <tr className="bg-surface-elevated text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="text-left py-3 px-4">Quando</th>
                    <th className="text-left py-3 px-4">Descrição</th>
                    <th className="text-left py-3 px-4 hidden md:table-cell">Método</th>
                    <th className="text-right py-3 px-4">Valor</th>
                </tr>
            </thead>
            <tbody>
                {transactions.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">Sem transações.</td></tr>}
                {transactions.map((t) => (
                    <tr key={t.id} className="border-t border-white/5">
                        <td className="py-3 px-4 text-muted-foreground">{fmtDateTime(t.created_at)}</td>
                        <td className="py-3 px-4">{t.description || t.type}</td>
                        <td className="py-3 px-4 hidden md:table-cell text-muted-foreground capitalize">{t.payment_method}</td>
                        <td className={`py-3 px-4 text-right font-mono ${t.type === "debt_payment" || t.type === "tournament_payment" || t.type === "cash_chip_sale" ? "text-success" : t.type === "debt_added" ? "text-destructive" : ""}`}>
                            {fmtBRL(t.amount)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const PayBtn = ({ icon: Icon, label, onClick, accent = "primary" }) => (
    <button
        onClick={onClick}
        title={label}
        className={`px-2.5 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors bg-${accent}/10 border-${accent}/30 text-${accent} hover:bg-${accent}/20`}
    >
        <Icon className="size-3.5" /> {label}
    </button>
);
