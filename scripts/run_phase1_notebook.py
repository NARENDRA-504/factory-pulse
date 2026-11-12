"""Execute and save the real notebook with this project's Python kernel."""
import os,sys
from pathlib import Path
import nbformat
from nbclient import NotebookClient
from jupyter_client import KernelManager
from jupyter_client.kernelspec import KernelSpec
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'notebooks/eda_manufacturing_datasets.ipynb'
nb=nbformat.read(path,as_version=4)
km=KernelManager(kernel_name='python3')
km._kernel_spec=KernelSpec(argv=[sys.executable,'-m','ipykernel_launcher','-f','{connection_file}'],display_name='FactoryPulse Python',language='python')
client=NotebookClient(nb,timeout=180,resources={'metadata':{'path':str(ROOT)}},km=km)
try:
    client.execute(cwd=str(ROOT))
finally:
    nbformat.write(nb,path)
print('Notebook executed:',sum(c.cell_type=='code' and c.execution_count is not None for c in nb.cells),'code cells; saved real outputs.')
