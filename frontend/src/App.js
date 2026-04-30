import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import "@/index.css";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Players from "@/pages/Players";
import PlayerProfile from "@/pages/PlayerProfile";
import Tournaments from "@/pages/Tournaments";
import TournamentDetail from "@/pages/TournamentDetail";
import Rankings from "@/pages/Rankings";
import Cashier from "@/pages/Cashier";
import CashGames from "@/pages/CashGames";
import PointStructures from "@/pages/PointStructures";
import Users from "@/pages/Users";
import RakeReport from "@/pages/RakeReport";
import Dealers from "@/pages/Dealers";
import MarketingReport from "@/pages/MarketingReport";

function App() {
    return (
        <div className="App dark">
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route
                            element={
                                <ProtectedRoute>
                                    <AppLayout />
                                </ProtectedRoute>
                            }
                        >
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/jogadores" element={<Players />} />
                            <Route path="/jogadores/:id" element={<PlayerProfile />} />
                            <Route path="/torneios" element={<Tournaments />} />
                            <Route path="/torneios/:id" element={<TournamentDetail />} />
                            <Route path="/ranking" element={<Rankings />} />
                            <Route path="/caixa" element={<Cashier />} />
                            <Route path="/cash-games" element={<CashGames />} />
                            <Route path="/rake-report" element={<RakeReport />} />
                            <Route path="/dealers" element={<Dealers />} />
                            <Route path="/marketing" element={<MarketingReport />} />
                            <Route
                                path="/pontuacao"
                                element={
                                    <ProtectedRoute adminOnly>
                                        <PointStructures />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/usuarios"
                                element={
                                    <ProtectedRoute adminOnly>
                                        <Users />
                                    </ProtectedRoute>
                                }
                            />
                        </Route>
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </BrowserRouter>
                <Toaster richColors position="top-right" theme="dark" />
            </AuthProvider>
        </div>
    );
}

export default App;
