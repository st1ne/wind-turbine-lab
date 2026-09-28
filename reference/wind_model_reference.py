"""
Wind Turbine Lab - physics reference model (source of truth for the TypeScript port).

Run:   python3 wind_model_reference.py            (needs numpy; ~30 s, builds the Cp/Ct tables once)
Output: reference numbers + test vectors quoted in TECH_SPEC.md, and tables.json.

Model: NREL 5 MW class rotor (Jonkman et al. 2009, NREL/TP-500-38060),
       simplified airfoil polars (linear lift + Viterna post-stall),
       steady BEM with Prandtl tip/hub loss and Buhl high-induction correction,
       NREL baseline torque law (regions 2 / 2.5 / 3) + gain-scheduled PI pitch control,
       supervisory state machine (RUN / SHUTDOWN / PARKED / STARTUP / TRIP).
"""
import math, json, os
import numpy as np

# ---------------------------------------------------------------- constants
RHO = 1.225            # air density, kg/m^3
R = 63.0               # rotor radius, m
R_HUB = 1.5            # hub radius, m
B = 3                  # blades
A = math.pi * R * R    # swept area, m^2 (12,469 m^2)
ETA = 0.944            # generator + converter efficiency
P_RATED = 5.0e6        # rated electrical power, W
N_GEAR = 97.0          # gearbox ratio
W_RATED = 12.1 * math.pi / 30          # rated rotor speed, rad/s
W_GEN_RATED = W_RATED * N_GEAR         # rated generator speed, rad/s (1173.7 rpm)
J = 43.784e6           # drivetrain inertia referred to the rotor shaft, kg m^2
V_CUT_IN, V_CUT_OUT, V_RESTART = 3.0, 25.0, 20.0
BETZ = 16.0 / 27.0

# NREL 5 MW blade stations: radius, element length, twist (deg), chord (m), airfoil family
r  = [2.8667,5.6,8.3333,11.75,15.85,19.95,24.05,28.15,32.25,36.35,40.45,44.55,48.65,52.75,56.1667,58.9,61.6333]
dr = [2.7333]*3 + [4.1]*11 + [2.7333]*3
tw = [13.308,13.308,13.308,13.308,11.480,10.162,9.011,7.795,6.544,5.361,4.188,3.125,2.319,1.526,0.863,0.370,0.106]
ch = [3.542,3.854,4.167,4.557,4.652,4.458,4.249,4.007,3.748,3.502,3.256,3.010,2.764,2.518,2.313,2.086,1.419]
af = ['CYL1','CYL1','CYL2','DU40','DU35','DU35','DU30','DU25','DU25','DU21','DU21','NACA64','NACA64','NACA64','NACA64','NACA64','NACA64']

# Simplified polars: (cl0, lift slope per deg, positive stall angle deg, cd0, drag growth k)
POLARS = {
    'DU40':   (0.20, 0.090, 11.0, 0.030, 0.020),
    'DU35':   (0.25, 0.095, 11.0, 0.018, 0.015),
    'DU30':   (0.30, 0.100, 10.5, 0.012, 0.012),
    'DU25':   (0.45, 0.105, 10.0, 0.009, 0.010),
    'DU21':   (0.45, 0.105, 10.0, 0.008, 0.010),
    'NACA64': (0.50, 0.108, 10.0, 0.006, 0.008),
}
CD90 = 1.8             # flat-plate drag at 90 deg

def polar(fam, al):
    """Lift/drag coefficients for angle of attack al (deg)."""
    if fam == 'CYL1': return 0.0, 0.50
    if fam == 'CYL2': return 0.0, 0.35
    cl0, s, ast, cd0, kd = POLARS[fam]
    attached = lambda a: (cl0 + s * a, cd0 + kd * (a / 10.0) ** 2)
    neg_stall = -(ast + 4.0)                       # negative-side stall angle
    if neg_stall <= al <= ast:
        return attached(al)
    sgn = 1.0 if al > ast else -1.0
    a_s = ast if sgn > 0 else neg_stall
    cls, cds = attached(a_s)
    asr = math.radians(abs(a_s))
    A1, B1 = CD90 / 2, CD90                        # Viterna-Corrigan coefficients
    A2 = (abs(cls) - CD90 * math.sin(asr) * math.cos(asr)) * math.sin(asr) / math.cos(asr) ** 2
    B2 = (cds - CD90 * math.sin(asr) ** 2) / math.cos(asr)
    a = min(math.radians(abs(al)), math.pi / 2)
    cl = A1 * math.sin(2 * a) + A2 * math.cos(a) ** 2 / max(math.sin(a), 1e-3)
    cd = B1 * math.sin(a) ** 2 + B2 * math.cos(a)
    if abs(al) > 90:                               # beyond 90 deg: flat plate
        a = math.radians(abs(al)); cl = -CD90 / 2 * math.sin(2 * a); cd = CD90 * math.sin(a) ** 2
    return sgn * cl, max(cd, cd0)

def prandtl(ri, phi):
    sp = max(abs(math.sin(phi)), 1e-6)
    ft = B * (R - ri) / (2 * ri * sp)
    fh = B * (ri - R_HUB) / (2 * R_HUB * sp)
    F = (2 / math.pi) ** 2 * math.acos(min(1.0, math.exp(-ft))) * math.acos(min(1.0, math.exp(-fh)))
    return max(F, 1e-4)

def section(V, om, beta, i, iters=200):
    """Steady BEM for one blade element. Fixed-point iteration with 0.3 relaxation."""
    ri, c = r[i], ch[i]
    th = math.radians(tw[i] + beta)
    sig = B * c / (2 * math.pi * ri)
    a, ap = 0.3, 0.0
    for _ in range(iters):
        phi = math.atan2(V * (1 - a), om * ri * (1 + ap))
        cl, cd = polar(af[i], math.degrees(phi - th))
        cn = cl * math.cos(phi) + cd * math.sin(phi)
        ct = cl * math.sin(phi) - cd * math.cos(phi)
        F = prandtl(ri, phi)
        sphi, cphi = math.sin(phi), math.cos(phi)
        if abs(sphi) < 1e-4: break
        CT = sig * (1 - a) ** 2 * cn / sphi ** 2
        if CT <= 0.96 * F:
            an = 1.0 / (1.0 + 4 * F * sphi ** 2 / (sig * cn)) if cn != 0 else 0.0
        else:  # Buhl (2005) high-induction correction
            an = (18 * F - 20 - 3 * math.sqrt(max(CT * (50 - 36 * F) + 12 * F * (3 * F - 4), 0))) / (36 * F - 50)
        apn = 1.0 / (4 * F * sphi * cphi / (sig * ct) - 1) if abs(ct) > 1e-9 and abs(cphi) > 1e-6 else 0.0
        an = max(min(an, 0.95), -0.5); apn = max(min(apn, 1.0), -0.5)
        if abs(an - a) < 1e-6 and abs(apn - ap) < 1e-6:
            a, ap = an, apn; break
        a = 0.7 * a + 0.3 * an; ap = 0.7 * ap + 0.3 * apn
    Vax, Vt = V * (1 - a), om * ri * (1 + ap)
    phi = math.atan2(Vax, Vt)
    al = math.degrees(phi - th)
    cl, cd = polar(af[i], al)
    cn = cl * math.cos(phi) + cd * math.sin(phi); ct = cl * math.sin(phi) - cd * math.cos(phi)
    q = 0.5 * RHO * (Vax * Vax + Vt * Vt) * c
    return dict(dT=q * cn, dQ=q * ct * ri, alpha=al, a=a, ap=ap, cl=cl, cd=cd)

def rotor(V, om, beta):
    T = Q = 0.0
    for i in range(17):
        s = section(V, om, beta, i)
        T += B * s['dT'] * dr[i]; Q += B * s['dQ'] * dr[i]
    return Q * om / (0.5 * RHO * A * V ** 3), T / (0.5 * RHO * A * V ** 2), T, Q

def bisect(f, lo, hi, n=60):
    flo = f(lo)
    for _ in range(n):
        mid = 0.5 * (lo + hi); fm = f(mid)
        if (fm > 0) == (flo > 0): lo, flo = mid, fm
        else: hi = mid
    return 0.5 * (lo + hi)

# ---------------------------------------------------------------- optimum + steady schedule
lams = np.arange(4, 12.001, 0.05)
cps = [rotor(10.0, l * 10.0 / R, 0)[0] for l in lams]
k = int(np.argmax(cps)); LOPT, CPMAX = float(lams[k]), float(cps[k])
K_OPT = 0.5 * RHO * math.pi * R ** 5 * CPMAX / LOPT ** 3      # N m s^2 on the rotor shaft
om_of = lambda V: min(LOPT * V / R, W_RATED)
p_el = lambda V, om, b: ETA * rotor(V, om, b)[0] * 0.5 * RHO * A * V ** 3
V_RATED = bisect(lambda V: p_el(V, om_of(V), 0) - P_RATED, W_RATED * R / LOPT, 16)

schedule = []
for V in [3, 4, 5, 6, 7, 8, 9, 10, 11, round(V_RATED, 2), 12, 13, 14, 15, 16, 18, 20, 22, 24, 25]:
    om = om_of(V)
    b = 0.0 if V <= V_RATED + 1e-6 else bisect(lambda b: p_el(V, om, b) - P_RATED, 0, 40)
    cp, ct, T, Q = rotor(V, om, b)
    schedule.append(dict(V=V, rpm=round(om * 30 / math.pi, 2), pitch=round(b, 2), tsr=round(om * R / V, 2),
                         cp=round(cp, 4), ct=round(ct, 4), P_MW=round(ETA * cp * 0.5 * RHO * A * V ** 3 / 1e6, 3),
                         Q_MNm=round(Q / 1e6, 3), T_kN=round(T / 1e3, 1)))

# ---------------------------------------------------------------- Cp/Ct tables
LAM = [round(0.25 * i, 2) for i in range(81)]          # 0 .. 20
BET = [float(b) for b in range(-2, 91)]                # -2 .. 90 deg
if os.path.exists('tables.json'):
    tbl = json.load(open('tables.json')); CP, CT = np.array(tbl['cp']), np.array(tbl['ct'])
else:
    CP = np.zeros((len(LAM), len(BET))); CT = np.zeros_like(CP)
    for i, l in enumerate(LAM):
        for j, b in enumerate(BET):
            CP[i, j], CT[i, j], _, _ = rotor(10.0, max(l, 0.01) * 10.0 / R, b)
    json.dump(dict(lambda_=LAM, beta=BET, cp=np.round(CP, 5).tolist(), ct=np.round(CT, 5).tolist()), open('tables.json', 'w'))

def lookup(T, lam, b):
    x = min(max(lam / 0.25, 0), len(LAM) - 1.001); y = min(max(b + 2, 0), len(BET) - 1.001)
    i, j = int(x), int(y); fx, fy = x - i, y - j
    return (T[i, j] * (1 - fx) * (1 - fy) + T[i + 1, j] * fx * (1 - fy)
            + T[i, j + 1] * (1 - fx) * fy + T[i + 1, j + 1] * fx * fy)

# ---------------------------------------------------------------- controller (NREL baseline, simplified)
K_HSS = K_OPT / N_GEAR ** 3                  # N m / (rad/s)^2 on the generator shaft
VS_RT = 0.99 * W_GEN_RATED                   # torque-controller rated speed
VS_SY = VS_RT / 1.10                         # synchronous speed for the region 2.5 line (10 % slip)
SLOPE25 = (P_RATED / ETA / VS_RT) / (VS_RT - VS_SY)
VS_TR = (SLOPE25 - math.sqrt(SLOPE25 ** 2 - 4 * K_HSS * SLOPE25 * VS_SY)) / (2 * K_HSS)
KP0, KI0, GK = 0.01882681, 0.008068634, 6.302336   # PI gains at 0 deg (s, -), gain-schedule knee (deg)
PITCH_RATE = {'RUN': 8.0, 'TRIP': 8.0, 'SHUTDOWN': 4.0, 'PARKED': 4.0, 'STARTUP': 2.0}
Q_BRAKE = 28116.2 * N_GEAR                   # HSS brake torque referred to the rotor shaft, N m

def sched_at(V):
    pts = [(s['V'], s['rpm'], s['pitch']) for s in schedule]
    if V <= pts[0][0]: return pts[0][1], pts[0][2]
    for (v0, r0, b0), (v1, r1, b1) in zip(pts, pts[1:]):
        if V <= v1:
            f = (V - v0) / (v1 - v0); return r0 + f * (r1 - r0), b0 + f * (b1 - b0)
    return pts[-1][1], pts[-1][2]

def simulate(Vfun, t_end, dt=0.02, pitch_lock=None, log_every=5.0):
    rpm0, beta = sched_at(Vfun(0)); om = rpm0 * math.pi / 30
    integ = math.radians(beta) / (KI0 / (1 + beta / GK)); state = 'RUN'; t = 0.0; next_log = 0.0; log = []
    while t <= t_end + 1e-9:
        V = Vfun(t); lam = om * R / max(V, 0.1)
        Q_aero = lookup(CP, lam, beta) * 0.5 * RHO * A * V ** 3 / max(om, 1e-3)
        T = lookup(CT, lam, beta) * 0.5 * RHO * A * V ** 2
        wg = om * N_GEAR
        # supervisory logic (TRIP is latched; the UI must offer a Reset)
        if state == 'TRIP' and om < 0.01: state = 'TRIPPED'
        if state == 'RUN' and V >= V_CUT_OUT: state = 'SHUTDOWN'
        if state == 'RUN' and om > 1.15 * W_RATED: state = 'TRIP'
        if state in ('SHUTDOWN', 'PARKED') and V < V_RESTART: state = 'STARTUP'
        if state == 'STARTUP' and om >= 0.9 * W_RATED:
            state = 'RUN'; integ = math.radians(beta) / (KI0 / (1 + beta / GK))
        # generator torque on the HSS
        Qg = 0.0
        if state == 'RUN' and wg > 0.01:
            if beta >= 1.0 or wg >= VS_RT: Qg = P_RATED / ETA / wg        # region 3
            elif wg >= VS_TR:              Qg = SLOPE25 * (wg - VS_SY)     # region 2.5
            else:                          Qg = K_HSS * wg * wg            # region 2
        # pitch command
        if state == 'RUN' and pitch_lock is None:
            gk = 1.0 / (1.0 + beta / GK); err = wg - W_GEN_RATED
            integ = min(max(integ + err * dt, 0.0), math.radians(90) / (KI0 * gk))
            cmd = min(max(math.degrees(gk * (KP0 * err + KI0 * integ)), 0.0), 90.0)
        elif state == 'RUN': cmd = pitch_lock
        elif state == 'STARTUP': cmd = sched_at(V)[1]
        else: cmd = 90.0
        rate = PITCH_RATE.get(state, 8.0)
        beta += max(-rate * dt, min(rate * dt, cmd - beta))
        brake = state in ('TRIP', 'TRIPPED') or (state in ('SHUTDOWN', 'PARKED') and om < 0.3 * W_RATED)
        if state == 'SHUTDOWN' and om < 0.01: state = 'PARKED'
        om = max(om + (Q_aero - Qg * N_GEAR - (Q_BRAKE if brake and om > 0 else 0)) / J * dt, 0.0)
        if t >= next_log - 1e-9:
            log.append(dict(t=round(t, 1), V=round(V, 1), rpm=round(om * 30 / math.pi, 2), pitch=round(beta, 2),
                            P_MW=round(ETA * Qg * wg / 1e6, 2), T_kN=round(T / 1e3), state=state))
            next_log += log_every
        t += dt
    return log

# ---------------------------------------------------------------- report
if __name__ == '__main__':
    print(f"Cp_max {CPMAX:.4f} at TSR {LOPT:.2f} ({CPMAX / BETZ * 100:.1f} % of Betz)")
    print(f"K_opt {K_OPT:.4e} N m s^2 (rotor shaft) = {K_HSS * (math.pi / 30) ** 2:.5f} N m/rpm^2 (generator)")
    print(f"V_rated {V_RATED:.2f} m/s ; region 2.5 from {VS_TR * 30 / math.pi:.1f} gen rpm")
    print("\n   V   rpm  pitch   TSR    Cp     Ct    P_MW  Q_MNm   T_kN")
    for s in schedule:
        print(f"{s['V']:5.2f} {s['rpm']:5.2f} {s['pitch']:6.2f} {s['tsr']:5.2f} {s['cp']:.3f} {s['ct']:.3f} {s['P_MW']:6.2f} {s['Q_MNm']:6.2f} {s['T_kN']:6.0f}")
    print("\nTest vectors  rotor(V=10, TSR, pitch) -> Cp, Ct")
    for lam, b in [(4, 0), (7.65, 0), (10, 0), (6, 5), (5, 15), (4, 25), (3, 35), (7, 90)]:
        cp, ct, _, _ = rotor(10.0, lam * 10.0 / R, b)
        print(f"  TSR {lam:5.2f} pitch {b:3d}: Cp {cp:+.4f}  Ct {ct:+.4f}")
    print("\nSpanwise alpha (deg), stations 4..17")
    for V, b in [(8, 0), (V_RATED, 0), (20, sched_at(20)[1])]:
        row = [section(V, om_of(V), b, i)['alpha'] for i in range(3, 17)]
        print(f"  V {V:5.2f} pitch {b:5.2f}: " + " ".join(f"{x:5.1f}" for x in row))
    print("\nStorm ramp 12 -> 30 m/s (t 20..80 s), hold, drop to 15 m/s at t=180 s")
    ramp = lambda t: 12 if t < 20 else (12 + (t - 20) * 0.3 if t < 80 else (30 if t < 180 else 15))
    for row in simulate(ramp, 260, log_every=10): print(" ", row)
    print("\nPitch locked at 0 deg, gust 12 -> 22 m/s at t=10 s (overspeed trip)")
    for row in simulate(lambda t: 12 if t < 10 else 22, 26, pitch_lock=0.0, log_every=2): print(" ", row)
