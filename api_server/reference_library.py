"""Curated public references, reviewed manually; never site approval or live retrieval."""
REFERENCES = (
    {'id':'osha-energy', 'kind':'Safety reference', 'title':'Hazardous-energy control overview',
     'url':'https://www.osha.gov/control-hazardous-energy/',
     'publisher':'US Occupational Safety and Health Administration',
     'summary':'Background on hazardous energy and the need for trained personnel and applicable energy-control procedures.',
     'applicability':'General educational reference. US guidance does not establish local legal compliance or a machine-specific isolation sequence.'},
    {'id':'haas-manuals', 'kind':'Manufacturer manual directory', 'title':'Haas operator and service manuals',
     'url':'https://haascnc.com/owners/Service/operators-manual.html', 'publisher':'Haas Automation',
     'summary':'Manufacturer directory for selecting the correct machine family, control generation and manual revision.',
     'applicability':'Haas equipment only after exact model/options/revision verification by the site owner. Does not apply to Mazak, DMG MORI or other manufacturers.'},
    {'id':'cwru-bearings', 'kind':'Measured research dataset', 'title':'CWRU Bearing Data Center',
     'url':'https://engineering.case.edu/bearingdatacenter/download-data-file',
     'publisher':'Case Western Reserve University',
     'summary':'Measured acceleration and motor-speed records from a controlled bearing rig with normal and deliberately introduced defects.',
     'applicability':'Bearing-diagnostics research. Not field failure forecasts, not the same equipment or feature contract as FactoryPulse. Never randomly split neighboring windows from one recording across train/test.'},
    {'id':'uci-ai4i', 'kind':'Synthetic practice dataset', 'title':'AI4I 2020 Predictive Maintenance',
     'url':'https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset',
     'publisher':'UCI Machine Learning Repository',
     'summary':'Small 10,000-row synthetic benchmark already used by the separate local practice workflow.',
     'applicability':'Current-row failure classification practice, not independently labeled real-machine validation or future-warning severity labels.'},
)

def public_references():
    return {'reviewed_on':'2026-11-23', 'runtime_web_access':False,
            'site_approval':False, 'items':[dict(item) for item in REFERENCES],
            'notice':'Curated source links and brief summaries. No source is automatically approved, downloaded, or applied to equipment; website availability can change.'}
