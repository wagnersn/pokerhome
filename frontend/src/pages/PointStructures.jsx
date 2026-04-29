import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, X, Diamond, Trash2 } from "lucide-react";
import { apiErr } from "@/lib/format";
import { toast } from "sonner";

export default function PointStructures() {
    const [list, setList] = useState([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [name, setName] = useState("");
    const [rules, setRules] = useState([{ position: 1, points: 100 }]);

    const load = async () => {
        const { data } = await api.get("/point-structures");
        setList(data);
    };
    useEffect(() => { load(); }, []);

    const startNew = () => {
        setEditing(null);
        setName("");
        setRules([{ position: 1, points: 100 }]);
        setOpen(true);
    };
    const startEdit = (ps) => {
        setEditing(ps);
        setName(ps.name);
        setRules(ps.rules);
        setOpen(true);
    };

    const save = async (e) => {
        e.preventDefault();
        const body = { name, rules: rules.map((r) => ({ position: Number(r.position), points: Number(r.points) })) };
        try {
            if (editing) await api.put(`/point-structures/${editing.id}`, body);
            else await api.post("/point-structures", body);
            toast.success("Estrutura salva");
            setOpen(false);
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("Remover estrutura?")) return;
        try { await api.delete(`/point-structures/${id}`); load(); }
        catch (e) { toast.error(apiErr(e)); }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1100px] mx-auto animate-fade-in-up">
            <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Configuração</div>
                    <h1 className="text-4xl font-heading font-bold tracking-tight">Estruturas de Pontuação</h1>
                    <p className="text-sm text-muted-foreground mt-1">Defina como pontos são atribuídos por posição final.</p>
                </div>
                <Button onClick={startNew} data-testid="add-ps-button" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="size-4" /> Nova estrutura
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {list.map((ps) => (
                    <div key={ps.id} data-testid={`ps-card-${ps.id}`} className="rounded-2xl bg-surface border border-white/5 p-5">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                <Diamond className="size-4 text-primary" />
                                <h3 className="font-heading text-lg font-semibold">{ps.name}</h3>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => startEdit(ps)} data-testid={`edit-ps-${ps.id}`}>Editar</Button>
                                <Button variant="ghost" size="icon" onClick={() => remove(ps.id)} data-testid={`del-ps-${ps.id}`}><Trash2 className="size-4 text-destructive" /></Button>
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                            {ps.rules.slice(0, 9).map((r, i) => (
                                <div key={i} className="rounded-md bg-surface-elevated px-2 py-1.5 flex items-center justify-between">
                                    <span className="text-muted-foreground">#{r.position}</span>
                                    <span className="font-mono font-semibold">{r.points}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="bg-surface border-white/10 max-w-lg">
                    <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} estrutura</DialogTitle></DialogHeader>
                    <form onSubmit={save} className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Nome</Label>
                            <Input data-testid="ps-name-input" required value={name} onChange={(e) => setName(e.target.value)} className="bg-surface-elevated border-white/10" />
                        </div>
                        <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                            {rules.map((r, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <Input type="number" min="1" value={r.position} onChange={(e) => setRules(rules.map((x, i) => i === idx ? { ...x, position: e.target.value } : x))} className="bg-surface-elevated border-white/10 w-24 font-mono" />
                                    <Input type="number" step="0.01" value={r.points} onChange={(e) => setRules(rules.map((x, i) => i === idx ? { ...x, points: e.target.value } : x))} className="bg-surface-elevated border-white/10 font-mono" />
                                    <Button variant="ghost" size="icon" onClick={() => setRules(rules.filter((_, i) => i !== idx))} type="button"><X className="size-4" /></Button>
                                </div>
                            ))}
                        </div>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setRules([...rules, { position: rules.length + 1, points: 0 }])}>+ Posição</Button>
                        <DialogFooter>
                            <Button type="submit" data-testid="save-ps-button" className="bg-primary text-primary-foreground hover:bg-primary/90">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
