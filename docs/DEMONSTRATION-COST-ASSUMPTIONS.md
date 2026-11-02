# Demonstration cost assumptions

Configured on 2 November 2026 in the separate Simulator's editable operations settings. These are transparent internship demonstration assumptions, not market quotations, approved factory accounts or a claim about a particular manufactured part.

## Rejected part: ₹65 per part

- Example material mass: 0.5 kg per part.
- Assumed material value: ₹100/kg → ₹50 material per part.
- Assumed incremental processing already consumed: ₹20 per rejected part.
- Assumed scrap recovery: ₹5 per rejected part.
- Net estimated loss: **₹50 + ₹20 − ₹5 = ₹65 per rejected part**.

This assumes the entire part is rejected, with no rework option. Change the rate for another part family, material, salvage value or rework process. A common rate across 40 demonstration machines is not a validated factory costing model.

## Stopped production: ₹1,200 per hour

- Planned output: 120 parts / 12 hours = **10 parts/hour**.
- Assumed contribution margin: **₹120 per part**, after variable production costs; this is not sales price.
- Estimated opportunity loss: **10 × ₹120 = ₹1,200 per stopped hour = ₹20/minute**.

This assumes stopped capacity cannot be recovered later and demand exists for the output. It does not add salaries, fixed overhead, maintenance repair costs or gross revenue again. A physical plant may recover lost output later; this simplified model does not establish actual lost profit.

## Dashboard calculation

The financial cards use the saved model observation window and **current** rate for each selected machine:

- Scrap exposure = window rejected count × current INR/part.
- Downtime exposure = (observed planned seconds − running seconds) / 3,600 × current INR/hour.
- Example: four rejected parts → **₹260**; 30 stopped minutes → **₹600**.

Latest counter snapshots are deduplicated. Values from repeated polls are never added as new production. Fleet totals sum per-machine exposures; they do not multiply a fleet count by the number of sensors. Mixed or missing required inputs remain unavailable, with coverage shown.

The Simulator separately retains prospectively accumulated `Model Scrap Cost` and `Model Downtime Loss` streams. Those include activity only while a positive rate was configured. They are different from the dashboard's current-rate exposure, which can reprice the existing observation window. Neither is a posted accounting ledger.

The UI shows the example formulas when all selected machines publish ₹65/part and ₹1,200/hour. Other configured rates remain visible in the per-machine assumptions table. Change them in Simulator → Dashboard → **Dashboard data model · energy and cost assumptions**. No secrets, accounts, raw history or production counters are changed by saving rates.
