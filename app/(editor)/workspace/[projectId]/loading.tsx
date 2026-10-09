import { Loader } from "@/components/ui/loader";

export default function WorkspaceLoading() {
  return (
    <main className="grid h-dvh place-items-center">
      <Loader label="Opening workspace" />
    </main>
  );
}
