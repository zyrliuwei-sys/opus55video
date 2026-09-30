import { getAllConfigs } from '@/modules/config/service';

const c = await getAllConfigs();
const key = c.evolink_api_key?.trim();
if (!key) {
  console.log('NO KEY');
  process.exit(1);
}
const base = 'https://api.evolink.ai/v1';
const quality = process.argv[2] || 'medium';
const resolution = process.argv[3] || '1K';
const r = await fetch(`${base}/images/generations`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-image-2.5-sunburst',
    prompt: 'A red apple on a wooden table, soft light',
    size: '1:1',
    resolution,
    quality,
  }),
});
const j: any = await r.json();
console.log('create', r.status, JSON.stringify(j).slice(0, 600));
if (!j.id) process.exit(1);
for (let i = 0; i < 60; i++) {
  await new Promise((s) => setTimeout(s, 5000));
  const t: any = await (
    await fetch(`${base}/tasks/${j.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
  ).json();
  if (t.status === 'completed' || t.status === 'failed') {
    console.log('done', JSON.stringify(t).slice(0, 1500));
    process.exit(0);
  }
}
console.log('timeout');
process.exit(0);
