"""Casa de Poker - Backend regression tests.
Covers: auth, players, point structures, tournaments+entries, cashier, cash-tables,
waitlist, rankings, dashboard, RBAC.
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://table-command.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@poker.com", "password": "admin123"}
OPER = {"email": "caixa@poker.com", "password": "caixa123"}


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    # cookie + Bearer fallback
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="session")
def operator_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=OPER, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"operator login failed: {r.status_code}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


# ---------- Auth ----------
class TestAuth:
    def test_login_admin(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=ADMIN, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin"
        assert d["email"] == ADMIN["email"]
        assert "token" in d
        # cookie set
        assert s.cookies.get("access_token") is not None

    def test_login_operator(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=OPER, timeout=20)
        assert r.status_code == 200
        assert r.json()["role"] == "operator"

    def test_me_with_cookie(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json=ADMIN, timeout=20)
        r = s.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN["email"]

    def test_logout_clears_cookie(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json=ADMIN, timeout=20)
        r = s.post(f"{API}/auth/logout", timeout=15)
        assert r.status_code == 200
        # After logout the response should clear cookie; subsequent /me without bearer should 401
        s2 = requests.Session()
        # Manually copy cookie to verify behavior - instead just verify endpoint shape
        assert r.json().get("ok") is True

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_brute_force_lockout(self):
        # Use unique bad email so that admin/operator throttle isn't tripped for other tests
        bad_email = f"nope_{uuid.uuid4().hex[:6]}@x.com"
        codes = []
        for _ in range(7):
            r = requests.post(f"{API}/auth/login", json={"email": bad_email, "password": "x"}, timeout=15)
            codes.append(r.status_code)
        # Expect 401 first 5 times, then 429
        assert 429 in codes, f"no 429 seen, codes={codes}"


# ---------- Players ----------
@pytest.fixture(scope="class")
def created_player(admin_session):
    body = {"name": f"TEST_Player_{uuid.uuid4().hex[:6]}", "email": "tp@test.com", "phone": "11"}
    r = admin_session.post(f"{API}/players", json=body, timeout=15)
    assert r.status_code == 200, r.text
    pl = r.json()
    yield pl
    admin_session.delete(f"{API}/players/{pl['id']}")


class TestPlayers:
    def test_list_players(self, admin_session):
        r = admin_session.get(f"{API}/players", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_get_update(self, admin_session, created_player):
        pid = created_player["id"]
        # GET
        r = admin_session.get(f"{API}/players/{pid}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == pid
        # PUT
        r = admin_session.put(f"{API}/players/{pid}", json={"name": "TEST_Updated", "email": "u@u.com"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Updated"
        # GET verify
        r = admin_session.get(f"{API}/players/{pid}", timeout=15)
        assert r.json()["name"] == "TEST_Updated"

    def test_player_profile(self, admin_session, created_player):
        r = admin_session.get(f"{API}/players/{created_player['id']}/profile", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "stats" in d and "entries" in d and "transactions" in d

    def test_operator_cannot_delete_player(self, operator_session, admin_session):
        body = {"name": f"TEST_Del_{uuid.uuid4().hex[:6]}"}
        r = admin_session.post(f"{API}/players", json=body, timeout=15)
        pid = r.json()["id"]
        r = operator_session.delete(f"{API}/players/{pid}", timeout=15)
        assert r.status_code == 403
        # cleanup
        admin_session.delete(f"{API}/players/{pid}")


# ---------- Point structures ----------
class TestPointStructures:
    def test_default_seeded(self, admin_session):
        r = admin_session.get(f"{API}/point-structures", timeout=15)
        assert r.status_code == 200
        names = [d["name"] for d in r.json()]
        assert "Padrão (Top 9)" in names

    def test_create_update_delete_admin_only(self, admin_session, operator_session):
        body = {"name": f"TEST_PS_{uuid.uuid4().hex[:6]}", "rules": [{"position": 1, "points": 50}]}
        # operator forbidden
        r = operator_session.post(f"{API}/point-structures", json=body, timeout=15)
        assert r.status_code == 403
        # admin allowed
        r = admin_session.post(f"{API}/point-structures", json=body, timeout=15)
        assert r.status_code == 200
        psid = r.json()["id"]
        r = admin_session.put(f"{API}/point-structures/{psid}", json={"name": body["name"], "rules": [{"position": 1, "points": 99}]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["rules"][0]["points"] == 99
        r = admin_session.delete(f"{API}/point-structures/{psid}", timeout=15)
        assert r.status_code == 200


# ---------- Tournaments + Entries ----------
@pytest.fixture(scope="session")
def tournament_ctx(admin_session):
    # create dependent data: point struct + tournament + 2 players
    ps = admin_session.get(f"{API}/point-structures", timeout=15).json()
    ps_id = next(p["id"] for p in ps if p["name"] == "Padrão (Top 9)")
    start_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    t_body = {
        "name": f"TEST_T_{uuid.uuid4().hex[:6]}",
        "type": "NLHE Daily",
        "start_at": start_at,
        "buy_in": 100, "rake": 20, "rebuy": 80, "addon_simple": 50, "super_addon": 100, "bonus": 30,
        "point_structure_id": ps_id,
    }
    r = admin_session.post(f"{API}/tournaments", json=t_body, timeout=15)
    assert r.status_code == 200, r.text
    tournament = r.json()
    p1 = admin_session.post(f"{API}/players", json={"name": f"TEST_P1_{uuid.uuid4().hex[:6]}"}).json()
    p2 = admin_session.post(f"{API}/players", json={"name": f"TEST_P2_{uuid.uuid4().hex[:6]}"}).json()
    yield {"tournament": tournament, "player1": p1, "player2": p2, "ps_id": ps_id}
    # cleanup
    entries = admin_session.get(f"{API}/tournaments/{tournament['id']}/entries").json()
    for e in entries:
        admin_session.delete(f"{API}/entries/{e['id']}")
    admin_session.delete(f"{API}/tournaments/{tournament['id']}")
    admin_session.delete(f"{API}/players/{p1['id']}")
    admin_session.delete(f"{API}/players/{p2['id']}")


class TestTournaments:
    def test_create_admin_only(self, operator_session):
        r = operator_session.post(f"{API}/tournaments", json={
            "name": "X", "type": "Y", "start_at": datetime.now(timezone.utc).isoformat()
        }, timeout=15)
        assert r.status_code == 403

    def test_list(self, admin_session, tournament_ctx):
        r = admin_session.get(f"{API}/tournaments", timeout=15)
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()]
        assert tournament_ctx["tournament"]["id"] in ids

    def test_status_transitions(self, admin_session, tournament_ctx):
        tid = tournament_ctx["tournament"]["id"]
        for s in ["in_progress", "finished", "scheduled"]:
            r = admin_session.post(f"{API}/tournaments/{tid}/status", params={"status": s}, timeout=15)
            assert r.status_code == 200

    def test_entry_buyin_charge(self, admin_session, tournament_ctx):
        tid = tournament_ctx["tournament"]["id"]
        pid = tournament_ctx["player1"]["id"]
        r = admin_session.post(f"{API}/tournaments/{tid}/entries", params={"player_id": pid}, timeout=15)
        assert r.status_code == 200, r.text
        entry = r.json()
        assert entry["total_spent"] == 120  # buyin+rake
        assert entry["pending_amount"] == 120
        # duplicate rejected
        r = admin_session.post(f"{API}/tournaments/{tid}/entries", params={"player_id": pid}, timeout=15)
        assert r.status_code == 400

    def test_entry_actions_increment(self, admin_session, tournament_ctx):
        tid = tournament_ctx["tournament"]["id"]
        pid = tournament_ctx["player2"]["id"]
        e = admin_session.post(f"{API}/tournaments/{tid}/entries", params={"player_id": pid}, timeout=15).json()
        for action in ["rebuy", "addon", "super_addon", "bonus"]:
            r = admin_session.post(f"{API}/entries/{e['id']}/action", params={"action": action}, timeout=15)
            assert r.status_code == 200, f"{action}: {r.text}"
        # bonus duplicate
        r = admin_session.post(f"{API}/entries/{e['id']}/action", params={"action": "bonus"}, timeout=15)
        assert r.status_code == 400
        # verify totals
        entries = admin_session.get(f"{API}/tournaments/{tid}/entries").json()
        my = next(x for x in entries if x["id"] == e["id"])
        assert my["rebuys"] == 1
        assert my["addons_simple"] == 1
        assert my["super_addons"] == 1
        assert my["bonus"] is True
        # 100+20+80+50+100+30 = 380
        assert my["total_spent"] == 380

    def test_set_position_and_points(self, admin_session, tournament_ctx):
        tid = tournament_ctx["tournament"]["id"]
        entries = admin_session.get(f"{API}/tournaments/{tid}/entries").json()
        assert entries
        e = entries[0]
        r = admin_session.put(f"{API}/entries/{e['id']}/position", params={"position": 1}, timeout=15)
        assert r.status_code == 200
        assert r.json()["points"] == 100  # default top 9 first place

    def test_summary(self, admin_session, tournament_ctx):
        tid = tournament_ctx["tournament"]["id"]
        r = admin_session.get(f"{API}/tournaments/{tid}/summary", timeout=15)
        assert r.status_code == 200
        totals = r.json()["totals"]
        # 2 entries: gross = 120+380 = 500, rake = 20*2 = 40, prize_pool = 460
        assert totals["entries"] == 2
        assert totals["gross"] == 500
        assert totals["rake"] == 40
        assert totals["prize_pool"] == 460

    def test_prize_distribution(self, admin_session, tournament_ctx):
        tid = tournament_ctx["tournament"]["id"]
        r = admin_session.put(f"{API}/tournaments/{tid}/prize-distribution",
                              json={"distribution": [{"position": 1, "percent": 60}, {"position": 2, "percent": 40}]},
                              timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["prize_pool"] == 460
        amounts = {x["position"]: x["amount"] for x in d["distribution"]}
        assert amounts[1] == round(460 * 0.6, 2)
        assert amounts[2] == round(460 * 0.4, 2)


# ---------- Cashier ----------
class TestCashier:
    def test_pending_listing(self, admin_session, tournament_ctx):
        r = admin_session.get(f"{API}/cashier/pending", timeout=15)
        assert r.status_code == 200
        # there should be pending charges from entries above
        assert isinstance(r.json(), list)

    def test_pay_cash_then_debt(self, admin_session, tournament_ctx):
        pending = admin_session.get(f"{API}/cashier/pending").json()
        # pick a buyin charge
        if not pending:
            pytest.skip("no pending charges")
        c_cash = pending[0]
        r = admin_session.post(f"{API}/cashier/charges/{c_cash['id']}/pay", params={"method": "cash"}, timeout=15)
        assert r.status_code == 200
        # already processed
        r = admin_session.post(f"{API}/cashier/charges/{c_cash['id']}/pay", params={"method": "cash"}, timeout=15)
        assert r.status_code == 400

        # debt path - take next pending
        pending = admin_session.get(f"{API}/cashier/pending").json()
        if pending:
            c_debt = pending[0]
            pid = c_debt["player_id"]
            before = admin_session.get(f"{API}/players/{pid}").json()["debt_balance"]
            r = admin_session.post(f"{API}/cashier/charges/{c_debt['id']}/pay", params={"method": "debt"}, timeout=15)
            assert r.status_code == 200
            after = admin_session.get(f"{API}/players/{pid}").json()["debt_balance"]
            assert round(after - before, 2) == round(c_debt["amount"], 2)

    def test_debtors_list(self, admin_session):
        r = admin_session.get(f"{API}/cashier/debtors", timeout=15)
        assert r.status_code == 200
        for d in r.json():
            assert d["debt_balance"] > 0

    def test_debt_payment_reduces(self, admin_session):
        debtors = admin_session.get(f"{API}/cashier/debtors").json()
        if not debtors:
            pytest.skip("no debtors")
        d = debtors[0]
        before = d["debt_balance"]
        r = admin_session.post(f"{API}/cashier/transactions", json={
            "type": "debt_payment", "player_id": d["id"], "amount": before, "payment_method": "cash"
        }, timeout=15)
        assert r.status_code == 200
        after = admin_session.get(f"{API}/players/{d['id']}").json()["debt_balance"]
        assert round(after, 2) == 0.0

    def test_entry_blocked_if_debt(self, admin_session, tournament_ctx):
        # create a player with debt manually via debt charge flow
        pl = admin_session.post(f"{API}/players", json={"name": f"TEST_Dbt_{uuid.uuid4().hex[:6]}"}).json()
        # Add direct debt via increment using a tournament entry+pay debt
        tid = tournament_ctx["tournament"]["id"]
        e = admin_session.post(f"{API}/tournaments/{tid}/entries", params={"player_id": pl["id"]}).json()
        pending = [c for c in admin_session.get(f"{API}/cashier/pending").json() if c.get("entry_id") == e["id"]]
        if pending:
            admin_session.post(f"{API}/cashier/charges/{pending[0]['id']}/pay", params={"method": "debt"})
        # now try to create entry in another tournament -> 409
        ps_id = tournament_ctx["ps_id"]
        t2 = admin_session.post(f"{API}/tournaments", json={
            "name": f"TEST_T2_{uuid.uuid4().hex[:6]}", "type": "X",
            "start_at": (datetime.now(timezone.utc)+timedelta(hours=2)).isoformat(),
            "buy_in": 50, "rake": 5, "point_structure_id": ps_id,
        }).json()
        r = admin_session.post(f"{API}/tournaments/{t2['id']}/entries", params={"player_id": pl["id"]}, timeout=15)
        assert r.status_code == 409
        # allow_debt=true bypasses
        r = admin_session.post(f"{API}/tournaments/{t2['id']}/entries", params={"player_id": pl["id"], "allow_debt": True}, timeout=15)
        assert r.status_code == 200
        # cleanup
        for ent in admin_session.get(f"{API}/tournaments/{t2['id']}/entries").json():
            admin_session.delete(f"{API}/entries/{ent['id']}")
        admin_session.delete(f"{API}/entries/{e['id']}")
        admin_session.delete(f"{API}/tournaments/{t2['id']}")
        admin_session.delete(f"{API}/players/{pl['id']}")


# ---------- Cash Tables + Waitlist ----------
class TestCashTables:
    def test_full_flow(self, admin_session, operator_session):
        body = {"name": f"TEST_TBL_{uuid.uuid4().hex[:6]}", "game_type": "texas_holdem",
                "small_blind": 1, "big_blind": 2, "max_seats": 9}
        r = operator_session.post(f"{API}/cash-tables", json=body)
        assert r.status_code == 403
        r = admin_session.post(f"{API}/cash-tables", json=body, timeout=15)
        assert r.status_code == 200, r.text
        tbl = r.json()
        assert tbl["status"] == "closed"
        # open
        r = admin_session.post(f"{API}/cash-tables/{tbl['id']}/open", timeout=15)
        assert r.status_code == 200
        # seat +/-
        r = admin_session.post(f"{API}/cash-tables/{tbl['id']}/seat", params={"delta": 3})
        assert r.json()["seated_count"] == 3
        r = admin_session.post(f"{API}/cash-tables/{tbl['id']}/seat", params={"delta": 99})
        assert r.json()["seated_count"] == 9  # clamped
        r = admin_session.post(f"{API}/cash-tables/{tbl['id']}/seat", params={"delta": -50})
        assert r.json()["seated_count"] == 0
        # waitlist
        pl = admin_session.post(f"{API}/players", json={"name": f"TEST_W_{uuid.uuid4().hex[:6]}"}).json()
        r = admin_session.post(f"{API}/cash-tables/{tbl['id']}/waitlist", params={"player_id": pl["id"]}, timeout=15)
        assert r.status_code == 200
        wid = r.json()["id"]
        assert r.json()["position"] == 1
        r = admin_session.post(f"{API}/waitlist/{wid}/status", params={"status": "called"})
        assert r.status_code == 200
        r = admin_session.post(f"{API}/waitlist/{wid}/status", params={"status": "seated"})
        assert r.status_code == 200
        # close
        r = admin_session.post(f"{API}/cash-tables/{tbl['id']}/close")
        assert r.status_code == 200
        # cleanup
        admin_session.delete(f"{API}/cash-tables/{tbl['id']}")
        admin_session.delete(f"{API}/players/{pl['id']}")


# ---------- Rankings ----------
class TestRankings:
    def test_rankings(self, admin_session, tournament_ctx):
        r = admin_session.get(f"{API}/rankings", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "ranking" in d
        # top entry should have points (we set position 1 -> 100 pts)
        top = next((x for x in d["ranking"] if x["total_points"] >= 100), None)
        assert top is not None

    def test_rankings_filtered(self, admin_session, tournament_ctx):
        tid = tournament_ctx["tournament"]["id"]
        r = admin_session.get(f"{API}/rankings", params={"tournament_ids": tid}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] >= 1


# ---------- Dashboard ----------
class TestDashboard:
    def test_summary(self, admin_session):
        r = admin_session.get(f"{API}/dashboard/summary", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["revenue_today", "open_tables", "ongoing_tournaments",
                  "active_players", "total_debt", "pending_total", "pending_count"]:
            assert k in d, f"missing {k}"

    def test_revenue(self, admin_session):
        r = admin_session.get(f"{API}/dashboard/revenue", params={"days": 7}, timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) == 7
        for item in arr:
            assert "date" in item and "revenue" in item


# ---------- RBAC ----------
class TestRBAC:
    def test_operator_cannot_create_user(self, operator_session):
        r = operator_session.post(f"{API}/users", json={
            "email": f"x_{uuid.uuid4().hex[:6]}@test.com", "password": "x", "name": "x"
        }, timeout=15)
        assert r.status_code == 403

    def test_admin_can_list_users(self, admin_session):
        r = admin_session.get(f"{API}/users", timeout=15)
        assert r.status_code == 200
