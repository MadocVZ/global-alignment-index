import { run as co2 } from './pipelines/co2.ts';

export async function runAll() {
  const pipelines = [{ name: 'co2_ppm', run: co2 }];
  for (const p of pipelines) {
    console.log(`start ${p.name}`);
    const data = await p.run();
    console.log(`done ${p.name} (${data.length})`);
  }
}

if ((import.meta as any).main) {
  runAll().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
