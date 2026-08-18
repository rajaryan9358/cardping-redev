import { appEnvFiles, maskValue } from "../../../lib/appEnvFiles";
import { Tabs } from "../../../components/ui/Tabs";
import { EnvVarRow } from "./EnvVarRow";
import { AllFieldsEditor } from "./AllFieldsEditor";

async function Panel({ app }: { app: "server" | "dashboard" }) {
  const entries = await appEnvFiles.readEnvFile(app);
  return (
    <div className="flex flex-col gap-3">
      <AllFieldsEditor app={app} />
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        {entries.map((entry) => (
          <EnvVarRow key={entry.key} app={app} keyName={entry.key} masked={maskValue(entry.value)} />
        ))}
      </div>
    </div>
  );
}

export default async function EnvVariablesPage() {
  const serverPanel = <Panel app="server" />;
  const dashboardPanel = <Panel app="dashboard" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Env Variables</h1>
        <p className="mt-1 text-sm text-muted">Values are masked until you reveal or edit them.</p>
      </div>
      <Tabs
        tabs={[
          { id: "server", label: "server", content: serverPanel },
          { id: "dashboard", label: "dashboard", content: dashboardPanel },
        ]}
      />
    </div>
  );
}
