import io,json,sys,unittest
from pathlib import Path
from datetime import datetime,timezone
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import update_health as h

FIX=Path(__file__).parent/'fixtures'
NOW=datetime(2026,10,19,18,tzinfo=timezone.utc)

class HealthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.counties=json.loads((h.ROOT/'data/us-counties.json').read_text())['counties']
        cls.pages=json.loads((FIX/'florida-week40-2026.json').read_text())
        cls.fl=h.parse_florida(cls.pages,'https://www.floridahealth.gov/report.pdf',cls.counties,NOW)

    def test_source_date(self):
        self.assertEqual(self.fl['dataAsOf'],'2026-10-10')
        self.assertNotEqual(self.fl['dataAsOf'],NOW.date().isoformat())

    def test_official_status_lists_do_not_bleed(self):
        records=self.fl['records'];advisories={r['countyFips'] for r in records if r['advisoryStatus']=='advisory'}
        alerts={r['countyFips'] for r in records if r['advisoryStatus']=='alert'}
        self.assertEqual(len(advisories),10);self.assertEqual(len(alerts),7)
        self.assertIn('12073',advisories);self.assertNotIn('12073',alerts)
        self.assertIn('12095',alerts);self.assertFalse(advisories&alerts)
        self.assertNotIn('12069',advisories|alerts)

    def test_travel_and_local_are_distinct(self):
        lake=[r for r in self.fl['records'] if r['countyFips']=='12069']
        self.assertEqual([(r['disease'],r['acquisition']) for r in lake],[('Dengue','Travel-associated')])
        orange=[r for r in self.fl['records'] if r['countyFips']=='12095' and r['disease']=='Dengue']
        self.assertEqual({r['acquisition'] for r in orange},{'Travel-associated','Locally acquired'})

    def test_sentinel_is_not_human(self):
        rows=[r for r in self.fl['records'] if r['countyFips']=='12095' and r['disease']=='West Nile virus']
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['evidence'],'Sentinel chickens')

    def test_confirmation_not_invented(self):
        self.assertTrue(all(r['classification'].startswith('Confirmed and probable combined') for r in self.fl['records'] if r['evidence']=='Human cases'))

    def test_unknown_pdf_format_rejected(self):
        with self.assertRaises(ValueError):h.parse_florida(['Unreadable PDF'],'https://www.floridahealth.gov/report.pdf',self.counties,NOW)

    def test_future_report_rejected(self):
        with self.assertRaises(ValueError):h.parse_florida(self.pages,'url',self.counties,datetime(2026,10,1,tzinfo=timezone.utc))

    def test_cdc_suppression_and_dates(self):
        d=h.parse_dengue((FIX/'cdc-dengue-2026.csv').read_text(encoding='utf-8-sig'),{'Last-Modified':'Wed, 14 Oct 2026 15:06:54 GMT'},NOW)
        self.assertIsNone(d['dataAsOf']);self.assertEqual(d['sourceModifiedAt'],'2026-10-14T15:06:54+00:00')
        self.assertTrue(any('1 to 4 reported' in r['summary'] for r in d['records']))
        self.assertTrue(all(r['acquisition']!='All' for r in d['records']))

    def test_historical_csv_rejected(self):
        with self.assertRaises(ValueError):h.parse_dengue('Year,Travel status,County,Count\n2025,Locally acquired,12095,1\n',{},NOW)

    def test_invalid_csv_rejected(self):
        for data in ['bad,csv\n', 'Year,Travel status,County,Count\n2026,Locally acquired,12095,Unknown\n']:
            with self.assertRaises(ValueError):h.parse_dengue(data,{},NOW)

    def test_current_link_discovered_not_hardcoded(self):
        html='<a href="/wp-content/uploads/2026/10/fl-arbovirus-report-w39-2026.pdf">Old</a><a href="/wp-content/uploads/2026/10/fl-arbovirus-report-w40-2026.pdf">New</a>'
        self.assertTrue(h.latest_report(html).endswith('w40-2026.pdf'))

    def test_bordering_counties(self):
        self.assertIn('12095',self.counties['12069']['neighbors'])
        self.assertNotIn('12086',self.counties['12069']['neighbors'])

if __name__=='__main__':unittest.main()
