import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { fmtDate, apiErr } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function Users() {
    const { user: me } = useAuth();
    const [list, setList] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", password: "", role: "operator" });

    const load = async () => {
        const { data } = await api.get("/users");
        setList(data);
    };
    useEffect(() => { load(); }, []);

    const create = async (e) => {
        e.preventDefault();
        try {
            await api.post("/users", form);
            toast.success("Usuário criado");
            setOpen(false);
            setForm({ name: "", email: "", password: "", role: "operator" });
            load();
        } catch (e) { toast.error(apiErr(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("Remover usuário?")) return;
        try { await api.delete(`/users/${id}`); load(); }
        catch (e) { toast.error(apiErr(e)); }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1100px] mx-auto animate-fade-in-up">
            <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Acessos</div>
                    <h1 className="text-4xl font-heading font-bold tracking-tight">Usuários</h1>
                    <p className="text-sm text-muted-foreground mt-1">Administre operadores e administradores do sistema.</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button data-testid="add-user-button" className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="size-4" /> Novo usuário</Button>
                    </DialogTrigger>
                    <DialogContent className="bg-surface border-white/10">
                        <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
                        <form onSubmit={create} className="space-y-3">
                            <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">Nome</Label><Input data-testid="user-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-surface-elevated border-white/10" /></div>
                            <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">E-mail</Label><Input data-testid="user-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-surface-elevated border-white/10" /></div>
                            <div className="space-y-1.5"><Label className="text-xs uppercase tracking-widest text-muted-foreground">Senha</Label><Input data-testid="user-password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-surface-elevated border-white/10" /></div>
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Permissão</Label>
                                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                                    <SelectTrigger data-testid="user-role" className="bg-surface-elevated border-white/10"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="operator">Operador / Caixa</SelectItem>
                                        <SelectItem value="admin">Administrador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter><Button type="submit" data-testid="save-user-button" className="bg-primary text-primary-foreground hover:bg-primary/90">Criar</Button></DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-surface-elevated text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <th className="text-left py-3 px-4">Nome</th>
                            <th className="text-left py-3 px-4">E-mail</th>
                            <th className="text-left py-3 px-4">Permissão</th>
                            <th className="text-left py-3 px-4 hidden md:table-cell">Criado em</th>
                            <th className="w-12"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.map((u) => (
                            <tr key={u.id} className="border-t border-white/5">
                                <td className="py-3 px-4 font-medium">{u.name}</td>
                                <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{u.email}</td>
                                <td className="py-3 px-4">
                                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full inline-flex items-center gap-1 ${u.role === "admin" ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary text-secondary-foreground"}`}>
                                        {u.role === "admin" && <ShieldCheck className="size-3" />} {u.role}
                                    </span>
                                </td>
                                <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{fmtDate(u.created_at)}</td>
                                <td className="py-3 px-4 text-right">
                                    {u.id !== me?.id && (
                                        <Button variant="ghost" size="icon" onClick={() => remove(u.id)} data-testid={`del-user-${u.id}`}><Trash2 className="size-4 text-destructive" /></Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
