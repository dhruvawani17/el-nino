import urllib.request, json, math, os
from pathlib import Path

# Fetch the high-quality 2019 India GeoJSON
url = 'https://raw.githubusercontent.com/india-in-data/india-states-2019/master/india_states.geojson'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
raw = urllib.request.urlopen(req, timeout=15).read()
geojson = json.loads(raw.decode('utf-8'))

# Albers Equal Area projection tailored for India
phi1 = math.radians(12.0)
phi2 = math.radians(28.0)
phi0 = math.radians(22.0)
lambda0 = math.radians(82.0)
n = 0.5 * (math.sin(phi1) + math.sin(phi2))
c = math.cos(phi1)**2 + 2 * n * math.sin(phi1)
rho0 = math.sqrt(c - 2 * n * math.sin(phi0)) / n

def albers(lon, lat):
    lam = math.radians(lon)
    phi = math.radians(lat)
    term = c - 2 * n * math.sin(phi)
    rho = math.sqrt(max(0, term)) / n
    theta = n * (lam - lambda0)
    x = rho * math.sin(theta)
    y = rho0 - rho * math.cos(theta)
    return x, y

min_x, max_x = -0.2189, 0.2372
min_y, max_y = -0.2593, 0.2634
WIDTH = 850
HEIGHT = 970
PAD = 25
inner_w = WIDTH - 2 * PAD
inner_h = HEIGHT - 2 * PAD

def project(lon, lat):
    ax, ay = albers(lon, lat)
    sx = PAD + (ax - min_x) / (max_x - min_x) * inner_w
    sy = PAD + (max_y - ay) / (max_y - min_y) * inner_h
    return round(sx, 1), round(sy, 1)

def point_line_distance(pt, start, end):
    if start == end:
        return math.hypot(pt[0] - start[0], pt[1] - start[1])
    n = abs((end[1] - start[1]) * pt[0] - (end[0] - start[0]) * pt[1] + end[0] * start[1] - end[1] * start[0])
    d = math.hypot(end[1] - start[1], end[0] - start[0])
    return n / d

def rdp(points, epsilon):
    if len(points) < 3:
        return points
    dmax = 0
    index = 0
    for i in range(1, len(points) - 1):
        d = point_line_distance(points[i], points[0], points[-1])
        if d > dmax:
            index = i
            dmax = d
    if dmax > epsilon:
        rec1 = rdp(points[:index + 1], epsilon)
        rec2 = rdp(points[index:], epsilon)
        return rec1[:-1] + rec2
    else:
        return [points[0], points[-1]]

def ring_to_path(ring, epsilon=0.6):
    pts = [project(p[0], p[1]) for p in ring]
    if len(pts) < 3:
        return '', 0, 0, 0
    cleaned = [pts[0]]
    for p in pts[1:]:
        if p != cleaned[-1]:
            cleaned.append(p)
    simplified = rdp(cleaned, epsilon)
    if len(simplified) < 3:
        return '', 0, 0, 0
    
    area = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(len(simplified) - 1):
        x0, y0 = simplified[i]
        x1, y1 = simplified[i + 1]
        cross = (x0 * y1 - x1 * y0)
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    area = area * 0.5
    if abs(area) > 1e-5:
        cx = cx / (6.0 * area)
        cy = cy / (6.0 * area)
    else:
        cx = sum(p[0] for p in simplified) / len(simplified)
        cy = sum(p[1] for p in simplified) / len(simplified)
    
    path_str = 'M' + 'L'.join(f'{p[0]},{p[1]}' for p in simplified) + 'Z'
    return path_str, abs(area), round(cx, 1), round(cy, 1)

# Mapping dictionary for state metadata
STATE_META = {
    'Andhra Pradesh': {
        'code': 'AP', 'modelRegion': 'Andhra Pradesh', 'zone': 'Southern', 'capital': 'Amaravati',
        'crops': ['Rice', 'Chilli', 'Groundnut', 'Cotton'],
        'vulnerability': 'Coastal cyclonic surge risk, Rayalaseema drought belt, rainfed dryland stress.'
    },
    'Arunachal Pradesh': {
        'code': 'AR', 'modelRegion': 'Arunachal Pradesh', 'zone': 'North-Eastern', 'capital': 'Itanagar',
        'crops': ['Rice', 'Maize', 'Millet', 'Ginger'],
        'vulnerability': 'Eastern Himalayan fragile ecosystem, flash flood terrain, low agricultural connectivity.'
    },
    'Assam': {
        'code': 'AS', 'modelRegion': 'Assam', 'zone': 'North-Eastern', 'capital': 'Dispur',
        'crops': ['Tea', 'Rice', 'Jute', 'Mustard'],
        'vulnerability': 'Brahmaputra annual flood inundation, riverbank erosion, high kharif crop disruption.'
    },
    'Bihar': {
        'code': 'BR', 'modelRegion': 'Bihar', 'zone': 'Eastern', 'capital': 'Patna',
        'crops': ['Rice', 'Wheat', 'Maize', 'Pulses'],
        'vulnerability': 'North Bihar flood / South Bihar severe drought paradox, high child malnutrition, dense rural population.'
    },
    'Chhattisgarh': {
        'code': 'CG', 'modelRegion': 'Chhattisgarh', 'zone': 'Central', 'capital': 'Raipur',
        'crops': ['Rice (Paddy)', 'Maize', 'Kodo-Kutki', 'Oilseeds'],
        'vulnerability': 'Rainfed tribal agricultural belt, high monsoon dependency, moderate irrigation infrastructure.'
    },
    'Goa': {
        'code': 'GA', 'modelRegion': 'Goa', 'zone': 'Western', 'capital': 'Panaji',
        'crops': ['Paddy', 'Cashew', 'Coconut', 'Arecanut'],
        'vulnerability': 'Konkan coastal weather extremes, high reliance on inter-state food grain inflows.'
    },
    'Gujarat': {
        'code': 'GJ', 'modelRegion': 'Gujarat', 'zone': 'Western', 'capital': 'Gandhinagar',
        'subRegions': ['Gujarat North', 'Gujarat South'],
        'crops': ['Cotton', 'Groundnut', 'Wheat', 'Castor'],
        'vulnerability': 'Saurashtra and Kutch arid zone, erratic rainfall distribution, high groundwater depletion.'
    },
    'Haryana': {
        'code': 'HR', 'modelRegion': 'Haryana', 'zone': 'Northern', 'capital': 'Chandigarh',
        'crops': ['Wheat', 'Basmati Rice', 'Mustard', 'Sugarcane'],
        'vulnerability': 'High irrigation buffer but acute groundwater table drop, extreme pre-monsoon heatwaves.'
    },
    'Himachal Pradesh': {
        'code': 'HP', 'modelRegion': 'Himachal Pradesh', 'zone': 'Northern', 'capital': 'Shimla',
        'crops': ['Apples', 'Maize', 'Wheat', 'Vegetables'],
        'vulnerability': 'Western Himalayan microclimate shifts, cloudburst & landslide threats, apple orchard temperature stress.'
    },
    'Jammu & Kashmir': {
        'code': 'JK', 'modelRegion': 'Jammu and Kashmir', 'zone': 'Northern', 'capital': 'Srinagar / Jammu',
        'crops': ['Apples', 'Saffron', 'Rice', 'Walnut'],
        'vulnerability': 'Sub-Himalayan rain shadow variability, glacial melt variations, horticulture vulnerability.'
    },
    'Jharkhand': {
        'code': 'JH', 'modelRegion': 'Jharkhand', 'zone': 'Eastern', 'capital': 'Ranchi',
        'crops': ['Rice', 'Maize', 'Pulses', 'Oilseeds'],
        'vulnerability': 'Chota Nagpur plateau undulating terrain, very low canal irrigation, severe kharif crop sensitivity.'
    },
    'Karnataka': {
        'code': 'KA', 'modelRegion': 'Karnataka', 'zone': 'Southern', 'capital': 'Bengaluru',
        'subRegions': ['Karnataka North'],
        'crops': ['Ragi', 'Jowar', 'Coffee', 'Sugarcane', 'Cotton'],
        'vulnerability': 'North Karnataka semi-arid drought zone, recurring deficit in Krishna & Cauvery river basins.'
    },
    'Kerala': {
        'code': 'KL', 'modelRegion': 'Kerala', 'zone': 'Southern', 'capital': 'Thiruvananthapuram',
        'crops': ['Spices', 'Rubber', 'Coconut', 'Paddy'],
        'vulnerability': 'Intense monsoon cloudburst / flood vulnerability, Western Ghats slope instability.'
    },
    'Ladakh': {
        'code': 'LA', 'modelRegion': 'Ladakh', 'zone': 'Northern', 'capital': 'Leh',
        'crops': ['Barley', 'Apricot', 'Buckwheat', 'Vegetables'],
        'vulnerability': 'High-altitude cold desert, 100% reliance on glacial stream melt, extreme winter food logistics.'
    },
    'Madhya Pradesh': {
        'code': 'MP', 'modelRegion': 'Madhya Pradesh', 'zone': 'Central', 'capital': 'Bhopal',
        'crops': ['Soybean', 'Wheat', 'Gram (Chana)', 'Mustard'],
        'vulnerability': 'Bundelkhand and Baghelkhand chronic drought vulnerability, high soybean crop yield swings.'
    },
    'Maharashtra': {
        'code': 'MH', 'modelRegion': 'Maharashtra', 'zone': 'Western', 'capital': 'Mumbai',
        'subRegions': ['Maharashtra East', 'Maharashtra West'],
        'crops': ['Soybean', 'Cotton', 'Sugarcane', 'Jowar', 'Onion'],
        'vulnerability': 'Marathwada & Vidarbha acute rainfed drought distress, deep groundwater stress, heatwave exposure.'
    },
    'Manipur': {
        'code': 'MN', 'modelRegion': 'Manipur', 'zone': 'North-Eastern', 'capital': 'Imphal',
        'crops': ['Rice', 'Maize', 'Pulses', 'Oilseeds'],
        'vulnerability': 'Hill-valley agricultural logistics, sensitive forest-fallow agro-climatic cycle.'
    },
    'Meghalaya': {
        'code': 'ML', 'modelRegion': 'Meghalaya', 'zone': 'North-Eastern', 'capital': 'Shillong',
        'crops': ['Rice', 'Arecanut', 'Ginger', 'Turmeric'],
        'vulnerability': 'Excessive rainfall run-off on plateau, shallow soil topsoil wash, limited dry season retention.'
    },
    'Mizoram': {
        'code': 'MZ', 'modelRegion': 'Mizoram', 'zone': 'North-Eastern', 'capital': 'Aizawl',
        'crops': ['Paddy', 'Maize', 'Ginger', 'Pineapple'],
        'vulnerability': 'Steep terrain shifting agriculture sensitivity, inter-district transport bottlenecks during monsoon.'
    },
    'NCT of Delhi': {
        'code': 'DL', 'modelRegion': 'Delhi', 'zone': 'Northern', 'capital': 'New Delhi',
        'crops': ['Wheat', 'Vegetables', 'Flowers'],
        'vulnerability': 'Urban heat island effect, high vulnerability to regional grain price spikes, Yamuna basin flooding.'
    },
    'Nagaland': {
        'code': 'NL', 'modelRegion': 'Nagaland', 'zone': 'North-Eastern', 'capital': 'Kohima',
        'crops': ['Rice', 'Maize', 'Millet', 'Cardamom'],
        'vulnerability': 'Jhum farming climate variability, steep terrain slope erosion during delayed monsoons.'
    },
    'Odisha': {
        'code': 'OD', 'modelRegion': 'Odisha', 'zone': 'Eastern', 'capital': 'Bhubaneswar',
        'crops': ['Rice', 'Pulses', 'Oilseeds', 'Jute'],
        'vulnerability': 'Bay of Bengal tropical cyclone corridor, Western Odisha (KBK district) drought sensitivity.'
    },
    'Punjab': {
        'code': 'PB', 'modelRegion': 'Punjab', 'zone': 'Northern', 'capital': 'Chandigarh',
        'crops': ['Wheat', 'Rice (Paddy)', 'Cotton', 'Sugarcane'],
        'vulnerability': 'Intense groundwater overdraft, thermal heat shock during wheat grain-filling stage.'
    },
    'Rajasthan': {
        'code': 'RJ', 'modelRegion': 'Rajasthan', 'zone': 'Western', 'capital': 'Jaipur',
        'subRegions': ['Rajasthan East', 'Rajasthan West'],
        'crops': ['Bajra', 'Mustard', 'Gram', 'Guar', 'Wheat'],
        'vulnerability': 'Thar Desert arid zone, highest temperature anomalies, acute livestock and fodder deficit during El Niño.'
    },
    'Sikkim': {
        'code': 'SK', 'modelRegion': 'Sikkim', 'zone': 'North-Eastern', 'capital': 'Gangtok',
        'crops': ['Large Cardamom', 'Ginger', 'Organic Maize', 'Buckwheat'],
        'vulnerability': 'Himalayan fragile ecology, GLOF (glacial lake outburst flood) risk, 100% organic crop weather sensitivity.'
    },
    'Tamil Nadu': {
        'code': 'TN', 'modelRegion': 'Tamil Nadu', 'zone': 'Southern', 'capital': 'Chennai',
        'crops': ['Paddy', 'Sugarcane', 'Groundnut', 'Millets'],
        'vulnerability': 'Northeast retreating monsoon reliance, Cauvery delta water sharing disputes, coastal salinization.'
    },
    'Telangana': {
        'code': 'TS', 'modelRegion': 'Telangana', 'zone': 'Southern', 'capital': 'Hyderabad',
        'crops': ['Cotton', 'Paddy', 'Maize', 'Chilli'],
        'vulnerability': 'Deccan plateau dryland farming, high borewell reliance, sensitivity to delayed southwest monsoon.'
    },
    'Tripura': {
        'code': 'TR', 'modelRegion': 'Tripura', 'zone': 'North-Eastern', 'capital': 'Agartala',
        'crops': ['Rice', 'Rubber', 'Tea', 'Jute'],
        'vulnerability': 'Border topography riverine flooding, isolated transport corridors during severe monsoon seasons.'
    },
    'Uttar Pradesh': {
        'code': 'UP', 'modelRegion': 'Uttar Pradesh', 'zone': 'Northern', 'capital': 'Lucknow',
        'subRegions': ['Uttar Pradesh East', 'Uttar Pradesh West'],
        'crops': ['Wheat', 'Sugarcane', 'Rice', 'Potato', 'Pulses'],
        'vulnerability': 'East UP dense rainfed flood-drought oscillation, Bundelkhand acute drought, huge rural malnutrition burden.'
    },
    'Uttarakhand': {
        'code': 'UK', 'modelRegion': 'Uttarakhand', 'zone': 'Northern', 'capital': 'Dehradun',
        'crops': ['Finger Millet (Mandua)', 'Barnyard Millet', 'Wheat', 'Soybean'],
        'vulnerability': 'Central Himalayan seismic & cloudburst vulnerability, terrace farm moisture stress, erratic snowfall.'
    },
    'West Bengal': {
        'code': 'WB', 'modelRegion': 'West Bengal', 'zone': 'Eastern', 'capital': 'Kolkata',
        'crops': ['Rice (Aman, Boro)', 'Jute', 'Tea', 'Potato'],
        'vulnerability': 'Sundarbans delta storm surge & salinity intrusion, recurring flood devastation, high population density.'
    },
    'Andaman & Nicobar Island': {
        'code': 'AN', 'modelRegion': 'Tamil Nadu', 'zone': 'Islands', 'capital': 'Port Blair',
        'crops': ['Coconut', 'Arecanut', 'Paddy', 'Spices'],
        'vulnerability': 'Island marine vulnerability, sea surface temperature surge, cyclone vulnerability.'
    },
    'Chandigarh': {
        'code': 'CH', 'modelRegion': 'Punjab', 'zone': 'Northern', 'capital': 'Chandigarh',
        'crops': ['Urban Greens'],
        'vulnerability': 'Northern urban union territory, food supply chain vulnerability.'
    },
    'Dadara & Nagar Havelli': {
        'code': 'DN', 'modelRegion': 'Gujarat', 'zone': 'Western', 'capital': 'Silvassa',
        'crops': ['Paddy', 'Ragi', 'Pulses'],
        'vulnerability': 'Western tribal agrarian belt, river flood vulnerability.'
    },
    'Daman & Diu': {
        'code': 'DD', 'modelRegion': 'Gujarat', 'zone': 'Western', 'capital': 'Daman',
        'crops': ['Paddy', 'Bajra'],
        'vulnerability': 'Coastal maritime saline surge, high cyclone exposure.'
    },
    'Lakshadweep': {
        'code': 'LD', 'modelRegion': 'Kerala', 'zone': 'Islands', 'capital': 'Kavaratti',
        'crops': ['Coconut', 'Tuna Fishing'],
        'vulnerability': 'Coral atoll sea-level rise and El Niño coral bleaching / fishery disruption.'
    },
    'Puducherry': {
        'code': 'PY', 'modelRegion': 'Tamil Nadu', 'zone': 'Southern', 'capital': 'Puducherry',
        'crops': ['Paddy', 'Sugarcane', 'Groundnut'],
        'vulnerability': 'Coromandel coast storm surge, coastal groundwater salinity intrusion.'
    }
}

# Group features by state name
states = {}
for f in geojson.get('features', []):
    st_name = f.get('properties', {}).get('ST_NM', '').strip()
    if not st_name:
        continue
    if st_name not in states:
        states[st_name] = {'rings': []}
    geom = f.get('geometry', {})
    gtype = geom.get('type')
    coords = geom.get('coordinates', [])
    if gtype == 'Polygon':
        for ring in coords:
            states[st_name]['rings'].append(ring)
    elif gtype == 'MultiPolygon':
        for poly in coords:
            for ring in poly:
                states[st_name]['rings'].append(ring)

# Centers fine-tuning for visual perfection inside each state's polygon
MANUAL_CENTERS = {
    'Jammu & Kashmir': (205.0, 138.0),
    'Ladakh': (285.0, 102.0),
    'West Bengal': (562.0, 435.0),
    'Gujarat': (135.0, 448.0),
    'Maharashtra': (245.0, 560.0),
    'Madhya Pradesh': (315.0, 445.0),
    'Andhra Pradesh': (340.0, 670.0),
    'Karnataka': (232.0, 695.0),
    'Kerala': (238.0, 835.0),
    'Tamil Nadu': (295.0, 815.0),
    'Assam': (698.0, 342.0),
    'Uttarakhand': (330.0, 240.0),
    'Himachal Pradesh': (280.0, 185.0),
    'Punjab': (235.0, 218.0),
    'Haryana': (258.0, 266.0),
    'NCT of Delhi': (276.0, 280.0),
    'Rajasthan': (185.0, 345.0),
    'Uttar Pradesh': (375.0, 345.0),
    'Bihar': (505.0, 375.0),
    'Jharkhand': (505.0, 440.0),
    'Odisha': (475.0, 530.0),
    'Chhattisgarh': (405.0, 508.0),
    'Telangana': (322.0, 615.0),
}

state_list = []
for name, sdata in states.items():
    meta = STATE_META.get(name, {
        'code': name[:2].upper(),
        'modelRegion': name,
        'zone': 'Other',
        'capital': 'State Capital',
        'crops': ['Paddy', 'Wheat'],
        'vulnerability': 'Vulnerable to monsoonal variations.'
    })
    
    paths = []
    max_area = 0
    computed_center = (400, 400)
    for ring in sdata['rings']:
        p_str, area, cx, cy = ring_to_path(ring, epsilon=0.62)
        if p_str:
            paths.append(p_str)
            if area > max_area:
                max_area = area
                computed_center = (cx, cy)
                
    center = MANUAL_CENTERS.get(name, computed_center)
    state_list.append({
        'id': f"IN-{meta['code']}",
        'name': name,
        'code': meta['code'],
        'modelRegion': meta['modelRegion'],
        'subRegions': meta.get('subRegions', []),
        'zone': meta['zone'],
        'capital': meta['capital'],
        'crops': meta['crops'],
        'vulnerability': meta['vulnerability'],
        'center': list(center),
        'd': ' '.join(paths),
    })

# Sort by name
state_list.sort(key=lambda s: s['name'])

# Write to src/data/indiaMapData.ts
out_path = Path('src/data/indiaMapData.ts')
out_path.parent.mkdir(parents=True, exist_ok=True)

ts_content = f"""// Auto-generated precise India Geographic Vector Map Data (Albers Equal Area Projection)
// ViewBox: 0 0 850 970. Standard Cartographic Boundary of India.

export interface IndiaStateFeature {{
  id: string;
  name: string;
  code: string;
  modelRegion: string;
  subRegions?: string[];
  zone: 'Northern' | 'Western' | 'Central' | 'Eastern' | 'Southern' | 'North-Eastern' | 'Islands' | string;
  capital: string;
  crops: string[];
  vulnerability: string;
  center: [number, number];
  d: string;
}}

export const INDIA_MAP_VIEWBOX = '0 0 850 970';

export const INDIA_STATES: IndiaStateFeature[] = {json.dumps(state_list, indent=2)};
"""

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f"Generated {len(state_list)} states written to {out_path} ({len(ts_content)} bytes)")
