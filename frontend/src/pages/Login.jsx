import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spade, Loader2 } from "lucide-react";
import { apiErr } from "@/lib/format";
import { toast } from "sonner";
import api from "@/lib/api";

export default function Login() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("admin@poker.com");
    const [password, setPassword] = useState("admin123");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [houseName, setHouseName] = useState("Casa Royale");

    React.useEffect(() => {
        api.get("/config").then(({ data }) => {
            if (data.house_name) setHouseName(data.house_name);
        }).catch(() => {});
    }, []);

    if (user && user !== false) return <Navigate to="/dashboard" replace />;

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(email, password);
            toast.success(`Bem-vindo à ${houseName}`);
            navigate("/dashboard", { replace: true });
        } catch (err) {
            setError(apiErr(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen felt grid-bg flex items-center justify-center p-6">
            <div className="absolute top-8 left-8 flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                    <Spade className="size-5 text-primary" strokeWidth={2} />
                </div>
                <div>
                    <div className="font-heading font-bold tracking-tight text-lg leading-none">{houseName}</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">Poker Manager</div>
                </div>
            </div>

            <div className="w-full max-w-md animate-fade-in-up">
                <div className="glass rounded-2xl p-8 shadow-[0_8px_64px_rgba(0,0,0,0.6)]">
                    <div className="mb-7">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Acesso restrito</div>
                        <h1 className="text-3xl font-heading font-bold tracking-tight">Boa noite, operador.</h1>
                        <p className="text-sm text-muted-foreground mt-2">
                            Entre com suas credenciais para gerenciar torneios, caixa e ranking.
                        </p>
                    </div>

                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs uppercase tracking-widest text-muted-foreground">E-mail</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                data-testid="login-email-input"
                                className="bg-surface-elevated border-white/10 h-11"
                                autoComplete="username"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="pw" className="text-xs uppercase tracking-widest text-muted-foreground">Senha</Label>
                            <Input
                                id="pw"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                data-testid="login-password-input"
                                className="bg-surface-elevated border-white/10 h-11"
                                autoComplete="current-password"
                            />
                        </div>
                        {error && (
                            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2" data-testid="login-error">
                                {error}
                            </div>
                        )}
                        <Button
                            type="submit"
                            disabled={loading}
                            data-testid="login-submit-button"
                            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold tracking-wide"
                        >
                            {loading ? <Loader2 className="size-4 animate-spin" /> : "Entrar"}
                        </Button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-white/5 text-xs text-muted-foreground space-y-1">
                        <div>Admin: <span className="font-mono text-foreground">admin@poker.com / admin123</span></div>
                        <div>Caixa: <span className="font-mono text-foreground">caixa@poker.com / caixa123</span></div>
                    </div>
                </div>
                <div className="mt-6 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    {houseName} · Operações de Poker · 24/7
                </div>
            </div>
        </div>
    );
}
