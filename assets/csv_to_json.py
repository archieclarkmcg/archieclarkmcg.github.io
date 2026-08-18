import csv
import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(script_dir, 'cms.csv')
json_path = os.path.join(script_dir, 'cms.json')

with open(csv_path, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    rows = list(reader)

with open(json_path, 'w', encoding='utf-8') as jsonfile:
    json.dump(rows, jsonfile, indent=2, ensure_ascii=False)

print(f"Successfully converted {len(rows)} entries from {csv_path} to {json_path}")