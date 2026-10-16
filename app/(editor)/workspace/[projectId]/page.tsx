import { EditorShell } from "@/components/editor/editor-shell";
import { DeployGateProbe } from "@/components/shared/deploy-gate-probe";
import { flags } from "@/src/flags";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <>
      <EditorShell projectId={projectId} />
      {flags.deployGate && <DeployGateProbe />}
    </>
  );
}
