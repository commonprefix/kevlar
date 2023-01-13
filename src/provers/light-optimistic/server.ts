import express from 'express';
import * as http from 'http';
import { MemoryStore } from './memory-store.js';
import { LightClient } from '../../clients/light/index.js';
import { getDefaultClientConfig } from '../../rpc-bundle/utils.js';
import { BeaconAPIProver } from '../beacon-api-light/client.js';

export function getApp(network: number, beaconAPIURL: string) {
  const app = express();
  const config = getDefaultClientConfig(network);
  const provers = [new BeaconAPIProver(beaconAPIURL)];
  const store = new MemoryStore();
  const client = new LightClient(config, beaconAPIURL, provers, store);
  client.sync().then(() => client.subscribe(() => {}));

  app.get('/sync-committee/hashes', function (req, res, next) {
    if (!client.isSynced) return res.status(400).json({ error: 'Client not synced' });
    const startPeriod = parseInt(req.query.startPeriod as string);
    const maxCount = parseInt(req.query.maxCount as string);

    try {
        const hashes = store.getCommitteeHashes(startPeriod, maxCount);
        res.set('Content-Type', 'application/octet-stream');
        res.end(hashes);
    } catch (err) {
        next(err);
    }
  });

  app.get('/sync-committee/:period', function (req, res, next) {
    if (!client.isSynced) return res.status(400).json({ error: 'Client not synced' });
    const period = req.params.period === 'latest' ? client.latestPeriod : parseInt(req.params.period);

    try {
        const committee = store.getCommittee(period);
        res.set('Content-Type', 'application/octet-stream');
        res.end(committee);
    } catch (err) {
        next(err);
    }
  });

  app.get('/sync-update/:period', function (req, res, next) {
    if (!client.isSynced) return res.status(400).json({ error: 'Client not synced' });
    const period = req.params.period === 'latest' ? client.latestPeriod : parseInt(req.params.period);

    try {
        const update = store.getUpdate(period);
        res.set('Content-Type', 'application/octet-stream');
        res.end(update);
    } catch (err) {
        next(err);
    }
  });

  return app;
}

