const baseManifest = require('../manifest.json');

module.exports = (req, res) => {
  const rawName = Array.isArray(req.query.appName) ? req.query.appName[0] : req.query.appName;
  const appName = String(rawName || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40)
    || baseManifest.short_name
    || 'Cell Service';

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).json({
    ...baseManifest,
    name: appName,
    short_name: appName.slice(0, 16),
    screenshots: (baseManifest.screenshots || []).map((screenshot) => ({
      ...screenshot,
      label: `Panel principal de ${appName}`
    }))
  });
};
