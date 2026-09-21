import { datasetChecks, datasetIssuesFor, listDatasets } from "@/lib/db/dataLibrary";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dataset = url.searchParams.get("dataset") ?? "currency";

  const datasets = await listDatasets();
  const selected = datasets.find((d) => d.id === dataset) ?? datasets[0];
  const [checks, issues] = await Promise.all([datasetChecks(dataset), datasetIssuesFor(dataset)]);

  return Response.json({ datasets, selected, checks, issues });
}
