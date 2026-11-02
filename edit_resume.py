from docx import Document
from docx.shared import Inches, Pt
src=r'C:\Downloads\Vadde_Narendra_Data_Analyst_Resume.docx'
out=r'C:\Users\NARENDRA\OneDrive\Documents\ChatGPT\factory pulse 2\Vadde_Narendra_Updated_Resume.docx'
d=Document(src)
p=d.paragraphs
changes={5:'Data analyst with a Computer Science and Engineering background and hands-on experience in data cleaning, validation, analysis, and visualization using Python, SQL, Excel, Power BI, and Tableau. Led a field team and delivered audited data across multiple project sites.', 12:'Power BI, Tableau, Excel (Pivot Tables, VLOOKUP, advanced formulas), exploratory and statistical analysis, reporting', 13:'MongoDB, Git, GitHub, VS Code, Jupyter Notebook, REST APIs', 14:'Data cleaning and validation, dashboards, data storytelling, quality assurance, stakeholder collaboration; Generative AI and prompting (no-code)', 17:'Collected and validated GPS field data; performed Excel quality checks that reduced error rates by approximately 15%.', 18:'Analyzed field records across 10+ project sites to identify trends and resolve data discrepancies.', 19:'Led a 3-member field team, coordinated daily deliverables, and resolved data-quality issues.', 20:'Maintained operational reports and collaborated across teams to meet project deadlines.', 23:'Cleaned, validated, and engineered features for agricultural datasets using Python, Pandas, and NumPy.', 24:'Created Matplotlib and Seaborn visualizations to communicate statistical insights.', 26:'Built and queried a MongoDB data layer with REST APIs and CRUD operations.', 27:'Analyzed application logs using Python and SQL to debug and validate system behavior.'}
for i,t in changes.items():
    para=p[i]
    if i in (12,13,14):
        for r in para.runs[1:]: r.text=''
        para.runs[1].text=t
    else:
        para.runs[0].text=t
        for r in para.runs[1:]: r.text=''
for i in [6,7,8,9]:
    el=p[i]._element; el.getparent().remove(el)
for s in d.sections:
    s.top_margin=Inches(.45); s.bottom_margin=Inches(.45)
    s.left_margin=Inches(.6); s.right_margin=Inches(.6)
for para in d.paragraphs:
    para.paragraph_format.space_before=Pt(0)
    para.paragraph_format.space_after=Pt(2)
    para.paragraph_format.line_spacing=1.0
    for r in para.runs:
        if r.font.size and r.font.size.pt > 11 and para != d.paragraphs[0]: r.font.size=Pt(10)
d.save(out)
