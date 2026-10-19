# Comparative Cost-Benefit Analysis & ROI Model
## All-BLE vs Passive UHF RFID Gates vs Hybrid BLE/RFID Architecture

---

## 1. Architecture Comparison Matrix

| Parameter | Architecture A: All-BLE | Architecture B: All-Passive RFID Gates | Architecture C: Hybrid BLE + QR + RFID Gates (Recommended) |
| :--- | :--- | :--- | :--- |
| **Physical Tracking Resolution** | Continuous Zone (~15m) | Discrete Portal Entry/Exit only | **Multi-Tier: Rack-Shelf (99%), Machine (92%), Zone (80%)** |
| **Search Assistance on Floor** | Real-time buzzer/LED beacon | None (requires handheld wand search) | **Interactive Buzzer + LED Beacon + Visual Map** |
| **Metal-Environment Immunity** | Moderate (multipath mitigated by Kalman) | High at portals, poor in open bays | **High (deterministic QR at racks + Kalman on BLE)** |
| **Tag Unit Cost** | ₹ 450 – ₹ 600 / tag | ₹ 15 – ₹ 25 / tag | **₹ 480 / tag (reused over 40+ cycles)** |
| **Fixed Infrastructure Cost** | Low (12 PoE Gateways) | Very High (24 Portal Gates with Antennas) | **Low-to-Medium (12 Gateways + 2 RFID Gates)** |
| **Estimated Payback Period** | 6.8 months | 14.2 months | **4.6 months** |

---

## 2. Five-Year Total Cost of Ownership (TCO) for Shop-5 (~3,000 WIP)

| Expense Item | Architecture A (All-BLE) | Architecture B (Passive RFID) | Architecture C (Hybrid - Proposed) |
| :--- | :---: | :---: | :---: |
| **Tag Capital Expense (3,000 Units)** | ₹ 15,00,000 | ₹ 75,000 | ₹ 14,40,000 |
| **Reader Gateways & Portals** | ₹ 3,60,000 (12 GW) | ₹ 28,80,000 (12 Portals) | ₹ 7,60,000 (12 GW + 2 Portals) |
| **Server, Network PoE & Installation** | ₹ 4,50,000 | ₹ 8,50,000 | ₹ 5,20,000 |
| **Software Platform & License (Year 1)** | ₹ 6,00,000 | ₹ 6,00,000 | ₹ 6,00,000 |
| **Annual Maintenance & Battery Swaps** | ₹ 90,000 / yr | ₹ 45,000 / yr | ₹ 80,000 / yr |
| **Total Initial CapEx** | **₹ 29,10,000** | **₹ 44,05,000** | **₹ 33,20,000** |

---

## 3. Financial Benefits & Monthly Savings Projection

Based on INDO-MIM Shop-5 operating parameters (2 shifts/day, 111 CNC machines, average hourly shop rate of ₹ 1,800/machine hour):

1. **Operator Search Time Savings**:
   - 45 searches / shift × 18 min saved = 13.5 operator hours / shift.
   - Monthly labor savings: **₹ 1,85,000 / month**.
2. **Machine Starvation Reduction**:
   - Eliminating waiting-for-WIP starvation on 111 machines by 4.2% = 71.5 machine hours / month.
   - 71.5 hrs × ₹ 1,800/hr = **₹ 1,28,700 / month**.
3. **Elimination of Lost Workpiece Scrapping & Expedite Freight**:
   - Avoidance of 2 scrapped jobs and 1 emergency air courier: **₹ 2,40,000 / month**.
4. **Setup Changeover Grouping Savings**:
   - 34% reduction in changeovers = 95 hours machine spindle gain: **₹ 1,71,000 / month**.

### Total Gross Monthly Savings: **₹ 7,24,700 / month**

$$\text{Payback Period} = \frac{\text{Initial CapEx}}{\text{Net Monthly Savings}} = \frac{₹ 33,20,000}{₹ 7,24,700} \approx \mathbf{4.58\text{ Months}}$$

### Return on Investment (ROI over 3 Years):
$$\text{Net 3-Year Savings} = (₹ 7,24,700 \times 36) - ₹ 33,20,000 - (₹ 80,000 \times 3) \approx \mathbf{₹ 2.25\text{ Crores}}$$
$$\text{3-Year ROI} = \mathbf{645\%}$$
