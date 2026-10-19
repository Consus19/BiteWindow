"""Build public, dated surveillance snapshots. No user location or reports enter this job."""
from __future__ import annotations
import csv, hashlib, io, json, re, sys, urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
FL_INDEX = 'https://www.floridahealth.gov/statistics-data/population-surveillance/arbovirus-surveillance/'
DEN_PAGE = 'https://www.cdc.gov/dengue/data-research/facts-stats/current-data.html'
DEN_CSV = 'https://www.cdc.gov/wcms/vizdata/live/ncezid_dvbd/DEN/Cases_by_County_Current.csv'
ADJ_URL = 'https://www2.census.gov/geo/docs/reference/county_adjacency.txt'

def download(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'BiteWindow/0.8 public surveillance reader (github.com/Consus19/BiteWindow)'})
    with urllib.request.urlopen(req, timeout=40) as r:
        data = r.read(8_000_001)
        if len(data) > 8_000_000: raise ValueError('Source exceeds size limit')
        return data, r.headers

def geography(text):
    counties, parent = {}, None
    rows=list(csv.reader(io.StringIO(text), delimiter='\t'))
    for row in rows:
        if len(row)!=4:continue
        for a,b in [(0,1),(2,3)]:
            if ', ' in row[a] and re.fullmatch(r'\d{5}',row[b].strip()):
                name,state=row[a].rsplit(', ',1)
                counties.setdefault(row[b].strip(),{'name':name,'stateCode':state,'neighbors':[]})
    for row in rows:
        if len(row) != 4: continue
        if row[1].strip():
            parent = row[1].strip().zfill(5)
        neighbor = row[3].strip().zfill(5)
        if parent and re.fullmatch(r'\d{5}', neighbor) and neighbor != parent:
            counties[parent]['neighbors'].append(neighbor)
    if len(counties) < 3000: raise ValueError('Incomplete Census county reference')
    return counties

class Links(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]
    def handle_starttag(self, tag, attrs):
        if tag=='a': self.links.extend(v for k,v in attrs if k=='href' and v)

def latest_report(html):
    p=Links();p.feed(html);found=[]
    for link in p.links:
        u=urljoin(FL_INDEX,link)
        m=re.search(r'fl-arbovirus-report-w(\d{1,2})-(20\d{2})\.pdf$',urlparse(u).path,re.I)
        if m and urlparse(u).hostname=='www.floridahealth.gov': found.append((int(m[2]),int(m[1]),u))
    if not found: raise ValueError('No recognized weekly Florida report link')
    return max(found)[2]

def clean(s): return re.sub(r'\s+',' ',s).strip()
def county_ids(clause, counties):
    # Whole county names only: avoids matching Lake within Salt Lake, or Leon in De Leon.
    found=[]
    for fips,c in counties.items():
        if c['stateCode']!='FL':continue
        name=re.sub(r' County$','',c['name'])
        if re.search(r'(?<![\w-])'+re.escape(name)+r'(?![\w-])',clause):found.append(fips)
    return found

def parse_florida(pages, source_url, counties, now):
    first=clean(pages[0]); full=clean(' '.join(pages))
    m=re.search(r'Week\s+\d+:\s+([A-Za-z]+)\s+(\d{1,2})\s*[-â€“]\s*(?:([A-Za-z]+)\s+)?(\d{1,2}),\s*(20\d{2})',first)
    if not m:raise ValueError('Unrecognized Florida reporting period')
    year=int(m[5]);end=datetime.strptime(f'{m[3] or m[1]} {m[4]} {year}','%B %d %Y').date()
    if end > now.date():raise ValueError('Future Florida reporting period')
    if not re.search(r'include confirmed and probable cases',full,re.I):raise ValueError('Case-definition note changed')
    records=[]
    def emit(ids,disease,evidence,acquisition,classification,summary,status=None,period=None):
        for fips in ids:
            records.append({'id':f'fl-{fips}-{disease}-{evidence}-{acquisition}-{status}', 'countyFips':fips,
                'disease':disease,'evidence':evidence,'acquisition':acquisition,'classification':classification,
                'summary':summary,'advisoryStatus':status,'dataAsOf':end.isoformat(),
                'reportingPeriod':period or f'{year} year to date','agency':'Florida Department of Health',
                'sourceUrl':source_url,'sourceId':'fl-weekly'})
    advisory=re.search(r'Advisories/Alerts as of [^:]+:\s*(.+)',first)
    if not advisory:raise ValueError('Florida advisory section missing')
    pattern=r'(.*?) count(?:y|ies) (?:are|is) currently under a mosquito-borne illness (advisory|alert)\.'
    for a in re.finditer(pattern,advisory[1],re.I):
        status=a[2].lower()
        emit(county_ids(a[1],counties),'Mosquito-borne illness','Public-health advisory','Not specified','Official '+status,
             f'Mosquito-borne illness {status} listed in the weekly report. Status is as of the report date.',status,'As of '+end.isoformat())
    # Parse only explicit county lists in the Human Case Summary narrative, never PDF table columns.
    summary=full.split(f'{year} Human Case Summary',1)
    if len(summary)!=2:raise ValueError('Human case summary missing')
    summary=summary[1].split('Veterinary Cases',1)[0]
    headers=list(re.finditer(rf'{year}\s+((?:(?:International Travel-Associated|Locally Acquired|West Nile Virus Illness Acquired in Florida|Eastern Equine Encephalitis Acquired in Florida|Chikungunya Cases Acquired in Florida|Dengue Cases Acquired in Florida|Zika Cases Acquired in Florida))[^:]*):',summary,re.I))
    for i,h in enumerate(headers):
        title=h[1];body=summary[h.end():headers[i+1].start() if i+1<len(headers) else len(summary)]
        disease=next((v for k,v in [('West Nile','West Nile virus'),('Eastern Equine','Eastern equine encephalitis'),('Dengue','Dengue'),('Chikungunya','Chikungunya'),('Malaria','Malaria'),('Zika','Zika')] if k.lower() in title.lower()),None)
        if not disease:continue
        travel='Travel-Associated' in title
        if travel:
            listing=re.search(r'Counties reporting cases were:\s*(.*?)(?:\.(?!\s*(?:Johns|Lucie))|Countries of origin)',body,re.I)
            if not listing:continue
            clause=listing[1]
        else:
            listing=re.search(r'(?:have been reported|has been reported)\s+in\s+(.*?)\s+count(?:y|ies)(?:\s|\.)',body,re.I)
            if not listing:continue
            clause=listing[1]
        emit(county_ids(clause,counties),disease,'Human cases','Travel-associated' if travel else 'Locally acquired',
             'Confirmed and probable combined; not separated by county',f'Human {disease.lower()} cases listed for this county in the {year} year-to-date summary. See the report for counts and onset dates.')
    for code,disease in [('WNV','West Nile virus'),('SLEV','St. Louis encephalitis'),('EEEV','Eastern equine encephalitis')]:
        for hit in re.finditer(r'sentinel chickens? tested positive for antibodies to '+code+r' in (.*?) count(?:y|ies)\.',first,re.I):
            emit(county_ids(hit[1],counties),disease,'Sentinel chickens','Not applicable','Surveillance detection',
                 'Antibodies detected in sentinel chickens in this reporting week. This is animal surveillance, not a human case.',period=f'Week ending {end.isoformat()}')
    if not records:raise ValueError('No Florida records recognized; refuse silent empty feed')
    return {'id':'fl-weekly','status':'available','agency':'Florida Department of Health','sourceUrl':source_url,
            'indexUrl':FL_INDEX,'dataAsOf':end.isoformat(),'reportingPeriod':f'Week ending {end.isoformat()}; human summaries are year to date',
            'retrievedAt':now.isoformat(),'maxAgeDays':21,'coverage':'Selected Florida county advisories, human case summaries and sentinel-chicken reports. Mosquito-pool and equine surveillance are not included.',
            'records':records}

def parse_dengue(text, headers, now):
    reader=csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    if not {'Year','Travel status','County','Count'}.issubset(reader.fieldnames or []):raise ValueError('CDC dengue schema changed')
    records=[];years=set()
    for r in reader:
        years.add(int(r['Year']))
        if int(r['Year'])!=now.year or r['Travel status'] not in ['Locally acquired','Travel associated']:continue
        if not re.fullmatch(r'\d{5}',r['County']):raise ValueError('Unexpected CDC county identifier')
        count=r['Count'].strip()
        if not re.fullmatch(r'\d+|\d+ to \d+',count):raise ValueError('Unrecognized CDC count or suppression range')
        if count=='0':continue
        records.append({'id':f'cdc-den-{r["County"]}-{r["Travel status"]}', 'countyFips':r['County'],'disease':'Dengue',
            'evidence':'Human cases','acquisition':r['Travel status'],'classification':'Provisional reported cases; confirmation status not separated in county CSV',
            'summary':f'{count} reported dengue cases in {now.year}. County of residence; this may differ from where exposure occurred.',
            'advisoryStatus':None,'dataAsOf':None,'reportingPeriod':f'{now.year} year to date',
            'agency':'CDC ArboNET','sourceUrl':DEN_PAGE,'dataUrl':DEN_CSV,'sourceId':'cdc-dengue'})
    if now.year not in years:raise ValueError('CDC source is historical, not the current reporting year')
    modified=headers.get('Last-Modified')
    modified=parsedate_to_datetime(modified).astimezone(timezone.utc).isoformat() if modified else None
    if not modified:raise ValueError('CDC file freshness cannot be verified')
    return {'id':'cdc-dengue','status':'available','agency':'CDC ArboNET','sourceUrl':DEN_PAGE,'dataUrl':DEN_CSV,
            'dataAsOf':None,'sourceModifiedAt':modified,'reportingPeriod':f'{now.year} year to date; precise surveillance as-of date is not supplied by this source',
            'retrievedAt':now.isoformat(),'maxAgeDays':35,'coverage':'US dengue human cases by county of residence, split by travel status. Small counts remain ranges. Not a local advisory feed.', 'records':records}

def main():
    now=datetime.now(timezone.utc);out=ROOT/'data';out.mkdir(exist_ok=True)
    # Geography is bundled and reproducible; it is not redownloaded on daily health refreshes.
    geo_path=out/'us-counties.json'
    if geo_path.exists():counties=json.loads(geo_path.read_text())['counties']
    else:
        data,_=download(ADJ_URL);counties=geography(data.decode('cp1252'))
        geo_path.write_text(json.dumps({'sourceUrl':ADJ_URL,'counties':counties},separators=(',',':')),encoding='utf8')
    sources=[];failures=[]
    for key in ['fl-weekly','cdc-dengue']:
        try:
            if key=='fl-weekly':
                data,_=download(FL_INDEX);url=latest_report(data.decode());pdf,_=download(url)
                pages=[p.extract_text() or '' for p in PdfReader(io.BytesIO(pdf)).pages]
                source=parse_florida(pages,url,counties,now);source['sha256']=hashlib.sha256(pdf).hexdigest()
            else:
                data,headers=download(DEN_CSV);source=parse_dengue(data.decode('utf-8-sig'),headers,now);source['sha256']=hashlib.sha256(data).hexdigest()
            sources.append(source);print(key, 'OK',len(source['records']))
        except Exception as e:
            # Never re-date stale data as newly retrieved. The shipped snapshot remains explicitly dated.
            print(key,'UNAVAILABLE',str(e),file=sys.stderr);failures.append(key)
            sources.append({'id':key,'status':'unavailable','sourceUrl':FL_INDEX if key=='fl-weekly' else DEN_PAGE,
                'records':[],'error':'Official source could not be retrieved or its format could not be verified.'})
    payload={'schemaVersion':1,'generatedAt':now.isoformat(),'sources':sources}
    temp=out/'health.tmp';temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf8');temp.replace(out/'health.json')
    # A deploy still succeeds with an explicit unavailable state; CI logs expose the source failure.
    if failures:print('::warning::Health sources unavailable: '+', '.join(failures))

if __name__=='__main__':main()
