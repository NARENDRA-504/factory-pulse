# Public references added 23 November 2026

The Admin review screen's recovery/validation evidence section includes a curated source library. Four sources were checked online:

- OSHA hazardous-energy overview: https://www.osha.gov/control-hazardous-energy/
- Haas official manual directory: https://haascnc.com/owners/Service/operators-manual.html
- CWRU bearing data: https://engineering.case.edu/bearingdatacenter/download-data-file
- UCI AI4I practice data: https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset

The chatbot retrieves brief original summaries from `knowledge/assistant/public-references.md`, with explicit limitations and citations in each passage. Runtime questions do not browse websites or import arbitrary web instructions. The reviewed file is allowlisted; the local embedding index was rebuilt offline from cached weights. No credentials or personnel records were indexed.

OSHA provides general US hazardous-energy guidance, not local legal approval. Haas manuals require exact equipment/control/options/revision verification and do not apply to other manufacturers. No public link changes a training draft into an approved SOP; no repair or isolation sequence is invented.

CWRU is a useful next **separate** measured bearing-diagnostics study: normal/faulted bearings on a controlled motor rig with deliberately introduced defects. Acceleration cannot be silently substituted for velocity in mm/s. Use complete recordings and experimental conditions as split groups; random neighboring-window splits leak information. It does not provide the current seven-sensor model's full inputs or independent FactoryPulse site validation. Large dataset files were not downloaded, saving disk space. No new CWRU training results are claimed.

AI4I remains the small synthetic benchmark already trained locally. Neither reference collection nor vector rebuilding activates model alerts or changes the Simulator → MySQL pipeline.
