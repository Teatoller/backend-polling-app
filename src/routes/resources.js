// src/routes/resources.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Data files now live next to this router in the same folder
const dataDir = __dirname;

async function loadTsArray(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']') + 1;
  if (start < 0 || end <= 0) throw new Error('Invalid TS data format');
  const jsonText = raw.slice(start, end);
  return JSON.parse(jsonText);
}

router.get('/counties', async (req, res) => {
  try {
    const file = path.resolve(dataDir, 'counties.ts');
    const data = await loadTsArray(file);
    res.json(data);
  } catch (err) {
    console.error('Counties load error:', err.message);
    res.status(500).json({ error: 'Failed to load counties' });
  }
});

router.get('/sub-counties', async (req, res) => {
  try {
    const countyId = req.query.countyId ? Number(req.query.countyId) : undefined;
    const file = path.resolve(dataDir, 'subCounties.ts');
    let data = await loadTsArray(file);
    if (countyId) {
      data = data.filter(sc => sc.countyId === countyId);
    }
    res.json(data);
  } catch (err) {
    console.error('SubCounties load error:', err.message);
    res.status(500).json({ error: 'Failed to load sub-counties' });
  }
});

router.get('/wards', async (req, res) => {
  try {
    const subCountyId = req.query.subCountyId ? Number(req.query.subCountyId) : undefined;
    const file = path.resolve(dataDir, 'wards.ts');
    let data = await loadTsArray(file);
    if (subCountyId) {
      data = data.filter(w => w.subCountyId === subCountyId);
    }
    res.json(data);
  } catch (err) {
    console.error('Wards load error:', err.message);
    res.status(500).json({ error: 'Failed to load wards' });
  }
});

router.get('/polling-stations', async (req, res) => {
  try {
    const wardId = req.query.wardId ? Number(req.query.wardId) : undefined;
    const file = path.resolve(dataDir, 'pollingStations.ts');
    let data = await loadTsArray(file);
    if (wardId) {
      data = data.filter(ps => ps.wardId === wardId);
    }
    res.json(data);
  } catch (err) {
    console.error('PollingStations load error:', err.message);
    res.status(500).json({ error: 'Failed to load polling stations' });
  }
});

router.get('/country-tree', async (req, res) => {
  try {
    const counties = await loadTsArray(path.resolve(dataDir, 'counties.ts'));
    const subCounties = await loadTsArray(path.resolve(dataDir, 'subCounties.ts'));
    const wards = await loadTsArray(path.resolve(dataDir, 'wards.ts'));
    const pollingStations = await loadTsArray(path.resolve(dataDir, 'pollingStations.ts'));

    const tree = counties.map(county => ({
      id: county.id,
      name: county.name,
      code: county.code,
      subCounties: subCounties
        .filter(sc => sc.countyId === county.id)
        .map(sc => ({
          id: sc.id,
          name: sc.name,
          code: sc.code,
          wards: wards
            .filter(w => w.subCountyId === sc.id)
            .map(w => ({
              id: w.id,
              name: w.name,
              code: w.code,
              pollingStations: pollingStations
                .filter(ps => ps.wardId === w.id)
                .map(ps => ps.name)
            }))
        }))
    }));

    res.json(tree);
  } catch (err) {
    console.error('Country tree load error:', err.message);
    res.status(500).json({ error: 'Failed to build country tree' });
  }
});

export default router;
