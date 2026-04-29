import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fmtBRL, fmtDateTime, apiErr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Coins, Filter, Plus, FileText, Landmark } from "lucide-react";
import { toast } from "sonner";

export default function RakeReport() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [rake, setRake] = useState("");
    const [jackpot, setJackpot] = useState("");
    const [tableName, setTableName] = useState("");
    const [notes, setNotes] = useState("");

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/cashier/rake/history?days=30");
            setHistory(data);
        } catch (e) { toast.error(apiErr(e)); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleSave = async () => {
        if (!rake && !jackpot) return toast.error("Informe ao menos um valor");
        try {
            await api.post("/cashier/rake/manual", {
                rake: Number(rake) || 0,
                jackpot: Number(jackpot) || 0,
                table_name: tableName || "Geral",
                notes
            });
            toast.success("Lançamento realizado");
            setOpen(false);
            setRake(""); setJackpot(""); setTableName(""); setNotes("");
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const totalRake = history.filter(t => t.description.includes("Rake")).reduce((s, t) => s + t.amount, 0);
    const totalJack = history.filter(t => t.description.includes("Jackpot")).reduce((s, t) => s + t.amount, 0);

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Financeiro · Conferência</div>
                    <h1 className="text-4xl font-heading font-bold tracking-tight">Relatório de Rake</h1>
                    <p className="text-sm text-muted-foreground mt-1">Acompanhamento de arrecadações (Rake e Jackpot) do salão.</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                            <Plus className="size-4 mr-2" /> Lançar Rake Manual
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-surface border-white/10">
                        <DialogHeader>
                            <DialogTitle>Lançamento Manual de Rake/Jackpot</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Valor Rake (R$)</Label>
                                    <Input type="number" placeholder="0.00" value={rake} onChange={e => setRake(e.target.value)} className="bg-surface-elevated border-white/10 font-mono" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Valor Jackpot (R$)</Label>
                                    <Input type="number" placeholder="0.00" value={jackpot} onChange={e => setJackpot(e.target.value)} className="bg-surface-elevated border-white/10 font-mono" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Mesa / Dealer</Label>
                                <Input placeholder="Ex: Mesa 1 / Dealer Juliano" value={tableName} onChange={e => setTableName(e.target.value)} className="bg-surface-elevated border-white/10" />
                            </div>
                            <div className="space-y-2">
                                <Label>Observações</Label>
                                <Input placeholder="Ex: Troca de turno" value={notes} onChange={e => setNotes(e.target.value)} className="bg-surface-elevated border-white/10" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSave} className="bg-primary text-primary-foreground">Salvar Lançamento</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="rounded-2xl bg-surface border border-white/5 p-6">
                    <div className="flex items-center gap-3 mb-4 text-muted-foreground uppercase text-[10px] tracking-widest">
                        <Landmark className="size-4 text-primary" /> Total Rake (30 dias)
                    </div>
                    <div className="text-4xl font-heading font-bold text-primary">{fmtBRL(totalRake)}</div>
                </div>
                <div className="rounded-2xl bg-surface border border-white/5 p-6">
                    <div className="flex items-center gap-3 mb-4 text-muted-foreground uppercase text-[10px] tracking-widest">
                        <Coins className="size-4 text-amber-500" /> Total Jackpot (30 dias)
                    </div>
                    <div className="text-4xl font-heading font-bold text-amber-500">{fmtBRL(totalJack)}</div>
                </div>
            </div>

            <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <h3 className="font-heading font-semibold flex items-center gap-2"><FileText className="size-4 text-muted-foreground" /> Movimentação Recente</h3>
                    <div className="text-xs text-muted-foreground">Exibindo últimos 30 dias</div>
                </div>
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="bg-surface-elevated text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <th className="py-3 px-4 font-medium">Data/Hora</th>
                            <th className="py-3 px-4 font-medium">Descrição</th>
                            <th className="py-3 px-4 font-medium text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={3} className="text-center py-12 text-muted-foreground animate-pulse">Carregando histórico...</td></tr>}
                        {!loading && history.length === 0 && <tr><td colSpan={3} className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</td></tr>}
                        {history.map((t) => (
                            <tr key={t.id} className="border-t border-white/5 hover:bg-white/[0.01]">
                                <td className="py-3 px-4 text-muted-foreground">{fmtDateTime(t.created_at)}</td>
                                <td className="py-3 px-4">
                                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${t.description.includes("Rake") ? "bg-primary" : "bg-amber-500"}`} />
                                    {t.description}
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold">{fmtBRL(t.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
