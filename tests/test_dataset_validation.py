"""Computed fixture tests; actual-source execution is separate evidence."""
import tempfile,unittest
from pathlib import Path
import pandas as pd
from scripts.phase1_evidence import numeric_summary,quality_summary,research_sources,live_statistics
from scripts.validate_and_import_datasets import run_validation_pipeline

class TestDatasetEngineering(unittest.TestCase):
    def test_missing_sources_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertFalse(run_validation_pipeline(folder)['audit_passed'])
    def test_statistics_invalid_and_sample_deviation(self):
        row=numeric_summary(pd.DataFrame({'x':[1,2,3,'bad',None]}),['x']).iloc[0]
        self.assertEqual(row['count'],3);self.assertEqual(row['missing_or_invalid'],2)
        self.assertEqual(row['mean'],2);self.assertEqual(row['std_sample'],1)
    def test_duplicates_retained(self):
        frame=pd.DataFrame({'x':[1,1,None],'_source_file':['a','b','b']})
        row=quality_summary({'test':frame}).iloc[0]
        self.assertEqual(row['rows'],3);self.assertEqual(row['duplicate_value_rows'],1)
        self.assertEqual(row['missing_cells'],1);self.assertEqual(len(frame),3)
    def test_decimal_comma_and_header(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'FeatureAndMetadata_Milling/FeatureAndMetadata_Milling.csv'
            path.parent.mkdir();path.write_text('Column1;Column2\nCycleToFailure;CycleToFailureNormalized\n48;0,97959\n')
            frames,_=research_sources(folder)
            self.assertAlmostEqual(frames['milling_life'].iloc[0].CycleToFailureNormalized,.97959)
    def test_units_and_quality_separate(self):
        rows=pd.DataFrame({'sensor_name':['Pressure']*4,'sensor_unit':['bar','bar','psi','bar'],'numeric_value':[2,4,30,999],'valid_numeric':[True,True,True,False]})
        result=live_statistics(rows).set_index('sensor_unit')
        self.assertEqual(result.loc['bar','mean'],3);self.assertEqual(result.loc['psi','mean'],30)

if __name__=='__main__':unittest.main()
